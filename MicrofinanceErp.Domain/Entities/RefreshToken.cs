namespace MicrofinanceErp.Domain.Entities;

public class RefreshToken
{
    public long Id { get; set; }
    public int StaffUserId { get; set; }
    public StaffUser StaffUser { get; set; } = null!;
    public string TokenHash { get; set; } = string.Empty;
    public string SecurityStamp { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public string? ReplacedByTokenHash { get; set; }
}
