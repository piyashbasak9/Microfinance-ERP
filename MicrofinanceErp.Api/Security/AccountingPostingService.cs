using System.Security.Claims;
using MicrofinanceErp.Domain;
using MicrofinanceErp.Domain.Entities;
using MicrofinanceErp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MicrofinanceErp.Api.Security;

public sealed class AccountingPostingService
{
    public const string CashAccountCode = "1000";
    public const string LoansReceivableAccountCode = "1200";
    public const string MemberSavingsAccountCode = "2000";
    public const string LoanInterestIncomeAccountCode = "4000";

    private readonly MicrofinanceErpDbContext _dbContext;

    public AccountingPostingService(MicrofinanceErpDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task PostAsync(
        int branchId,
        string sourceType,
        string sourceId,
        string description,
        DateTime postedAt,
        ClaimsPrincipal user,
        IReadOnlyCollection<(string AccountCode, decimal Debit, decimal Credit)> postingLines,
        CancellationToken cancellationToken)
    {
        if (branchId <= 0 || string.IsNullOrWhiteSpace(sourceType) || string.IsNullOrWhiteSpace(sourceId))
        {
            throw new ArgumentException("A branch and source reference are required for journal posting.");
        }

        var existing = await _dbContext.JournalEntries
            .AnyAsync(entry => entry.SourceType == sourceType && entry.SourceId == sourceId, cancellationToken);
        if (existing)
        {
            throw new InvalidOperationException($"A journal entry already exists for {sourceType} {sourceId}.");
        }

        var accountCodes = postingLines.Select(line => line.AccountCode).Distinct().ToArray();
        var accounts = await _dbContext.ChartOfAccounts
            .Where(account => account.IsActive && accountCodes.Contains(account.Code))
            .ToDictionaryAsync(account => account.Code, cancellationToken);
        if (accounts.Count != accountCodes.Length)
        {
            throw new InvalidOperationException("A required system chart-of-account entry is missing or inactive.");
        }

        var lines = postingLines.Select(line => new JournalLine
        {
            Account = accounts[line.AccountCode],
            Debit = line.Debit,
            Credit = line.Credit
        }).ToList();

        JournalEntryValidator.Validate(lines);

        var entry = new JournalEntry
        {
            BranchId = branchId,
            SourceType = sourceType,
            SourceId = sourceId,
            Description = description,
            PostedAt = postedAt,
            CreatedByUserId = int.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) ? userId : null,
            Lines = lines
        };

        _dbContext.JournalEntries.Add(entry);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
