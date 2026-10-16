namespace MicrofinanceErp.Domain.Entities;

public class SavingsTransaction
{
    public long Id { get; set; }
    public int SavingsAccountId { get; set; }
    public SavingsAccount SavingsAccount { get; set; } = null!;

    public string Type { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public decimal BalanceBefore { get; set; }
    public decimal BalanceAfter { get; set; }
    public string IdempotencyKey { get; set; } = string.Empty;
    public int? CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
