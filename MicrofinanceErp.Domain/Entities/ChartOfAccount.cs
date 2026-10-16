namespace MicrofinanceErp.Domain.Entities;

public class ChartOfAccount
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string AccountType { get; set; } = string.Empty;
    public bool IsSystemAccount { get; set; }
    public bool IsActive { get; set; } = true;
}
