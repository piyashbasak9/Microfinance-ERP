using MicrofinanceErp.Domain.Entities;

namespace MicrofinanceErp.Domain;

public sealed record LoanInstallmentAllocation(
    long InstallmentId,
    decimal PrincipalAmount,
    decimal InterestAmount);

public static class LoanRepaymentAllocator
{
    public static IReadOnlyList<LoanInstallmentAllocation> Allocate(
        IReadOnlyList<LoanInstallment> installments,
        decimal amount)
    {
        if (amount <= 0m || decimal.Round(amount, 2, MidpointRounding.AwayFromZero) != amount)
        {
            throw new ArgumentOutOfRangeException(nameof(amount), "Payment must be positive and have no more than two decimal places.");
        }

        var remaining = amount;
        var allocations = new List<LoanInstallmentAllocation>();
        foreach (var installment in installments.OrderBy(item => item.InstallmentNumber))
        {
            var interestDue = installment.InterestDue - installment.InterestPaid;
            var principalDue = installment.PrincipalDue - installment.PrincipalPaid;
            if (interestDue < 0m || principalDue < 0m)
            {
                throw new InvalidOperationException($"Installment {installment.Id} has paid amounts exceeding its schedule.");
            }

            var interestPaid = Math.Min(remaining, interestDue);
            remaining -= interestPaid;
            var principalPaid = Math.Min(remaining, principalDue);
            remaining -= principalPaid;
            if (interestPaid != 0m || principalPaid != 0m)
            {
                allocations.Add(new LoanInstallmentAllocation(installment.Id, principalPaid, interestPaid));
            }
        }

        if (remaining != 0m)
        {
            throw new InvalidOperationException("Payment exceeds the unpaid scheduled balance.");
        }

        return allocations;
    }
}
