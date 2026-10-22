using System.ComponentModel.DataAnnotations;
using MicrofinanceErp.Api.Models;
using MicrofinanceErp.Api.Security;
using MicrofinanceErp.Domain.Security;
using MicrofinanceErp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MicrofinanceErp.Api.Controllers;

[ApiController]
[Route("api/v1/reports")]
public class ReportsController : ControllerBase
{
    private readonly MicrofinanceErpDbContext _dbContext;

    public ReportsController(MicrofinanceErpDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet("financial")]
    [RequirePermission(AccessControlCatalog.ReportsRead)]
    public ActionResult<ApiEnvelope<object>> GetFinancialReports()
    {
        var reports = new[]
        {
            new { code = "trial-balance", name = "Trial Balance", category = "Financial" },
            new { code = "income-statement", name = "Income Statement", category = "Financial" }
        };

        return Ok(new ApiEnvelope<object>(true, "Available financial reports loaded.", reports, null, HttpContext.TraceIdentifier));
    }

    [HttpPost("financial/run")]
    [RequirePermission(AccessControlCatalog.ReportsRead)]
    public async Task<ActionResult<ApiEnvelope<object>>> RunFinancialReport(
        [FromBody] RunFinancialReportRequest request,
        CancellationToken cancellationToken)
    {
        if (!BranchAccess.TryGetBranchScope(User, out var branchId))
        {
            return Forbid();
        }

        var reportCode = request.ReportCode.Trim().ToLowerInvariant();
        if (reportCode is not ("trial-balance" or "income-statement"))
        {
            return BadRequest(new ApiEnvelope<object>(
                false,
                "The selected report is not supported.",
                null,
                null,
                HttpContext.TraceIdentifier));
        }

        if (request.ToDate is null || request.ToDate == DateOnly.MaxValue)
        {
            return BadRequest(new ApiEnvelope<object>(
                false,
                "A valid report end date is required.",
                null,
                null,
                HttpContext.TraceIdentifier));
        }

        if (reportCode == "income-statement"
            && (request.FromDate is null || request.FromDate > request.ToDate))
        {
            return BadRequest(new ApiEnvelope<object>(
                false,
                "A valid report start date on or before the end date is required.",
                null,
                null,
                HttpContext.TraceIdentifier));
        }

        var endExclusive = request.ToDate.Value.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var journalLines = _dbContext.JournalLines.AsNoTracking()
            .Where(line => line.JournalEntry.PostedAt < endExclusive);
        if (branchId.HasValue)
        {
            journalLines = journalLines.Where(line => line.JournalEntry.BranchId == branchId.Value);
        }

        object report;
        string reportName;
        if (reportCode == "trial-balance")
        {
            var accounts = await journalLines
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

            var totalDebits = accounts.Sum(account => account.debit);
            var totalCredits = accounts.Sum(account => account.credit);
            reportName = "Trial Balance";
            report = new
            {
                reportCode,
                name = reportName,
                fromDate = (DateOnly?)null,
                toDate = request.ToDate,
                branchId,
                accounts,
                totalDebits,
                totalCredits,
                isBalanced = totalDebits == totalCredits
            };
        }
        else
        {
            var start = request.FromDate!.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            var periodLines = _dbContext.JournalLines.AsNoTracking()
                .Where(line => line.JournalEntry.PostedAt >= start
                    && line.JournalEntry.PostedAt < endExclusive
                    && (line.Account.AccountType == "Income" || line.Account.AccountType == "Expense"));
            if (branchId.HasValue)
            {
                periodLines = periodLines.Where(line => line.JournalEntry.BranchId == branchId.Value);
            }

            var accounts = await periodLines
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
                    credit = group.Sum(line => line.Credit),
                    balance = group.Key.AccountType == "Income"
                        ? group.Sum(line => line.Credit) - group.Sum(line => line.Debit)
                        : group.Sum(line => line.Debit) - group.Sum(line => line.Credit)
                })
                .OrderBy(account => account.code)
                .ToListAsync(cancellationToken);

            var totalIncome = accounts
                .Where(account => account.accountType == "Income")
                .Sum(account => account.balance);
            var totalExpenses = accounts
                .Where(account => account.accountType == "Expense")
                .Sum(account => account.balance);
            reportName = "Income Statement";
            report = new
            {
                reportCode,
                name = reportName,
                fromDate = request.FromDate,
                toDate = request.ToDate,
                branchId,
                accounts,
                totalIncome,
                totalExpenses,
                netIncome = totalIncome - totalExpenses
            };
        }

        _dbContext.AuditLogs.Add(AuditLogFactory.Create(
            User,
            branchId,
            $"{reportName} generated",
            "Financial report",
            $"{reportCode}:{request.ToDate:yyyy-MM-dd}"));
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new ApiEnvelope<object>(
            true,
            $"{reportName} generated.",
            report,
            null,
            HttpContext.TraceIdentifier));
    }
}

public sealed class RunFinancialReportRequest
{
    [Required]
    [StringLength(40, MinimumLength = 1)]
    public string ReportCode { get; init; } = string.Empty;

    public DateOnly? FromDate { get; init; }

    public DateOnly? ToDate { get; init; }
}
