using FluentAssertions;
using MicrofinanceErp.Domain.Security;

namespace MicrofinanceErp.Domain.Tests;

public class AccessControlCatalogTests
{
    [Fact]
    public void BuiltInRoles_ShouldReferenceOnlyDefinedPermissions()
    {
        var definedCodes = AccessControlCatalog.Permissions.Select(permission => permission.Code).ToHashSet();
        var roleNames = AccessControlCatalog.Roles.Select(role => role.Name).ToHashSet();

        AccessControlCatalog.Permissions.Select(permission => permission.Code).Should().OnlyHaveUniqueItems();
        AccessControlCatalog.RolePermissions.Should().OnlyContain(permission =>
            roleNames.Contains(permission.AccessRoleName) && definedCodes.Contains(permission.PermissionCode));
    }

    [Fact]
    public void SuperAdmin_ShouldHaveEveryDefinedPermission()
    {
        var grantedCodes = AccessControlCatalog.RolePermissions
            .Where(permission => permission.AccessRoleName == AccessControlCatalog.SuperAdmin)
            .Select(permission => permission.PermissionCode)
            .ToHashSet();

        grantedCodes.Should().BeEquivalentTo(AccessControlCatalog.Permissions.Select(permission => permission.Code));
    }

    [Fact]
    public void FieldOfficer_ShouldNotHaveLoanApprovalOrRepaymentPermission()
    {
        var grantedCodes = AccessControlCatalog.RolePermissions
            .Where(permission => permission.AccessRoleName == AccessControlCatalog.FieldOfficer)
            .Select(permission => permission.PermissionCode);

        grantedCodes.Should().NotContain(AccessControlCatalog.LoansApprove);
        grantedCodes.Should().NotContain(AccessControlCatalog.LoansRepay);
    }
}
