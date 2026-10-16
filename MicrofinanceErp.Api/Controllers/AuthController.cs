using MicrofinanceErp.Api.Models;
using MicrofinanceErp.Api.Security;
using MicrofinanceErp.Domain.Entities;
using MicrofinanceErp.Domain.Security;
using MicrofinanceErp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace MicrofinanceErp.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public class AuthController : ControllerBase
{
    private const string RefreshCookieName = "mfi-refresh";
    private static readonly TimeSpan AccessTokenLifetime = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan RefreshTokenLifetime = TimeSpan.FromDays(7);
    private static readonly TimeSpan PasswordResetLifetime = TimeSpan.FromMinutes(30);
    private readonly MicrofinanceErpDbContext _dbContext;
    private readonly IPasswordHasher<StaffUser> _passwordHasher;
    private readonly IPasswordResetEmailSender _emailSender;
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<AuthController> _logger;
    private readonly int _maxFailedLoginAttempts;
    private readonly TimeSpan _lockoutDuration;

    public AuthController(
        MicrofinanceErpDbContext dbContext,
        IPasswordHasher<StaffUser> passwordHasher,
        IPasswordResetEmailSender emailSender,
        IConfiguration configuration,
        IWebHostEnvironment environment,
        ILogger<AuthController> logger)
    {
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
        _emailSender = emailSender;
        _configuration = configuration;
        _environment = environment;
        _logger = logger;
        _maxFailedLoginAttempts = configuration.GetValue("Security:LockoutAttempts", 5);
        _lockoutDuration = TimeSpan.FromMinutes(configuration.GetValue("Security:LockoutMinutes", 15));
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("auth-sensitive")]
    public async Task<ActionResult<ApiEnvelope<object>>> Login(
        [FromBody] LoginRequest request,
        CancellationToken cancellationToken)
    {
        var normalizedEmail = request.Email.Trim().ToUpperInvariant();
        var user = await _dbContext.StaffUsers
            .SingleOrDefaultAsync(account => account.NormalizedEmail == normalizedEmail, cancellationToken);
        if (user is null)
        {
            _dbContext.AuditLogs.Add(AuditLogFactory.CreateAnonymousSignInFailure());
            await _dbContext.SaveChangesAsync(cancellationToken);
            return InvalidCredentials();
        }

        var now = DateTime.UtcNow;
        var roleIsActive = await _dbContext.AccessRoles
            .AnyAsync(role => role.Name == user.Role && role.IsActive, cancellationToken);
        if (!user.IsActive || !roleIsActive || user.LockoutEnd > now)
        {
            _dbContext.AuditLogs.Add(AuditLogFactory.Create(user, "Sign-in rejected", "Failure"));
            await _dbContext.SaveChangesAsync(cancellationToken);
            return InvalidCredentials();
        }

        var verification = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (verification == PasswordVerificationResult.Failed)
        {
            user.FailedLoginCount++;
            if (user.FailedLoginCount >= _maxFailedLoginAttempts)
            {
                user.LockoutEnd = now.Add(_lockoutDuration);
                user.FailedLoginCount = 0;
            }

            _dbContext.AuditLogs.Add(AuditLogFactory.Create(user, "Sign-in rejected", "Failure"));
            await _dbContext.SaveChangesAsync(cancellationToken);
            return InvalidCredentials();
        }

        user.FailedLoginCount = 0;
        user.LockoutEnd = null;
        user.LastLoginAt = now;
        if (verification == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);
        }
        var expiresAt = now.Add(AccessTokenLifetime);
        var refreshExpiresAt = now.Add(RefreshTokenLifetime);
        var refreshToken = CreateRefreshToken(user, refreshExpiresAt);
        _dbContext.RefreshTokens.Add(refreshToken.Entity);
        _dbContext.AuditLogs.Add(AuditLogFactory.Create(user, "Sign-in successful"));
        await _dbContext.SaveChangesAsync(cancellationToken);
        SetRefreshCookie(refreshToken.RawToken, refreshExpiresAt);

        var token = CreateAccessToken(user, expiresAt);
        var permissions = await GetPermissionsAsync(user.Role, cancellationToken);
        var result = new
        {
            user = new { id = user.Id, name = user.FullName, email = user.Email, role = user.Role, branchId = user.BranchId },
            permissions,
            token,
            expiresAt
        };

        return Ok(new ApiEnvelope<object>(true, "Login successful.", result, null, HttpContext.TraceIdentifier));
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    [EnableRateLimiting("auth-sensitive")]
    public async Task<ActionResult<ApiEnvelope<object>>> Refresh(CancellationToken cancellationToken)
    {
        if (!IsTrustedBrowserOrigin())
        {
            return Forbid();
        }

        if (!Request.Cookies.TryGetValue(RefreshCookieName, out var rawToken)
            || string.IsNullOrWhiteSpace(rawToken))
        {
            ClearRefreshCookie();
            return InvalidRefreshToken();
        }

        var now = DateTime.UtcNow;
        var tokenHash = TokenHashing.Hash(rawToken);
        await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        var storedToken = await _dbContext.RefreshTokens
            .SingleOrDefaultAsync(token => token.TokenHash == tokenHash, cancellationToken);
        if (storedToken is null || storedToken.ExpiresAt <= now)
        {
            await transaction.RollbackAsync(cancellationToken);
            ClearRefreshCookie();
            return InvalidRefreshToken();
        }
        if (storedToken.RevokedAt.HasValue)
        {
            if (storedToken.ReplacedByTokenHash is not null)
            {
                await _dbContext.RefreshTokens
                    .Where(token => token.StaffUserId == storedToken.StaffUserId && token.RevokedAt == null)
                    .ExecuteUpdateAsync(
                        update => update.SetProperty(token => token.RevokedAt, now),
                        cancellationToken);
                await transaction.CommitAsync(cancellationToken);
            }
            else
            {
                await transaction.RollbackAsync(cancellationToken);
            }

            ClearRefreshCookie();
            return InvalidRefreshToken();
        }

        var user = await _dbContext.StaffUsers
            .SingleOrDefaultAsync(account => account.Id == storedToken.StaffUserId && account.IsActive, cancellationToken);
        var roleIsActive = user is not null && await _dbContext.AccessRoles
            .AnyAsync(role => role.Name == user.Role && role.IsActive, cancellationToken);
        if (user is null || !roleIsActive
            || !string.Equals(user.SecurityStamp, storedToken.SecurityStamp, StringComparison.Ordinal))
        {
            await transaction.RollbackAsync(cancellationToken);
            ClearRefreshCookie();
            return InvalidRefreshToken();
        }

        var nextRawToken = TokenHashing.CreateToken();
        var nextTokenHash = TokenHashing.Hash(nextRawToken);
        var revoked = await _dbContext.RefreshTokens
            .Where(token => token.Id == storedToken.Id
                && token.RevokedAt == null
                && token.ExpiresAt > now
                && token.SecurityStamp == user.SecurityStamp)
            .ExecuteUpdateAsync(
                update => update
                    .SetProperty(token => token.RevokedAt, now)
                    .SetProperty(token => token.ReplacedByTokenHash, nextTokenHash),
                cancellationToken);
        if (revoked != 1)
        {
            await transaction.RollbackAsync(cancellationToken);
            ClearRefreshCookie();
            return InvalidRefreshToken();
        }

        var refreshExpiresAt = now.Add(RefreshTokenLifetime);
        _dbContext.RefreshTokens.Add(new RefreshToken
        {
            StaffUserId = user.Id,
            TokenHash = nextTokenHash,
            SecurityStamp = user.SecurityStamp,
            CreatedAt = now,
            ExpiresAt = refreshExpiresAt
        });
        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        var accessExpiresAt = now.Add(AccessTokenLifetime);
        SetRefreshCookie(nextRawToken, refreshExpiresAt);
        var permissions = await GetPermissionsAsync(user.Role, cancellationToken);
        return Ok(new ApiEnvelope<object>(true, "Session refreshed.", new
        {
            user = new { id = user.Id, name = user.FullName, email = user.Email, role = user.Role, branchId = user.BranchId },
            permissions,
            token = CreateAccessToken(user, accessExpiresAt),
            expiresAt = accessExpiresAt
        }, null, HttpContext.TraceIdentifier));
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    [EnableRateLimiting("auth-sensitive")]
    public async Task<ActionResult<ApiEnvelope<object>>> Logout(CancellationToken cancellationToken)
    {
        if (!IsTrustedBrowserOrigin())
        {
            return Forbid();
        }

        if (Request.Cookies.TryGetValue(RefreshCookieName, out var rawToken)
            && !string.IsNullOrWhiteSpace(rawToken))
        {
            var tokenHash = TokenHashing.Hash(rawToken);
            var refreshToken = await _dbContext.RefreshTokens
                .Include(token => token.StaffUser)
                .SingleOrDefaultAsync(token => token.TokenHash == tokenHash, cancellationToken);
            if (refreshToken is not null && refreshToken.RevokedAt is null)
            {
                refreshToken.RevokedAt = DateTime.UtcNow;
                _dbContext.AuditLogs.Add(AuditLogFactory.Create(refreshToken.StaffUser, "Sign-out"));
                await _dbContext.SaveChangesAsync(cancellationToken);
            }
        }

        ClearRefreshCookie();
        return Ok(new ApiEnvelope<object>(true, "Signed out.", new { signedOut = true }, null, HttpContext.TraceIdentifier));
    }

    [HttpPost("password/forgot")]
    [AllowAnonymous]
    [EnableRateLimiting("auth-sensitive")]
    public async Task<ActionResult<ApiEnvelope<object>>> RequestPasswordReset(
        [FromBody] ForgotPasswordRequest request,
        CancellationToken cancellationToken)
    {
        const string responseMessage = "If an active account matches that email, password reset instructions will be sent.";
        var normalizedEmail = request.Email.Trim().ToUpperInvariant();
        var user = await _dbContext.StaffUsers
            .SingleOrDefaultAsync(account => account.NormalizedEmail == normalizedEmail && account.IsActive, cancellationToken);
        if (user is null)
        {
            return Accepted(new ApiEnvelope<object>(true, responseMessage, null, null, HttpContext.TraceIdentifier));
        }

        var now = DateTime.UtcNow;
        await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        await _dbContext.PasswordResetTokens
            .Where(token => token.StaffUserId == user.Id && token.UsedAt == null)
            .ExecuteUpdateAsync(
                update => update.SetProperty(token => token.UsedAt, now),
                cancellationToken);

        var rawToken = TokenHashing.CreateToken();
        var resetToken = new PasswordResetToken
        {
            StaffUserId = user.Id,
            TokenHash = TokenHashing.Hash(rawToken),
            CreatedAt = now,
            ExpiresAt = now.Add(PasswordResetLifetime)
        };
        _dbContext.PasswordResetTokens.Add(resetToken);
        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        try
        {
            var clientBaseUrl = _configuration["Client:BaseUrl"];
            if (!Uri.TryCreate(clientBaseUrl, UriKind.Absolute, out var clientUri)
                || (clientUri.Scheme != Uri.UriSchemeHttps
                    && !(_environment.IsDevelopment() && clientUri.Scheme == Uri.UriSchemeHttp)))
            {
                throw new EmailDeliveryException("The password reset client URL is not configured.");
            }

            var resetUrl = new Uri(clientUri, $"reset-password?token={Uri.EscapeDataString(rawToken)}").ToString();
            await _emailSender.SendAsync(user.Email, user.FullName, resetUrl, cancellationToken);
        }
        catch (EmailDeliveryException exception)
        {
            _logger.LogError("Password reset email delivery failed. Reason: {Reason}", exception.Message);
            _dbContext.PasswordResetTokens.Remove(resetToken);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        return Accepted(new ApiEnvelope<object>(true, responseMessage, null, null, HttpContext.TraceIdentifier));
    }

    [HttpPost("password/reset")]
    [AllowAnonymous]
    [EnableRateLimiting("auth-sensitive")]
    public async Task<ActionResult<ApiEnvelope<object>>> ResetPassword(
        [FromBody] ResetPasswordRequest request,
        CancellationToken cancellationToken)
    {
        var tokenHash = TokenHashing.Hash(request.Token);
        var now = DateTime.UtcNow;
        await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        var resetToken = await _dbContext.PasswordResetTokens
            .AsNoTracking()
            .SingleOrDefaultAsync(
                token => token.TokenHash == tokenHash && token.UsedAt == null && token.ExpiresAt > now,
                cancellationToken);
        if (resetToken is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return BadRequest(new ApiEnvelope<object>(false, "The reset link is invalid or expired.", null, null, HttpContext.TraceIdentifier));
        }

        var claimed = await _dbContext.PasswordResetTokens
            .Where(token => token.Id == resetToken.Id && token.UsedAt == null && token.ExpiresAt > now)
            .ExecuteUpdateAsync(
                update => update.SetProperty(token => token.UsedAt, now),
                cancellationToken);
        if (claimed != 1)
        {
            await transaction.RollbackAsync(cancellationToken);
            return BadRequest(new ApiEnvelope<object>(false, "The reset link is invalid or expired.", null, null, HttpContext.TraceIdentifier));
        }

        var user = await _dbContext.StaffUsers
            .SingleOrDefaultAsync(account => account.Id == resetToken.StaffUserId && account.IsActive, cancellationToken);
        if (user is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return BadRequest(new ApiEnvelope<object>(false, "The reset link is invalid or expired.", null, null, HttpContext.TraceIdentifier));
        }

        user.PasswordHash = _passwordHasher.HashPassword(user, request.NewPassword);
        user.PasswordChangedAt = now;
        user.SecurityStamp = Guid.NewGuid().ToString("N");
        user.FailedLoginCount = 0;
        user.LockoutEnd = null;
        _dbContext.AuditLogs.Add(AuditLogFactory.Create(user, "Password reset"));
        await _dbContext.RefreshTokens
            .Where(token => token.StaffUserId == user.Id && token.RevokedAt == null)
            .ExecuteUpdateAsync(
                update => update.SetProperty(token => token.RevokedAt, now),
                cancellationToken);
        await _dbContext.PasswordResetTokens
            .Where(token => token.StaffUserId == user.Id && token.Id != resetToken.Id && token.UsedAt == null)
            .ExecuteUpdateAsync(
                update => update.SetProperty(token => token.UsedAt, now),
                cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        ClearRefreshCookie();

        return Ok(new ApiEnvelope<object>(
            true,
            "Password reset. Sign in using your new password.",
            new { signInRequired = true },
            null,
            HttpContext.TraceIdentifier));
    }

    [HttpPost("change-password")]
    [Authorize]
    [EnableRateLimiting("auth-sensitive")]
    public async Task<ActionResult<ApiEnvelope<object>>> ChangePassword(
        [FromBody] ChangePasswordRequest request,
        CancellationToken cancellationToken)
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            return Unauthorized(new ApiEnvelope<object>(false, "The access token is invalid.", null, null, HttpContext.TraceIdentifier));
        }

        var user = await _dbContext.StaffUsers
            .SingleOrDefaultAsync(account => account.Id == userId && account.IsActive, cancellationToken);
        if (user is null)
        {
            return Unauthorized(new ApiEnvelope<object>(false, "The account is no longer active.", null, null, HttpContext.TraceIdentifier));
        }

        var verification = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.CurrentPassword);
        if (verification == PasswordVerificationResult.Failed)
        {
            _dbContext.AuditLogs.Add(AuditLogFactory.Create(user, "Password change rejected", "Failure"));
            await _dbContext.SaveChangesAsync(cancellationToken);
            return BadRequest(new ApiEnvelope<object>(false, "Current password is incorrect.", null, null, HttpContext.TraceIdentifier));
        }

        if (string.Equals(request.CurrentPassword, request.NewPassword, StringComparison.Ordinal))
        {
            return BadRequest(new ApiEnvelope<object>(false, "New password must differ from the current password.", null, null, HttpContext.TraceIdentifier));
        }

        await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        var now = DateTime.UtcNow;
        user.PasswordHash = _passwordHasher.HashPassword(user, request.NewPassword);
        user.PasswordChangedAt = now;
        user.SecurityStamp = Guid.NewGuid().ToString("N");
        _dbContext.AuditLogs.Add(AuditLogFactory.Create(user, "Password changed"));
        await _dbContext.RefreshTokens
            .Where(token => token.StaffUserId == user.Id && token.RevokedAt == null)
            .ExecuteUpdateAsync(
                update => update.SetProperty(token => token.RevokedAt, now),
                cancellationToken);
        await _dbContext.PasswordResetTokens
            .Where(token => token.StaffUserId == user.Id && token.UsedAt == null)
            .ExecuteUpdateAsync(
                update => update.SetProperty(token => token.UsedAt, now),
                cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        ClearRefreshCookie();

        return Ok(new ApiEnvelope<object>(
            true,
            "Password changed. Sign in again with your new password.",
            new { signInRequired = true },
            null,
            HttpContext.TraceIdentifier));
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<ApiEnvelope<object>>> Me(CancellationToken cancellationToken)
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            return Unauthorized(new ApiEnvelope<object>(false, "The access token is invalid.", null, null, HttpContext.TraceIdentifier));
        }

        var user = await _dbContext.StaffUsers
            .AsNoTracking()
            .Where(account => account.Id == userId && account.IsActive)
            .Select(account => new
            {
                id = account.Id,
                name = account.FullName,
                email = account.Email,
                role = account.Role,
                branchId = account.BranchId
            })
            .SingleOrDefaultAsync(cancellationToken);
        if (user is null)
        {
            return Unauthorized(new ApiEnvelope<object>(false, "The account is no longer active.", null, null, HttpContext.TraceIdentifier));
        }

        var permissions = await GetPermissionsAsync(user.role, cancellationToken);
        return Ok(new ApiEnvelope<object>(true, "Current user loaded.", new
        {
            user,
            permissions
        }, null, HttpContext.TraceIdentifier));
    }

    private ObjectResult InvalidCredentials()
        => Unauthorized(new ApiEnvelope<object>(
            false,
            "Invalid email or password.",
            null,
            null,
            HttpContext.TraceIdentifier));

    private ActionResult<ApiEnvelope<object>> InvalidRefreshToken()
        => Unauthorized(new ApiEnvelope<object>(
            false,
            "The refresh session is invalid or expired. Sign in again.",
            null,
            null,
            HttpContext.TraceIdentifier));

    private async Task<string[]> GetPermissionsAsync(string roleName, CancellationToken cancellationToken)
    {
        if (string.Equals(roleName, AccessControlCatalog.SuperAdmin, StringComparison.Ordinal))
        {
            return await _dbContext.PermissionDefinitions
                .AsNoTracking()
                .OrderBy(permission => permission.Code)
                .Select(permission => permission.Code)
                .ToArrayAsync(cancellationToken);
        }

        return await _dbContext.RolePermissions
            .AsNoTracking()
            .Where(rolePermission => rolePermission.AccessRole.Name == roleName && rolePermission.AccessRole.IsActive)
            .OrderBy(rolePermission => rolePermission.PermissionCode)
            .Select(rolePermission => rolePermission.PermissionCode)
            .ToArrayAsync(cancellationToken);
    }

    private (string RawToken, RefreshToken Entity) CreateRefreshToken(StaffUser user, DateTime expiresAt)
    {
        var rawToken = TokenHashing.CreateToken();
        return (rawToken, new RefreshToken
        {
            StaffUserId = user.Id,
            TokenHash = TokenHashing.Hash(rawToken),
            SecurityStamp = user.SecurityStamp,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = expiresAt
        });
    }

    private void SetRefreshCookie(string rawToken, DateTime expiresAt)
    {
        Response.Cookies.Append(RefreshCookieName, rawToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = !_environment.IsDevelopment(),
            SameSite = SameSiteMode.Strict,
            Path = "/api/v1/auth",
            Expires = expiresAt,
            MaxAge = expiresAt - DateTime.UtcNow,
            IsEssential = true
        });
    }

    private void ClearRefreshCookie()
    {
        Response.Cookies.Delete(RefreshCookieName, new CookieOptions
        {
            HttpOnly = true,
            Secure = !_environment.IsDevelopment(),
            SameSite = SameSiteMode.Strict,
            Path = "/api/v1/auth"
        });
    }

    private bool IsTrustedBrowserOrigin()
    {
        var requestOrigin = Request.Headers.Origin.ToString();
        if (!Uri.TryCreate(requestOrigin, UriKind.Absolute, out var parsedRequestOrigin))
        {
            return false;
        }

        var configuredOrigins = _configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        if (configuredOrigins.Length == 0 && _environment.IsDevelopment())
        {
            configuredOrigins = ["http://localhost:5173"];
        }

        var normalizedOrigin = parsedRequestOrigin.GetLeftPart(UriPartial.Authority);
        return configuredOrigins.Any(origin =>
            Uri.TryCreate(origin, UriKind.Absolute, out var parsedAllowedOrigin)
            && string.Equals(
                normalizedOrigin,
                parsedAllowedOrigin.GetLeftPart(UriPartial.Authority),
                StringComparison.OrdinalIgnoreCase));
    }

    private string CreateAccessToken(StaffUser user, DateTime expiresAt)
    {
        var issuer = _configuration["Jwt:Issuer"] ?? "MicrofinanceErp.Api";
        var audience = _configuration["Jwt:Audience"] ?? "MicrofinanceErp.Client";
        var signingKey = _configuration["Jwt:SigningKey"]!;
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.FullName),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, user.Role),
            new("security_stamp", user.SecurityStamp)
        };
        if (user.BranchId.HasValue)
        {
            claims.Add(new Claim("branch_id", user.BranchId.Value.ToString()));
        }

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
            SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(issuer, audience, claims, expires: expiresAt, signingCredentials: credentials);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public sealed class LoginRequest
{
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.EmailAddress]
    [System.ComponentModel.DataAnnotations.StringLength(256)]
    public string Email { get; set; } = string.Empty;

    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.StringLength(256, MinimumLength = 1)]
    public string Password { get; set; } = string.Empty;
}

public sealed class ForgotPasswordRequest
{
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.EmailAddress]
    [System.ComponentModel.DataAnnotations.StringLength(256)]
    public string Email { get; set; } = string.Empty;
}

public sealed class ResetPasswordRequest
{
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.StringLength(128, MinimumLength = 32)]
    public string Token { get; set; } = string.Empty;

    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.StringLength(256, MinimumLength = 12)]
    [System.ComponentModel.DataAnnotations.RegularExpression(
        "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{12,256}$",
        ErrorMessage = "Password must be at least 12 characters and include uppercase, lowercase, number, and symbol.")]
    public string NewPassword { get; set; } = string.Empty;
}

public sealed class ChangePasswordRequest
{
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.StringLength(256, MinimumLength = 1)]
    public string CurrentPassword { get; set; } = string.Empty;

    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.StringLength(256, MinimumLength = 12)]
    [System.ComponentModel.DataAnnotations.RegularExpression(
        "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{12,256}$",
        ErrorMessage = "Password must be at least 12 characters and include uppercase, lowercase, number, and symbol.")]
    public string NewPassword { get; set; } = string.Empty;
}
