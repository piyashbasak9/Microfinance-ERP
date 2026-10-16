using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Security.Claims;
using MicrofinanceErp.Api.Models;
using MicrofinanceErp.Api.Security;
using MicrofinanceErp.Domain.Entities;
using MicrofinanceErp.Domain.Security;
using MicrofinanceErp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MicrofinanceErp.Api.Controllers;

[ApiController]
[Route("api/v1/admin/users")]
[RequirePermission(AccessControlCatalog.UsersManage)]
public class AdminUsersController : ControllerBase
{
    private readonly MicrofinanceErpDbContext _dbContext;
    private readonly IPasswordHasher<StaffUser> _passwordHasher;

    public AdminUsersController(
        MicrofinanceErpDbContext dbContext,
        IPasswordHasher<StaffUser> passwordHasher)
    {
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
    }

    [HttpGet]
    public async Task<ActionResult<ApiEnvelope<object>>> GetUsers(CancellationToken cancellationToken)
    {
        var users = await _dbContext.StaffUsers
            .AsNoTracking()
            .OrderBy(user => user.FullName)
            .Select(user => new
            {
                id = user.Id,
                email = user.Email,
                fullName = user.FullName,
                role = user.Role,
                branchId = user.BranchId,
                isActive = user.IsActive,
                createdAt = user.CreatedAt,
                lastLoginAt = user.LastLoginAt
            })
            .ToListAsync(cancellationToken);

        return Ok(new ApiEnvelope<object>(true, "Staff users loaded.", users, null, HttpContext.TraceIdentifier));
    }

    [HttpPost]
    public async Task<ActionResult<ApiEnvelope<object>>> CreateUser(
        [FromBody] CreateStaffUserRequest request,
        CancellationToken cancellationToken)
    {
        var email = request.Email.Trim();
        var normalizedEmail = email.ToUpperInvariant();
        if (await _dbContext.StaffUsers.AnyAsync(user => user.NormalizedEmail == normalizedEmail, cancellationToken))
        {
            return Conflict(new ApiEnvelope<object>(false, "A user with that email already exists.", null, null, HttpContext.TraceIdentifier));
        }

        var role = await _dbContext.AccessRoles
            .SingleOrDefaultAsync(item => item.Name == request.Role && item.IsActive, cancellationToken);
        if (role is null)
        {
            return BadRequest(new ApiEnvelope<object>(false, "The selected role is not active.", null, null, HttpContext.TraceIdentifier));
        }

        if (!await IsBranchAvailableAsync(request.BranchId, cancellationToken))
        {
            return BadRequest(new ApiEnvelope<object>(false, "The selected branch is not available.", null, null, HttpContext.TraceIdentifier));
        }

        var user = new StaffUser
        {
            Email = email,
            NormalizedEmail = normalizedEmail,
            FullName = request.FullName.Trim(),
            Role = role.Name,
            BranchId = request.BranchId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);
        await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        _dbContext.StaffUsers.Add(user);
        await _dbContext.SaveChangesAsync(cancellationToken);
        _dbContext.AuditLogs.Add(CreateAuditLog("Staff user created", user.Id.ToString(), user.BranchId));
        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return StatusCode(
            StatusCodes.Status201Created,
            new ApiEnvelope<object>(true, "Staff user created.", ToResponse(user), null, HttpContext.TraceIdentifier));
    }

    [HttpPut("{userId:int}")]
    public async Task<ActionResult<ApiEnvelope<object>>> UpdateUser(
        int userId,
        [FromBody] UpdateStaffUserRequest request,
        CancellationToken cancellationToken)
    {
        await using var transaction = await _dbContext.Database.BeginTransactionAsync(
            IsolationLevel.Serializable,
            cancellationToken);
        var user = await _dbContext.StaffUsers.SingleOrDefaultAsync(item => item.Id == userId, cancellationToken);
        if (user is null)
        {
            return NotFound(new ApiEnvelope<object>(false, "Staff user not found.", null, null, HttpContext.TraceIdentifier));
        }

        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var actorId))
        {
            return Unauthorized(new ApiEnvelope<object>(false, "The access token is invalid.", null, null, HttpContext.TraceIdentifier));
        }

        var isChangingOwnAccess = actorId == user.Id
            && (request.Role != user.Role || request.IsActive != user.IsActive);
        if (isChangingOwnAccess)
        {
            return Conflict(new ApiEnvelope<object>(false, "You cannot change your own role or active status.", null, null, HttpContext.TraceIdentifier));
        }

        if (user.IsActive && user.Role == AccessControlCatalog.SuperAdmin
            && (!request.IsActive || request.Role != AccessControlCatalog.SuperAdmin))
        {
            var activeAdmins = await _dbContext.StaffUsers.CountAsync(
                item => item.IsActive && item.Role == AccessControlCatalog.SuperAdmin,
                cancellationToken);
            if (activeAdmins <= 1)
            {
                return Conflict(new ApiEnvelope<object>(false, "At least one active Super Admin must remain.", null, null, HttpContext.TraceIdentifier));
            }
        }

        var email = request.Email.Trim();
        var normalizedEmail = email.ToUpperInvariant();
        if (await _dbContext.StaffUsers.AnyAsync(
                item => item.Id != user.Id && item.NormalizedEmail == normalizedEmail,
                cancellationToken))
        {
            return Conflict(new ApiEnvelope<object>(false, "A user with that email already exists.", null, null, HttpContext.TraceIdentifier));
        }

        var role = await _dbContext.AccessRoles
            .SingleOrDefaultAsync(item => item.Name == request.Role && item.IsActive, cancellationToken);
        if (role is null)
        {
            return BadRequest(new ApiEnvelope<object>(false, "The selected role is not active.", null, null, HttpContext.TraceIdentifier));
        }

        if (!await IsBranchAvailableAsync(request.BranchId, cancellationToken))
        {
            return BadRequest(new ApiEnvelope<object>(false, "The selected branch is not available.", null, null, HttpContext.TraceIdentifier));
        }

        var normalizedFullName = request.FullName.Trim();
        var securityChanged = user.Role != role.Name
            || user.IsActive != request.IsActive
            || user.Email != email
            || user.FullName != normalizedFullName
            || user.BranchId != request.BranchId;
        user.Email = email;
        user.NormalizedEmail = normalizedEmail;
        user.FullName = normalizedFullName;
        user.Role = role.Name;
        user.BranchId = request.BranchId;
        user.IsActive = request.IsActive;
        if (securityChanged)
        {
            user.SecurityStamp = Guid.NewGuid().ToString("N");
            user.FailedLoginCount = 0;
            user.LockoutEnd = null;
            await _dbContext.RefreshTokens
                .Where(token => token.StaffUserId == user.Id && token.RevokedAt == null)
                .ExecuteUpdateAsync(
                    update => update.SetProperty(token => token.RevokedAt, DateTime.UtcNow),
                    cancellationToken);
        }

        _dbContext.AuditLogs.Add(CreateAuditLog("Staff user updated", user.Id.ToString(), user.BranchId));
        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return Ok(new ApiEnvelope<object>(true, "Staff user updated.", ToResponse(user), null, HttpContext.TraceIdentifier));
    }

    private Task<bool> IsBranchAvailableAsync(int? branchId, CancellationToken cancellationToken)
        => branchId is null
            ? Task.FromResult(true)
            : _dbContext.Branches.AnyAsync(branch => branch.Id == branchId && branch.IsActive, cancellationToken);

    private object ToResponse(StaffUser user)
        => new
        {
            id = user.Id,
            email = user.Email,
            fullName = user.FullName,
            role = user.Role,
            branchId = user.BranchId,
            isActive = user.IsActive,
            createdAt = user.CreatedAt,
            lastLoginAt = user.LastLoginAt
        };

    private AuditLog CreateAuditLog(string action, string entityId, int? branchId)
        => new()
        {
            ActorUserId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var actorId)
                ? actorId
                : null,
            ActorName = User.FindFirstValue(ClaimTypes.Name) ?? "Unknown user",
            BranchId = branchId,
            Action = action,
            EntityType = "StaffUser",
            EntityId = entityId,
            CreatedAt = DateTime.UtcNow
        };
}

public sealed class CreateStaffUserRequest
{
    [Required, EmailAddress, StringLength(256)]
    public string Email { get; set; } = string.Empty;

    [Required, StringLength(200, MinimumLength = 1)]
    public string FullName { get; set; } = string.Empty;

    [Required, StringLength(100)]
    public string Role { get; set; } = string.Empty;

    [Required]
    [StringLength(256, MinimumLength = 12)]
    [RegularExpression("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{12,256}$",
        ErrorMessage = "Password must be at least 12 characters and include uppercase, lowercase, number, and symbol.")]
    public string Password { get; set; } = string.Empty;

    [Range(1, int.MaxValue)]
    public int? BranchId { get; set; }
}

public sealed class UpdateStaffUserRequest
{
    [Required, EmailAddress, StringLength(256)]
    public string Email { get; set; } = string.Empty;

    [Required, StringLength(200, MinimumLength = 1)]
    public string FullName { get; set; } = string.Empty;

    [Required, StringLength(100)]
    public string Role { get; set; } = string.Empty;

    [Range(1, int.MaxValue)]
    public int? BranchId { get; set; }

    public bool IsActive { get; set; }
}
