using MicrofinanceErp.Api.Models;
using MicrofinanceErp.Api.Security;
using MicrofinanceErp.Application.Models;
using MicrofinanceErp.Domain.Entities;
using MicrofinanceErp.Domain.Security;
using MicrofinanceErp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MicrofinanceErp.Api.Controllers;

[ApiController]
[Route("api/v1")]
public class DashboardController : ControllerBase
{
    private readonly MicrofinanceErpDbContext _dbContext;

    public DashboardController(MicrofinanceErpDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet("dashboard/summary")]
    [RequirePermission(AccessControlCatalog.DashboardRead)]
    public async Task<ActionResult<ApiEnvelope<DashboardSummary>>> GetSummary(CancellationToken cancellationToken)
    {
        if (!BranchAccess.TryGetBranchScope(User, out var branchId))
        {
            return Forbid();
        }

        var members = _dbContext.Members.AsNoTracking();
        if (branchId.HasValue)
        {
            members = members.Where(member => member.BranchId == branchId.Value);
        }

        var activeMembers = await members.CountAsync(
            member => member.Status.ToLower() == "active",
            cancellationToken);

        var savingsAccounts = _dbContext.SavingsAccounts
            .AsNoTracking()
            .Where(account => account.Status.ToLower() == "active");
        if (branchId.HasValue)
        {
            savingsAccounts = savingsAccounts.Where(account => account.Member.BranchId == branchId.Value);
        }

        var savingsBalance = await savingsAccounts.SumAsync(account => (decimal?)account.Balance, cancellationToken) ?? 0m;

        var loans = _dbContext.Loans.AsNoTracking();
        if (branchId.HasValue)
        {
            loans = loans.Where(loan => loan.Member.BranchId == branchId.Value);
        }

        var outstandingLoans = await loans
            .Where(loan => loan.Status == LoanStatus.Disbursed || loan.Status == LoanStatus.Overdue)
            .SumAsync(loan => (decimal?)loan.OutstandingBalance, cancellationToken) ?? 0m;

        var recentMembers = await members
            .OrderByDescending(member => member.CreatedAt)
            .Take(5)
            .Select(member => new DashboardMember(
                member.Id,
                member.FirstName + " " + member.LastName,
                member.Status,
                member.Branch.Name))
            .ToListAsync(cancellationToken);

        var recentLoans = await loans
            .Where(loan => loan.Status == LoanStatus.Disbursed || loan.Status == LoanStatus.Overdue)
            .OrderByDescending(loan => loan.CreatedAt)
            .Take(5)
            .Select(loan => new DashboardLoan(
                loan.Id,
                loan.Member.FirstName + " " + loan.Member.LastName,
                loan.ProductName,
                loan.OutstandingBalance,
                loan.Status.ToString()))
            .ToListAsync(cancellationToken);

        var metrics = new[]
        {
            new MetricCard("Active Members", activeMembers, "Current total", "neutral"),
            new MetricCard("Savings Balance", savingsBalance, "Active accounts", "neutral"),
            new MetricCard("Outstanding Loans", outstandingLoans, "Disbursed portfolio", "neutral")
        };
        var summary = new DashboardSummary(
            ActiveMembers: activeMembers,
            SavingsBalance: savingsBalance,
            OutstandingLoans: outstandingLoans,
            TodayCollections: null,
            OverdueAmount: null,
            PortfolioAtRisk: null,
            Metrics: metrics,
            RecentMembers: recentMembers,
            RecentLoans: recentLoans);

        return Ok(new ApiEnvelope<DashboardSummary>(true, "Dashboard summary loaded.", summary, null, HttpContext.TraceIdentifier));
    }
}
