using MicrofinanceErp.Domain.Entities;

namespace MicrofinanceErp.Domain;

public static class JournalEntryValidator
{
    public static void Validate(IReadOnlyCollection<JournalLine> lines)
    {
        if (lines.Count < 2)
        {
            throw new ArgumentException("A journal entry must contain at least two lines.", nameof(lines));
        }

        if (lines.Any(line =>
                line.Debit < 0m
                || line.Credit < 0m
                || (line.Debit == 0m) == (line.Credit == 0m)))
        {
            throw new ArgumentException("Each journal line must have exactly one positive debit or credit.", nameof(lines));
        }

        if (lines.Sum(line => line.Debit) != lines.Sum(line => line.Credit))
        {
            throw new ArgumentException("Total debits must equal total credits.", nameof(lines));
        }
    }
}
