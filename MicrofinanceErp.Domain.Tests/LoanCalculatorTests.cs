using FluentAssertions;

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
}
