using MicrofinanceErp.Domain.Entities;
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
    public DbSet<Loan> Loans => Set<Loan>();
    public DbSet<StaffUser> StaffUsers => Set<StaffUser>();

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
            entity.HasIndex(e => e.AccountNumber).IsUnique();
            entity.HasOne(e => e.Member)
                .WithMany(m => m.SavingsAccounts)
                .HasForeignKey(e => e.MemberId)
                .OnDelete(DeleteBehavior.Cascade);
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

        modelBuilder.Entity<StaffUser>(entity =>
        {
            entity.ToTable("StaffUsers");
            entity.HasKey(user => user.Id);
            entity.Property(user => user.Email).IsRequired().HasMaxLength(256);
            entity.Property(user => user.NormalizedEmail).IsRequired().HasMaxLength(256);
            entity.Property(user => user.FullName).IsRequired().HasMaxLength(200);
            entity.Property(user => user.PasswordHash).IsRequired();
            entity.Property(user => user.Role).IsRequired().HasMaxLength(100);
            entity.HasIndex(user => user.NormalizedEmail).IsUnique();
            entity.HasOne<Branch>()
                .WithMany()
                .HasForeignKey(user => user.BranchId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
