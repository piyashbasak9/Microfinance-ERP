namespace MicrofinanceErp.Domain.Entities;

public class LoanPayment
{
    public long Id { get; set; }
    public int LoanId { get; set; }
    public Loan Loan { get; set; } = null!;
    public string IdempotencyKey { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public decimal PrincipalAmount { get; set; }
    public decimal InterestAmount { get; set; }
    public int? CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
