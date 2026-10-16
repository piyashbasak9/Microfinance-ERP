using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using MicrofinanceErp.Api.Models;
using MicrofinanceErp.Api.Security;
using MicrofinanceErp.Domain.Entities;
using MicrofinanceErp.Domain.Security;
using MicrofinanceErp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MicrofinanceErp.Api.Controllers;

[ApiController]
[Route("api/v1/admin")]
[RequirePermission(AccessControlCatalog.RolesManage)]
public class AdminRolesController : ControllerBase
{
    private readonly MicrofinanceErpDbContext _dbContext;

    public AdminRolesController(MicrofinanceErpDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet("permissions")]
    public async Task<ActionResult<ApiEnvelope<object>>> GetPermissions(CancellationToken cancellationToken)
    {
        var permissions = await _dbContext.PermissionDefinitions
            .AsNoTracking()
            .OrderBy(permission => permission.Module)
            .ThenBy(permission => permission.Code)
            .Select(permission => new
            {
                code = permission.Code,
                module = permission.Module,
                description = permission.Description
            })
            .ToListAsync(cancellationToken);

        return Ok(new ApiEnvelope<object>(true, "Permissions loaded.", permissions, null, HttpContext.TraceIdentifier));
    }

    [HttpGet("roles")]
    public async Task<ActionResult<ApiEnvelope<object>>> GetRoles(CancellationToken cancellationToken)
    {
        var roles = await _dbContext.AccessRoles
            .AsNoTracking()
            .OrderBy(role => role.Name)
            .Select(role => new
            {
                name = role.Name,
                description = role.Description,
                isSystemRole = role.IsSystemRole,
                isActive = role.IsActive,
                permissions = role.Permissions
                    .Select(permission => permission.PermissionCode)
                    .OrderBy(code => code)
                    .ToArray()
            })
            .ToListAsync(cancellationToken);

        return Ok(new ApiEnvelope<object>(true, "Roles loaded.", roles, null, HttpContext.TraceIdentifier));
    }

    [HttpPost("roles")]
    public async Task<ActionResult<ApiEnvelope<object>>> CreateRole(
        [FromBody] CreateRoleRequest request,
        CancellationToken cancellationToken)
    {
        var name = request.Name.Trim();
        var normalizedName = name.ToUpperInvariant();
        if (name.Length == 0 || string.Equals(name, AccessControlCatalog.SuperAdmin, StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new ApiEnvelope<object>(false, "The role name is not available.", null, null, HttpContext.TraceIdentifier));
        }

        if (await _dbContext.AccessRoles.AnyAsync(role => role.NormalizedName == normalizedName, cancellationToken))
        {
            return Conflict(new ApiEnvelope<object>(false, "A role with that name already exists.", null, null, HttpContext.TraceIdentifier));
        }

        var validation = await ValidatePermissionCodesAsync(request.PermissionCodes, cancellationToken);
        if (validation is not null)
        {
            return BadRequest(new ApiEnvelope<object>(false, validation, null, null, HttpContext.TraceIdentifier));
        }

        var role = new AccessRole
        {
            Name = name,
            NormalizedName = normalizedName,
            Description = request.Description.Trim(),
            IsActive = true,
            IsSystemRole = false
        };
        role.Permissions = request.PermissionCodes
            .Distinct(StringComparer.Ordinal)
            .Select(code => new RolePermission { AccessRoleName = name, PermissionCode = code })
            .ToList();
        _dbContext.AccessRoles.Add(role);
        _dbContext.AuditLogs.Add(CreateAuditLog("Role created", name));
        await _dbContext.SaveChangesAsync(cancellationToken);

        return StatusCode(
            StatusCodes.Status201Created,
            new ApiEnvelope<object>(true, "Role created.", ToResponse(role), null, HttpContext.TraceIdentifier));
    }

    [HttpPut("roles/{roleName}/permissions")]
    public async Task<ActionResult<ApiEnvelope<object>>> UpdateRolePermissions(
        string roleName,
        [FromBody] UpdateRolePermissionsRequest request,
        CancellationToken cancellationToken)
    {
        var role = await _dbContext.AccessRoles
            .Include(item => item.Permissions)
            .SingleOrDefaultAsync(item => item.Name == roleName, cancellationToken);
        if (role is null)
        {
            return NotFound(new ApiEnvelope<object>(false, "Role not found.", null, null, HttpContext.TraceIdentifier));
        }

        if (role.IsSystemRole)
        {
            return Conflict(new ApiEnvelope<object>(false, "Built-in system role permissions cannot be changed.", null, null, HttpContext.TraceIdentifier));
        }

        var validation = await ValidatePermissionCodesAsync(request.PermissionCodes, cancellationToken);
        if (validation is not null)
        {
            return BadRequest(new ApiEnvelope<object>(false, validation, null, null, HttpContext.TraceIdentifier));
        }

        _dbContext.RolePermissions.RemoveRange(role.Permissions);
        role.Permissions = request.PermissionCodes
            .Distinct(StringComparer.Ordinal)
            .Select(code => new RolePermission { AccessRoleName = role.Name, PermissionCode = code })
            .ToList();
        _dbContext.RolePermissions.AddRange(role.Permissions);
        _dbContext.AuditLogs.Add(CreateAuditLog("Role permissions updated", role.Name));
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new ApiEnvelope<object>(true, "Role permissions updated.", ToResponse(role), null, HttpContext.TraceIdentifier));
    }

    private async Task<string?> ValidatePermissionCodesAsync(
        IEnumerable<string> permissionCodes,
        CancellationToken cancellationToken)
    {
        var requestedCodes = permissionCodes.Distinct(StringComparer.Ordinal).ToArray();
        var validCodes = await _dbContext.PermissionDefinitions
            .Where(permission => requestedCodes.Contains(permission.Code))
            .Select(permission => permission.Code)
            .ToListAsync(cancellationToken);
        if (validCodes.Count != requestedCodes.Length)
        {
            return "One or more permission codes are unknown.";
        }

        if (requestedCodes.Contains(AccessControlCatalog.UsersManage, StringComparer.Ordinal)
            || requestedCodes.Contains(AccessControlCatalog.RolesManage, StringComparer.Ordinal))
        {
            return "Security administration permissions are reserved for the built-in Super Admin role.";
        }

        return null;
    }

    private static object ToResponse(AccessRole role)
        => new
        {
            name = role.Name,
            description = role.Description,
            isSystemRole = role.IsSystemRole,
            isActive = role.IsActive,
            permissions = role.Permissions.Select(permission => permission.PermissionCode).OrderBy(code => code).ToArray()
        };

    private AuditLog CreateAuditLog(string action, string roleName)
        => new()
        {
            ActorUserId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var actorId)
                ? actorId
                : null,
            ActorName = User.FindFirstValue(ClaimTypes.Name) ?? "Unknown user",
            Action = action,
            EntityType = "AccessRole",
            EntityId = roleName,
            CreatedAt = DateTime.UtcNow
        };
}

public sealed class CreateRoleRequest
{
    [Required, StringLength(100, MinimumLength = 2)]
    public string Name { get; set; } = string.Empty;

    [Required, StringLength(300, MinimumLength = 1)]
    public string Description { get; set; } = string.Empty;

    [Required]
    public string[] PermissionCodes { get; set; } = [];
}

public sealed class UpdateRolePermissionsRequest
{
    [Required]
    public string[] PermissionCodes { get; set; } = [];
}
