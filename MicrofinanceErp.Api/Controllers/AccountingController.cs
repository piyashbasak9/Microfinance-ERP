using MicrofinanceErp.Api.Models;
using MicrofinanceErp.Api.Security;
using MicrofinanceErp.Domain.Security;
using MicrofinanceErp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MicrofinanceErp.Api.Controllers;

[ApiController]
[Route("api/v1")]
public class AccountingController : ControllerBase
{
    private readonly MicrofinanceErpDbContext _dbContext;

    public AccountingController(MicrofinanceErpDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet("accounting/trial-balance")]
    [RequirePermission(AccessControlCatalog.AccountingRead)]
    public async Task<ActionResult<ApiEnvelope<object>>> GetTrialBalance(CancellationToken cancellationToken)
    {
        if (!BranchAccess.TryGetBranchScope(User, out var branchId))
        {
            return Forbid();
        }

        var query = _dbContext.JournalLines.AsNoTracking();
        if (branchId.HasValue)
        {
            query = query.Where(line => line.JournalEntry.BranchId == branchId.Value);
        }

        var accounts = await query
            .GroupBy(line => new
            {
                line.ChartOfAccountId,
                line.Account.Code,
                line.Account.Name,
                line.Account.AccountType
            })
            .Select(group => new
            {
                id = group.Key.ChartOfAccountId,
                code = group.Key.Code,
                account = group.Key.Name,
                accountType = group.Key.AccountType,
                debit = group.Sum(line => line.Debit),
                credit = group.Sum(line => line.Credit)
            })
            .OrderBy(account => account.code)
            .ToListAsync(cancellationToken);

        var result = new
        {
            accounts,
            totalDebits = accounts.Sum(account => account.debit),
            totalCredits = accounts.Sum(account => account.credit),
            isBalanced = accounts.Sum(account => account.debit) == accounts.Sum(account => account.credit)
        };
        return Ok(new ApiEnvelope<object>(true, "Trial balance loaded.", result, null, HttpContext.TraceIdentifier));
    }
}
