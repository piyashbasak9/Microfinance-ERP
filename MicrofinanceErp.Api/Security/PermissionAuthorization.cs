using System.Security.Claims;
using MicrofinanceErp.Domain.Security;
using MicrofinanceErp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

namespace MicrofinanceErp.Api.Security;

public static class PermissionPolicies
{
    public const string Prefix = "Permission:";

    public static string For(string permissionCode) => Prefix + permissionCode;
}

public sealed class RequirePermissionAttribute : AuthorizeAttribute
{
    public RequirePermissionAttribute(string permissionCode)
    {
        Policy = PermissionPolicies.For(permissionCode);
    }
}

public sealed record PermissionRequirement(string PermissionCode) : IAuthorizationRequirement;

public sealed class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    private readonly MicrofinanceErpDbContext _dbContext;

    public PermissionAuthorizationHandler(MicrofinanceErpDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        if (!int.TryParse(context.User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            return;
        }

        var roleName = await _dbContext.StaffUsers
            .AsNoTracking()
            .Where(user => user.Id == userId && user.IsActive)
            .Select(user => user.Role)
            .SingleOrDefaultAsync();
        if (roleName is null)
        {
            return;
        }

        var roleIsActive = await _dbContext.AccessRoles
            .AsNoTracking()
            .AnyAsync(role => role.Name == roleName && role.IsActive);
        if (!roleIsActive)
        {
            return;
        }

        var isGranted = string.Equals(roleName, AccessControlCatalog.SuperAdmin, StringComparison.Ordinal)
            || await _dbContext.RolePermissions
                .AsNoTracking()
                .AnyAsync(rolePermission =>
                    rolePermission.AccessRole.Name == roleName
                    && rolePermission.AccessRole.IsActive
                    && rolePermission.PermissionCode == requirement.PermissionCode);
        if (isGranted)
        {
            context.Succeed(requirement);
        }
    }
}
