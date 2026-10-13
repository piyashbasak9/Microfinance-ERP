namespace MicrofinanceErp.Domain.Entities;

public class Member
{
    public int Id { get; set; }
    public int BranchId { get; set; }
    public Branch Branch { get; set; } = null!;

    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string? NationalId { get; set; }
    public string Status { get; set; } = "Active";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public ICollection<Loan> Loans { get; set; } = new List<Loan>();
    public ICollection<SavingsAccount> SavingsAccounts { get; set; } = new List<SavingsAccount>();
}
