namespace MicrofinanceErp.Domain.Entities;

public class JournalLine
{
    public long Id { get; set; }
    public long JournalEntryId { get; set; }
    public JournalEntry JournalEntry { get; set; } = null!;
    public int ChartOfAccountId { get; set; }
    public ChartOfAccount Account { get; set; } = null!;
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
}
