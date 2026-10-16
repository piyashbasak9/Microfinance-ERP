namespace MicrofinanceErp.Domain.Entities;

public class LoanInstallment
{
    public long Id { get; set; }
    public int LoanId { get; set; }
    public Loan Loan { get; set; } = null!;
    public int InstallmentNumber { get; set; }
    public decimal PrincipalDue { get; set; }
    public decimal InterestDue { get; set; }
    public decimal TotalDue { get; set; }
    public decimal BalanceAfter { get; set; }
    public decimal PrincipalPaid { get; set; }
    public decimal InterestPaid { get; set; }
    public DateTime? DueDate { get; set; }
    public string Status { get; set; } = "NotScheduled";
}
