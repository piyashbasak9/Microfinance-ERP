namespace MicrofinanceErp.Domain.Entities;

public class RolePermission
{
    public string AccessRoleName { get; set; } = string.Empty;
    public AccessRole AccessRole { get; set; } = null!;
    public string PermissionCode { get; set; } = string.Empty;
    public PermissionDefinition Permission { get; set; } = null!;
}
