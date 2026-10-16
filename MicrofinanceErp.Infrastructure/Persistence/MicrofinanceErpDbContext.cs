using MicrofinanceErp.Domain.Entities;
using MicrofinanceErp.Domain.Security;
using Microsoft.EntityFrameworkCore;

namespace MicrofinanceErp.Infrastructure.Persistence;

public class MicrofinanceErpDbContext : DbContext
{
    public MicrofinanceErpDbContext(DbContextOptions<MicrofinanceErpDbContext> options)
        : base(options)
    {
    }

    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<Member> Members => Set<Member>();
    public DbSet<SavingsAccount> SavingsAccounts => Set<SavingsAccount>();
    public DbSet<SavingsTransaction> SavingsTransactions => Set<SavingsTransaction>();
    public DbSet<Loan> Loans => Set<Loan>();
    public DbSet<LoanInstallment> LoanInstallments => Set<LoanInstallment>();
    public DbSet<LoanPayment> LoanPayments => Set<LoanPayment>();
    public DbSet<StaffUser> StaffUsers => Set<StaffUser>();
    public DbSet<AccessRole> AccessRoles => Set<AccessRole>();
    public DbSet<PermissionDefinition> PermissionDefinitions => Set<PermissionDefinition>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<ChartOfAccount> ChartOfAccounts => Set<ChartOfAccount>();
    public DbSet<JournalEntry> JournalEntries => Set<JournalEntry>();
    public DbSet<JournalLine> JournalLines => Set<JournalLine>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Branch>(entity =>
        {
            entity.ToTable("Branches");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Code).IsRequired().HasMaxLength(50);
            entity.Property(e => e.Address).HasMaxLength(300);
            entity.HasIndex(e => e.Code).IsUnique();
        });

        modelBuilder.Entity<Member>(entity =>
        {
            entity.ToTable("Members");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.FirstName).IsRequired().HasMaxLength(120);
            entity.Property(e => e.LastName).IsRequired().HasMaxLength(120);
            entity.Property(e => e.PhoneNumber).HasMaxLength(20);
            entity.Property(e => e.NationalId).HasMaxLength(40);
            entity.Property(e => e.Status).IsRequired().HasMaxLength(50);
            entity.HasIndex(e => new { e.BranchId, e.NationalId }).IsUnique();
            entity.HasOne(e => e.Branch)
                .WithMany(b => b.Members)
                .HasForeignKey(e => e.BranchId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<SavingsAccount>(entity =>
        {
            entity.ToTable("SavingsAccounts");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.AccountNumber).IsRequired().HasMaxLength(50);
            entity.Property(e => e.ProductName).IsRequired().HasMaxLength(120);
            entity.Property(e => e.Currency).IsRequired().HasMaxLength(10);
            entity.Property(e => e.Status).IsRequired().HasMaxLength(50);
            entity.Property(e => e.Balance).HasPrecision(18, 2);
            entity.Property(e => e.MinimumBalance).HasPrecision(18, 2);
            entity.HasIndex(e => e.AccountNumber).IsUnique();
            entity.HasOne(e => e.Member)
                .WithMany(m => m.SavingsAccounts)
                .HasForeignKey(e => e.MemberId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SavingsTransaction>(entity =>
        {
            entity.ToTable("SavingsTransactions", table =>
            {
                table.HasCheckConstraint("CK_SavingsTransactions_Amount", "\"Amount\" > 0");
                table.HasCheckConstraint("CK_SavingsTransactions_Balances", "\"BalanceBefore\" >= 0 AND \"BalanceAfter\" >= 0");
            });
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Type).IsRequired().HasMaxLength(20);
            entity.Property(e => e.Amount).HasPrecision(18, 2);
            entity.Property(e => e.BalanceBefore).HasPrecision(18, 2);
            entity.Property(e => e.BalanceAfter).HasPrecision(18, 2);
            entity.Property(e => e.IdempotencyKey).IsRequired().HasMaxLength(100);
            entity.HasIndex(e => new { e.SavingsAccountId, e.IdempotencyKey }).IsUnique();
            entity.HasIndex(e => new { e.SavingsAccountId, e.CreatedAt });
            entity.HasOne(e => e.SavingsAccount)
                .WithMany(account => account.Transactions)
                .HasForeignKey(e => e.SavingsAccountId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Loan>(entity =>
        {
            entity.ToTable("Loans");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ProductName).IsRequired().HasMaxLength(120);
            entity.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.PrincipalAmount).HasPrecision(18, 2);
            entity.Property(e => e.InterestRate).HasPrecision(8, 2);
            entity.Property(e => e.OutstandingBalance).HasPrecision(18, 2);
            entity.HasOne(e => e.Member)
                .WithMany(m => m.Loans)
                .HasForeignKey(e => e.MemberId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<LoanInstallment>(entity =>
        {
            entity.ToTable("LoanInstallments", table =>
            {
                table.HasCheckConstraint("CK_LoanInstallments_Amounts", "\"PrincipalDue\" >= 0 AND \"InterestDue\" >= 0 AND \"TotalDue\" > 0 AND \"BalanceAfter\" >= 0 AND \"PrincipalPaid\" >= 0 AND \"PrincipalPaid\" <= \"PrincipalDue\" AND \"InterestPaid\" >= 0 AND \"InterestPaid\" <= \"InterestDue\"");
            });
            entity.HasKey(installment => installment.Id);
            entity.Property(installment => installment.PrincipalDue).HasPrecision(18, 2);
            entity.Property(installment => installment.InterestDue).HasPrecision(18, 2);
            entity.Property(installment => installment.TotalDue).HasPrecision(18, 2);
            entity.Property(installment => installment.BalanceAfter).HasPrecision(18, 2);
            entity.Property(installment => installment.PrincipalPaid).HasPrecision(18, 2);
            entity.Property(installment => installment.InterestPaid).HasPrecision(18, 2);
            entity.Property(installment => installment.Status).IsRequired().HasMaxLength(20).HasDefaultValue("NotScheduled");
            entity.HasIndex(installment => new { installment.LoanId, installment.InstallmentNumber }).IsUnique();
            entity.HasOne(installment => installment.Loan)
                .WithMany(loan => loan.Installments)
                .HasForeignKey(installment => installment.LoanId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<LoanPayment>(entity =>
        {
            entity.ToTable("LoanPayments", table =>
            {
                table.HasCheckConstraint("CK_LoanPayments_Amounts", "\"Amount\" > 0 AND \"PrincipalAmount\" >= 0 AND \"InterestAmount\" >= 0 AND \"PrincipalAmount\" + \"InterestAmount\" = \"Amount\"");
            });
            entity.HasKey(payment => payment.Id);
            entity.Property(payment => payment.IdempotencyKey).IsRequired().HasMaxLength(100);
            entity.Property(payment => payment.Amount).HasPrecision(18, 2);
            entity.Property(payment => payment.PrincipalAmount).HasPrecision(18, 2);
            entity.Property(payment => payment.InterestAmount).HasPrecision(18, 2);
            entity.HasIndex(payment => new { payment.LoanId, payment.IdempotencyKey }).IsUnique();
            entity.HasIndex(payment => new { payment.LoanId, payment.CreatedAt });
            entity.HasOne(payment => payment.Loan)
                .WithMany(loan => loan.Payments)
                .HasForeignKey(payment => payment.LoanId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<StaffUser>(entity =>
        {
            entity.ToTable("StaffUsers");
            entity.HasKey(user => user.Id);
            entity.Property(user => user.Email).IsRequired().HasMaxLength(256);
            entity.Property(user => user.NormalizedEmail).IsRequired().HasMaxLength(256);
            entity.Property(user => user.FullName).IsRequired().HasMaxLength(200);
            entity.Property(user => user.PasswordHash).IsRequired();
            entity.Property(user => user.SecurityStamp).IsRequired().HasMaxLength(32);
            entity.Property(user => user.Role).IsRequired().HasMaxLength(100);
            entity.HasIndex(user => user.NormalizedEmail).IsUnique();
            entity.HasOne<AccessRole>()
                .WithMany()
                .HasForeignKey(user => user.Role)
                .HasPrincipalKey(role => role.Name)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Branch>()
                .WithMany()
                .HasForeignKey(user => user.BranchId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<AccessRole>(entity =>
        {
            entity.ToTable("AccessRoles");
            entity.HasKey(role => role.Name);
            entity.Property(role => role.Name).IsRequired().HasMaxLength(100);
            entity.Property(role => role.NormalizedName).IsRequired().HasMaxLength(100);
            entity.Property(role => role.Description).IsRequired().HasMaxLength(300);
            entity.HasIndex(role => role.NormalizedName).IsUnique();
            entity.HasData(AccessControlCatalog.Roles);
        });

        modelBuilder.Entity<PermissionDefinition>(entity =>
        {
            entity.ToTable("PermissionDefinitions");
            entity.HasKey(permission => permission.Code);
            entity.Property(permission => permission.Code).HasMaxLength(100);
            entity.Property(permission => permission.Module).IsRequired().HasMaxLength(80);
            entity.Property(permission => permission.Description).IsRequired().HasMaxLength(240);
            entity.HasData(AccessControlCatalog.Permissions);
        });

        modelBuilder.Entity<RolePermission>(entity =>
        {
            entity.ToTable("RolePermissions");
            entity.HasKey(rolePermission => new { rolePermission.AccessRoleName, rolePermission.PermissionCode });
            entity.HasOne(rolePermission => rolePermission.AccessRole)
                .WithMany(role => role.Permissions)
                .HasForeignKey(rolePermission => rolePermission.AccessRoleName)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(rolePermission => rolePermission.Permission)
                .WithMany()
                .HasForeignKey(rolePermission => rolePermission.PermissionCode)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasData(AccessControlCatalog.RolePermissions);
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.ToTable("RefreshTokens");
            entity.HasKey(token => token.Id);
            entity.Property(token => token.TokenHash).IsRequired().HasMaxLength(64);
            entity.Property(token => token.SecurityStamp).IsRequired().HasMaxLength(32);
            entity.Property(token => token.ReplacedByTokenHash).HasMaxLength(64);
            entity.HasIndex(token => token.TokenHash).IsUnique();
            entity.HasIndex(token => new { token.StaffUserId, token.ExpiresAt });
            entity.HasOne(token => token.StaffUser)
                .WithMany()
                .HasForeignKey(token => token.StaffUserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PasswordResetToken>(entity =>
        {
            entity.ToTable("PasswordResetTokens");
            entity.HasKey(token => token.Id);
            entity.Property(token => token.TokenHash).IsRequired().HasMaxLength(64);
            entity.HasIndex(token => token.TokenHash).IsUnique();
            entity.HasIndex(token => new { token.StaffUserId, token.ExpiresAt });
            entity.HasOne(token => token.StaffUser)
                .WithMany()
                .HasForeignKey(token => token.StaffUserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable("AuditLogs");
            entity.HasKey(log => log.Id);
            entity.Property(log => log.ActorName).IsRequired().HasMaxLength(200);
            entity.Property(log => log.Action).IsRequired().HasMaxLength(120);
            entity.Property(log => log.EntityType).IsRequired().HasMaxLength(80);
            entity.Property(log => log.EntityId).IsRequired().HasMaxLength(80);
            entity.Property(log => log.Outcome).IsRequired().HasMaxLength(20).HasDefaultValue("Success");
            entity.HasIndex(log => new { log.BranchId, log.CreatedAt });
            entity.HasIndex(log => new { log.EntityType, log.EntityId });
            entity.HasOne<Branch>()
                .WithMany()
                .HasForeignKey(log => log.BranchId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ChartOfAccount>(entity =>
        {
            entity.ToTable("ChartOfAccounts");
            entity.HasKey(account => account.Id);
            entity.Property(account => account.Code).IsRequired().HasMaxLength(20);
            entity.Property(account => account.Name).IsRequired().HasMaxLength(120);
            entity.Property(account => account.AccountType).IsRequired().HasMaxLength(20);
            entity.HasIndex(account => account.Code).IsUnique();
            entity.HasData(
                new ChartOfAccount { Id = 1, Code = "1000", Name = "Cash", AccountType = "Asset", IsSystemAccount = true, IsActive = true },
                new ChartOfAccount { Id = 2, Code = "1200", Name = "Loans Receivable", AccountType = "Asset", IsSystemAccount = true, IsActive = true },
                new ChartOfAccount { Id = 3, Code = "2000", Name = "Member Savings", AccountType = "Liability", IsSystemAccount = true, IsActive = true },
                new ChartOfAccount { Id = 4, Code = "4000", Name = "Loan Interest Income", AccountType = "Income", IsSystemAccount = true, IsActive = true });
        });

        modelBuilder.Entity<JournalEntry>(entity =>
        {
            entity.ToTable("JournalEntries");
            entity.HasKey(entry => entry.Id);
            entity.Property(entry => entry.SourceType).IsRequired().HasMaxLength(40);
            entity.Property(entry => entry.SourceId).IsRequired().HasMaxLength(80);
            entity.Property(entry => entry.Description).IsRequired().HasMaxLength(240);
            entity.HasIndex(entry => new { entry.SourceType, entry.SourceId }).IsUnique();
            entity.HasIndex(entry => new { entry.BranchId, entry.PostedAt });
            entity.HasOne<Branch>()
                .WithMany()
                .HasForeignKey(entry => entry.BranchId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<JournalLine>(entity =>
        {
            entity.ToTable("JournalLines", table =>
            {
                table.HasCheckConstraint("CK_JournalLines_Amounts", "\"Debit\" >= 0 AND \"Credit\" >= 0 AND ((\"Debit\" > 0 AND \"Credit\" = 0) OR (\"Credit\" > 0 AND \"Debit\" = 0))");
            });
            entity.HasKey(line => line.Id);
            entity.Property(line => line.Debit).HasPrecision(18, 2);
            entity.Property(line => line.Credit).HasPrecision(18, 2);
            entity.HasIndex(line => new { line.JournalEntryId, line.ChartOfAccountId });
            entity.HasOne(line => line.JournalEntry)
                .WithMany(entry => entry.Lines)
                .HasForeignKey(line => line.JournalEntryId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(line => line.Account)
                .WithMany()
                .HasForeignKey(line => line.ChartOfAccountId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
