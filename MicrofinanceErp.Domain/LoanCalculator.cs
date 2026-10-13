namespace MicrofinanceErp.Domain;

public sealed record LoanScheduleEntry(
    decimal Principal,
    decimal Interest,
    decimal Total,
    decimal Balance);

public sealed record LoanCalculationResult(
    decimal Principal,
    decimal TotalInterest,
    decimal TotalRepayable,
    decimal Installment,
    decimal PrincipalPart,
    decimal InterestPart,
    IReadOnlyList<LoanScheduleEntry> Schedule);

public static class LoanCalculator
{
    public static LoanCalculationResult CalculateFlatSchedule(
        decimal principal,
        decimal annualRate,
        int installments,
        int installmentsPerYear = 12)
    {
        if (principal <= 0m)
        {
            throw new ArgumentOutOfRangeException(nameof(principal), "Principal must be greater than zero.");
        }

        if (installments <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(installments), "Installments must be greater than zero.");
        }

        if (installmentsPerYear <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(installmentsPerYear), "Installments per year must be greater than zero.");
        }

        var totalInterest = RoundMoney(principal * annualRate * (installments / (decimal)installmentsPerYear));
        var totalRepayable = RoundMoney(principal + totalInterest);
        var installment = RoundMoney(totalRepayable / installments);
        var principalPart = RoundMoney(principal / installments);
        var interestPart = RoundMoney(totalInterest / installments);
        var schedule = new List<LoanScheduleEntry>();

        var remainingPrincipal = principal;
        for (var index = 1; index <= installments; index++)
        {
            var principalPaid = index == installments ? remainingPrincipal : principalPart;
            var interestPaid = index == installments ? RoundMoney(totalRepayable - principal - (schedule.Sum(x => x.Total) + principalPaid)) : interestPart;
            var total = RoundMoney(principalPaid + interestPaid);
            remainingPrincipal = RoundMoney(remainingPrincipal - principalPaid);
            schedule.Add(new LoanScheduleEntry(principalPaid, interestPaid, total, remainingPrincipal));
        }

        return new LoanCalculationResult(
            principal,
            totalInterest,
            totalRepayable,
            installment,
            principalPart,
            interestPart,
            schedule);
    }

    public static LoanCalculationResult CalculateDecliningBalanceSchedule(
        decimal principal,
        decimal annualRate,
        int installments,
        int installmentsPerYear = 12)
    {
        if (principal <= 0m)
        {
            throw new ArgumentOutOfRangeException(nameof(principal), "Principal must be greater than zero.");
        }

        if (installments <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(installments), "Installments must be greater than zero.");
        }

        if (installmentsPerYear <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(installmentsPerYear), "Installments per year must be greater than zero.");
        }

        var ratePerPeriod = annualRate / installmentsPerYear;
        var multiplier = Convert.ToDecimal(Math.Pow((double)(1m + ratePerPeriod), installments));
        var installment = RoundMoney((principal * ratePerPeriod * multiplier) / (multiplier - 1m));

        var balance = principal;
        var totalInterest = 0m;
        var schedule = new List<LoanScheduleEntry>();

        for (var index = 1; index <= installments; index++)
        {
            var interest = RoundMoney(balance * ratePerPeriod);
            var principalPaid = RoundMoney(installment - interest);

            if (index == installments)
            {
                principalPaid = RoundMoney(balance);
            }

            var total = RoundMoney(principalPaid + interest);
            balance = RoundMoney(balance - principalPaid);
            totalInterest += interest;
            schedule.Add(new LoanScheduleEntry(principalPaid, interest, total, balance));
        }

        var totalRepayable = RoundMoney(principal + totalInterest);
        return new LoanCalculationResult(
            principal,
            totalInterest,
            totalRepayable,
            installment,
            RoundMoney(principal / installments),
            RoundMoney(totalInterest / installments),
            schedule);
    }

    private static decimal RoundMoney(decimal value)
        => decimal.Round(value, 2, MidpointRounding.AwayFromZero);
}
