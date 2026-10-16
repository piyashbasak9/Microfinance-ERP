namespace MicrofinanceErp.Domain.Entities;

public class AccessRole
{
    public string Name { get; set; } = string.Empty;
    public string NormalizedName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool IsSystemRole { get; set; }
    public bool IsActive { get; set; } = true;
    public ICollection<RolePermission> Permissions { get; set; } = new List<RolePermission>();
}
