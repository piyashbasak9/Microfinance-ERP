using FluentAssertions;
using MicrofinanceErp.Domain.Entities;

namespace MicrofinanceErp.Domain.Tests;

public class LoanCalculatorTests
{
    [Fact]
    public void FlatRateSchedule_ShouldMatchWorkedExample()
    {
        // Arrange
        const decimal principal = 50000m;
        const decimal annualRate = 0.24m;
        const int installments = 12;

        // Act
        var schedule = LoanCalculator.CalculateFlatSchedule(principal, annualRate, installments, 12);

        // Assert
        schedule.TotalInterest.Should().BeApproximately(12000m, 0.01m);
        schedule.TotalRepayable.Should().BeApproximately(62000m, 0.01m);
        schedule.Installment.Should().BeApproximately(5166.67m, 0.01m);
        schedule.PrincipalPart.Should().BeApproximately(4166.67m, 0.01m);
        schedule.InterestPart.Should().BeApproximately(1000m, 0.01m);
    }

    [Fact]
    public void DecliningBalanceSchedule_ShouldMatchWorkedExample()
    {
        // Arrange
        const decimal principal = 50000m;
        const decimal annualRate = 0.24m;
        const int installments = 12;

        // Act
        var schedule = LoanCalculator.CalculateDecliningBalanceSchedule(principal, annualRate, installments, 12);

        // Assert
        schedule.TotalInterest.Should().BeApproximately(6735.76m, 0.05m);
        schedule.TotalRepayable.Should().BeApproximately(56735.76m, 0.05m);
        schedule.Installment.Should().BeApproximately(4727.98m, 0.05m);
        schedule.Schedule.First().Interest.Should().BeApproximately(1000m, 0.05m);
        schedule.Schedule.First().Principal.Should().BeApproximately(3727.98m, 0.05m);
    }

    [Fact]
    public void DecliningBalanceSchedule_ShouldReconcilePersistableInstallments()
    {
        var calculation = LoanCalculator.CalculateDecliningBalanceSchedule(12345.67m, 0.14m, 17, 12);

        calculation.Schedule.Should().HaveCount(17);
        calculation.Schedule.Sum(entry => entry.Principal).Should().Be(12345.67m);
        calculation.Schedule.Sum(entry => entry.Total).Should().Be(calculation.TotalRepayable);
        calculation.Schedule.Last().Balance.Should().Be(0m);
    }

    [Fact]
    public void LoanRepaymentAllocator_ShouldApplyInterestThenPrincipalInInstallmentOrder()
    {
        var installments = new[]
        {
            new LoanInstallment { Id = 1, InstallmentNumber = 1, PrincipalDue = 90m, InterestDue = 10m },
            new LoanInstallment { Id = 2, InstallmentNumber = 2, PrincipalDue = 90m, InterestDue = 10m }
        };

        var allocations = LoanRepaymentAllocator.Allocate(installments, 115m);

        allocations.Should().HaveCount(2);
        allocations[0].Should().Be(new LoanInstallmentAllocation(1, 90m, 10m));
        allocations[1].Should().Be(new LoanInstallmentAllocation(2, 5m, 10m));
        allocations.Sum(item => item.PrincipalAmount + item.InterestAmount).Should().Be(115m);
    }

    [Fact]
    public void LoanRepaymentAllocator_ShouldContinueAfterPriorPartialPayments()
    {
        var installments = new[]
        {
            new LoanInstallment
            {
                Id = 1,
                InstallmentNumber = 1,
                PrincipalDue = 90m,
                InterestDue = 10m,
                PrincipalPaid = 20m,
                InterestPaid = 10m
            }
        };

        var allocations = LoanRepaymentAllocator.Allocate(installments, 70m);

        allocations.Should().ContainSingle()
            .Which.Should().Be(new LoanInstallmentAllocation(1, 70m, 0m));
    }

    [Fact]
    public void LoanRepaymentAllocator_ShouldRejectOverpayment()
    {
        var installments = new[]
        {
            new LoanInstallment { Id = 1, InstallmentNumber = 1, PrincipalDue = 90m, InterestDue = 10m }
        };

        var act = () => LoanRepaymentAllocator.Allocate(installments, 100.01m);

        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void JournalEntryValidator_ShouldAcceptBalancedDebitAndCredit()
    {
        var lines = new[]
        {
            new JournalLine { Debit = 250m, Credit = 0m },
            new JournalLine { Debit = 0m, Credit = 250m }
        };

        var act = () => JournalEntryValidator.Validate(lines);

        act.Should().NotThrow();
    }

    [Fact]
    public void JournalEntryValidator_ShouldRejectUnbalancedEntry()
    {
        var lines = new[]
        {
            new JournalLine { Debit = 250m, Credit = 0m },
            new JournalLine { Debit = 0m, Credit = 249m }
        };

        var act = () => JournalEntryValidator.Validate(lines);

        act.Should().Throw<ArgumentException>().WithMessage("*Total debits must equal total credits*");
    }

    [Fact]
    public void JournalEntryValidator_ShouldRejectLineWithBothDebitAndCredit()
    {
        var lines = new[]
        {
            new JournalLine { Debit = 250m, Credit = 1m },
            new JournalLine { Debit = 0m, Credit = 249m }
        };

        var act = () => JournalEntryValidator.Validate(lines);

        act.Should().Throw<ArgumentException>().WithMessage("*exactly one positive debit or credit*");
    }

    [Fact]
    public void FlatRateSchedule_WithZeroRate_ShouldProduceNoInterest()
    {
        var schedule = LoanCalculator.CalculateFlatSchedule(1000m, 0m, 4, 12);

        schedule.TotalInterest.Should().Be(0m);
        schedule.TotalRepayable.Should().Be(1000m);
        schedule.Installment.Should().Be(250m);
        schedule.Schedule.Should().OnlyContain(entry => entry.Interest == 0m);
        schedule.Schedule.Sum(entry => entry.Total).Should().Be(1000m);
    }

    [Fact]
    public void DecliningBalanceSchedule_WithZeroRate_ShouldProduceEqualPrincipalInstallments()
    {
        var schedule = LoanCalculator.CalculateDecliningBalanceSchedule(1000m, 0m, 4, 12);

        schedule.TotalInterest.Should().Be(0m);
        schedule.TotalRepayable.Should().Be(1000m);
        schedule.Installment.Should().Be(250m);
        schedule.Schedule.Should().OnlyContain(entry => entry.Interest == 0m);
        schedule.Schedule.Last().Balance.Should().Be(0m);
    }

    [Fact]
    public void CalculateFlatSchedule_WithNegativeAnnualRate_ShouldThrow()
    {
        var act = () => LoanCalculator.CalculateFlatSchedule(1000m, -0.01m, 12, 12);

        act.Should().Throw<ArgumentOutOfRangeException>();
    }

    [Fact]
    public void CalculateDecliningBalanceSchedule_WithNegativeAnnualRate_ShouldThrow()
    {
        var act = () => LoanCalculator.CalculateDecliningBalanceSchedule(1000m, -0.01m, 12, 12);

        act.Should().Throw<ArgumentOutOfRangeException>();
    }
}
