namespace MicrofinanceErp.Domain.Entities;

public class SavingsAccount
{
    public int Id { get; set; }
    public int MemberId { get; set; }
    public Member Member { get; set; } = null!;

    public string AccountNumber { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string Currency { get; set; } = "BDT";
    public decimal Balance { get; set; }
    public string Status { get; set; } = "Active";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
