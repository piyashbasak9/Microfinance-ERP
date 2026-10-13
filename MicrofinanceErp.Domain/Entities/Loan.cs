namespace MicrofinanceErp.Domain.Entities;

public enum LoanStatus
{
    Pending,
    Approved,
    Disbursed,
    Repaid,
    Overdue,
    WrittenOff,
    Rejected
}

public class Loan
{
    public int Id { get; set; }
    public int MemberId { get; set; }
    public Member Member { get; set; } = null!;

    public string ProductName { get; set; } = string.Empty;
    public decimal PrincipalAmount { get; set; }
    public decimal InterestRate { get; set; }
    public int TenureMonths { get; set; }
    public decimal OutstandingBalance { get; set; }
    public LoanStatus Status { get; set; } = LoanStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? DisbursedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
