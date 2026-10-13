using MicrofinanceErp.Api.Models;
using MicrofinanceErp.Domain.Entities;
using MicrofinanceErp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
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
    private const int MaxFailedLoginAttempts = 5;
    private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);
    private readonly MicrofinanceErpDbContext _dbContext;
    private readonly IPasswordHasher<StaffUser> _passwordHasher;
    private readonly IConfiguration _configuration;

    public AuthController(
        MicrofinanceErpDbContext dbContext,
        IPasswordHasher<StaffUser> passwordHasher,
        IConfiguration configuration)
    {
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
        _configuration = configuration;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiEnvelope<object>>> Login(
        [FromBody] LoginRequest request,
        CancellationToken cancellationToken)
    {
        var normalizedEmail = request.Email.Trim().ToUpperInvariant();
        var user = await _dbContext.StaffUsers
            .SingleOrDefaultAsync(account => account.NormalizedEmail == normalizedEmail, cancellationToken);
        if (user is null || !user.IsActive)
        {
            return InvalidCredentials();
        }

        var now = DateTime.UtcNow;
        if (user.LockoutEnd > now)
        {
            return InvalidCredentials();
        }

        var verification = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (verification == PasswordVerificationResult.Failed)
        {
            user.FailedLoginCount++;
            if (user.FailedLoginCount >= MaxFailedLoginAttempts)
            {
                user.LockoutEnd = now.Add(LockoutDuration);
                user.FailedLoginCount = 0;
            }

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
        await _dbContext.SaveChangesAsync(cancellationToken);

        var expiresAt = now.AddMinutes(15);
        var token = CreateAccessToken(user, expiresAt);
        var result = new
        {
            user = new { id = user.Id, name = user.FullName, email = user.Email, role = user.Role, branchId = user.BranchId },
            permissions = Array.Empty<string>(),
            token,
            expiresAt
        };

        return Ok(new ApiEnvelope<object>(true, "Login successful.", result, null, HttpContext.TraceIdentifier));
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

        return Ok(new ApiEnvelope<object>(true, "Current user loaded.", new
        {
            user,
            permissions = Array.Empty<string>()
        }, null, HttpContext.TraceIdentifier));
    }

    private ObjectResult InvalidCredentials()
        => Unauthorized(new ApiEnvelope<object>(
            false,
            "Invalid email or password.",
            null,
            null,
            HttpContext.TraceIdentifier));

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
            new(ClaimTypes.Role, user.Role)
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
    public string Email { get; set; } = string.Empty;

    [System.ComponentModel.DataAnnotations.Required]
    public string Password { get; set; } = string.Empty;
}
