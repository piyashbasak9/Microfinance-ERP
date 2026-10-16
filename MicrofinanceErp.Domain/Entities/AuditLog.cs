namespace MicrofinanceErp.Domain.Entities;

public class AuditLog
{
    public long Id { get; set; }
    public int? ActorUserId { get; set; }
    public string ActorName { get; set; } = string.Empty;
    public int? BranchId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string Outcome { get; set; } = "Success";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
