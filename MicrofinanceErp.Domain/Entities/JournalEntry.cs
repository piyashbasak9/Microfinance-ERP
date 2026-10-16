namespace MicrofinanceErp.Domain.Entities;

public class JournalEntry
{
    public long Id { get; set; }
    public int BranchId { get; set; }
    public string SourceType { get; set; } = string.Empty;
    public string SourceId { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime PostedAt { get; set; } = DateTime.UtcNow;
    public int? CreatedByUserId { get; set; }
    public ICollection<JournalLine> Lines { get; set; } = new List<JournalLine>();
}
