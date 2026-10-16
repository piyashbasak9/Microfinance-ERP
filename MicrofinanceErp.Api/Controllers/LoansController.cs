using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Security.Claims;
using MicrofinanceErp.Api.Models;
using MicrofinanceErp.Api.Security;
using MicrofinanceErp.Domain;
using MicrofinanceErp.Domain.Entities;
using MicrofinanceErp.Domain.Security;
using MicrofinanceErp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MicrofinanceErp.Api.Controllers;

[ApiController]
[Route("api/v1")]
public class LoansController : ControllerBase
{
    private const decimal MaximumMoneyAmount = 9999999999999999.99m;
    private readonly MicrofinanceErpDbContext _dbContext;
    private readonly AccountingPostingService _accountingPostingService;

    public LoansController(MicrofinanceErpDbContext dbContext, AccountingPostingService accountingPostingService)
    {
        _dbContext = dbContext;
        _accountingPostingService = accountingPostingService;
    }

    [HttpGet("loans/portfolio")]
    [RequirePermission(AccessControlCatalog.LoansRead)]
    public async Task<ActionResult<ApiEnvelope<object>>> GetPortfolio(CancellationToken cancellationToken)
    {
        if (!BranchAccess.TryGetBranchScope(User, out var branchId))
        {
            return Forbid();
        }

        var query = _dbContext.Loans.AsNoTracking();
        if (branchId.HasValue)
        {
            query = query.Where(loan => loan.Member.BranchId == branchId.Value);
        }

        var loans = await query
            .OrderByDescending(loan => loan.CreatedAt)
            .Select(loan => new
            {
                id = loan.Id,
                member = loan.Member.FirstName + " " + loan.Member.LastName,
                product = loan.ProductName,
                principalAmount = loan.PrincipalAmount,
                interestRate = loan.InterestRate,
                tenureMonths = loan.TenureMonths,
                outstanding = loan.OutstandingBalance,
                status = loan.Status.ToString(),
                createdAt = loan.CreatedAt,
                disbursedAt = loan.DisbursedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(new ApiEnvelope<object>(true, "Loan portfolio loaded.", loans, null, HttpContext.TraceIdentifier));
    }

    [HttpGet("loans/{loanId:int}/schedule")]
    [RequirePermission(AccessControlCatalog.LoansRead)]
    public async Task<ActionResult<ApiEnvelope<object>>> GetSchedule(int loanId, CancellationToken cancellationToken)
    {
        if (!BranchAccess.TryGetBranchScope(User, out var branchId))
        {
            return Forbid();
        }

        var loanQuery = _dbContext.Loans.AsNoTracking().Where(loan => loan.Id == loanId);
        if (branchId.HasValue)
        {
            loanQuery = loanQuery.Where(loan => loan.Member.BranchId == branchId.Value);
        }

        var loanExists = await loanQuery.AnyAsync(cancellationToken);
        if (!loanExists)
        {
            return NotFound(new ApiEnvelope<object>(false, "Loan not found.", null, null, HttpContext.TraceIdentifier));
        }

        var schedule = await _dbContext.LoanInstallments
            .AsNoTracking()
            .Where(installment => installment.LoanId == loanId)
            .OrderBy(installment => installment.InstallmentNumber)
            .Select(installment => new
            {
                installmentNumber = installment.InstallmentNumber,
                principal = installment.PrincipalDue,
                interest = installment.InterestDue,
                total = installment.TotalDue,
                balance = installment.BalanceAfter,
                dueDate = installment.DueDate,
                status = installment.Status,
                principalPaid = installment.PrincipalPaid,
                interestPaid = installment.InterestPaid
            })
            .ToListAsync(cancellationToken);

        return Ok(new ApiEnvelope<object>(true, "Loan repayment schedule loaded.", schedule, null, HttpContext.TraceIdentifier));
    }

    [HttpGet("loans/{loanId:int}/payments")]
    [RequirePermission(AccessControlCatalog.LoansRead)]
    public async Task<ActionResult<ApiEnvelope<object>>> GetPayments(int loanId, CancellationToken cancellationToken)
    {
        if (!BranchAccess.TryGetBranchScope(User, out var branchId))
        {
            return Forbid();
        }

        var loanQuery = _dbContext.Loans.AsNoTracking().Where(loan => loan.Id == loanId);
        if (branchId.HasValue)
        {
            loanQuery = loanQuery.Where(loan => loan.Member.BranchId == branchId.Value);
        }

        if (!await loanQuery.AnyAsync(cancellationToken))
        {
            return NotFound(new ApiEnvelope<object>(false, "Loan not found.", null, null, HttpContext.TraceIdentifier));
        }

        var payments = await _dbContext.LoanPayments
            .AsNoTracking()
            .Where(payment => payment.LoanId == loanId)
            .OrderByDescending(payment => payment.CreatedAt)
            .Select(payment => new
            {
                id = payment.Id,
                amount = payment.Amount,
                principalAmount = payment.PrincipalAmount,
                interestAmount = payment.InterestAmount,
                createdAt = payment.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(new ApiEnvelope<object>(true, "Loan payments loaded.", payments, null, HttpContext.TraceIdentifier));
    }

    [HttpPost("loans/{loanId:int}/approve")]
    [RequirePermission(AccessControlCatalog.LoansApprove)]
    public async Task<ActionResult<ApiEnvelope<object>>> ApproveLoan(int loanId, CancellationToken cancellationToken)
    {
        if (!BranchAccess.TryGetBranchScope(User, out var branchId))
        {
            return Forbid();
        }

        await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        var loanQuery = GetLockedLoanQuery(loanId, branchId);
        var loan = await loanQuery.SingleOrDefaultAsync(cancellationToken);
        if (loan is null)
        {
            return NotFound(new ApiEnvelope<object>(false, "Loan not found.", null, null, HttpContext.TraceIdentifier));
        }

        if (loan.Status != LoanStatus.Pending)
        {
            return Conflict(new ApiEnvelope<object>(false, "Only pending loans can be approved.", null, null, HttpContext.TraceIdentifier));
        }

        loan.Status = LoanStatus.Approved;
        loan.UpdatedAt = DateTime.UtcNow;
        _dbContext.AuditLogs.Add(AuditLogFactory.Create(User, await GetLoanBranchId(loanId, cancellationToken), "Loan approved", "Loan", loan.Id.ToString()));
        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return Ok(new ApiEnvelope<object>(true, "Loan approved.", new { loan.Id, status = loan.Status.ToString() }, null, HttpContext.TraceIdentifier));
    }

    [HttpPost("loans/{loanId:int}/disburse")]
    [RequirePermission(AccessControlCatalog.LoansDisburse)]
    public async Task<ActionResult<ApiEnvelope<object>>> DisburseLoan(int loanId, CancellationToken cancellationToken)
    {
        if (!BranchAccess.TryGetBranchScope(User, out var branchId))
        {
            return Forbid();
        }

        await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        var loan = await GetLockedLoanQuery(loanId, branchId).SingleOrDefaultAsync(cancellationToken);
        if (loan is null)
        {
            return NotFound(new ApiEnvelope<object>(false, "Loan not found.", null, null, HttpContext.TraceIdentifier));
        }

        if (loan.Status != LoanStatus.Approved)
        {
            return Conflict(new ApiEnvelope<object>(false, "Only approved loans can be disbursed.", null, null, HttpContext.TraceIdentifier));
        }

        var installments = await _dbContext.LoanInstallments
            .Where(installment => installment.LoanId == loan.Id)
            .OrderBy(installment => installment.InstallmentNumber)
            .ToListAsync(cancellationToken);
        if (installments.Count != loan.TenureMonths)
        {
            throw new InvalidOperationException($"Loan {loan.Id} has an incomplete repayment schedule.");
        }

        var disbursedAt = DateTime.UtcNow;
        loan.Status = LoanStatus.Disbursed;
        loan.DisbursedAt = disbursedAt;
        loan.UpdatedAt = disbursedAt;
        loan.OutstandingBalance = installments.Sum(installment => installment.TotalDue);

        foreach (var installment in installments)
        {
            installment.DueDate = disbursedAt.AddMonths(installment.InstallmentNumber);
            installment.Status = "Pending";
        }

        var loanBranchId = await GetLoanBranchId(loan.Id, cancellationToken);
        _dbContext.AuditLogs.Add(AuditLogFactory.Create(User, loanBranchId, "Loan disbursed", "Loan", loan.Id.ToString()));
        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return Ok(new ApiEnvelope<object>(
            true,
            "Loan disbursed and repayment schedule activated.",
            new { loan.Id, status = loan.Status.ToString(), loan.DisbursedAt, loan.OutstandingBalance },
            null,
            HttpContext.TraceIdentifier));
    }

    [HttpPost("loans/{loanId:int}/payments")]
    [RequirePermission(AccessControlCatalog.LoansRepay)]
    public async Task<ActionResult<ApiEnvelope<object>>> PostRepayment(
        int loanId,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
        [FromBody] PostLoanRepaymentRequest request,
        CancellationToken cancellationToken)
    {
        if (!BranchAccess.TryGetBranchScope(User, out var branchId))
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(idempotencyKey) || idempotencyKey.Length > 100)
        {
            return BadRequest(new ApiEnvelope<object>(false, "A unique Idempotency-Key header of at most 100 characters is required.", null, null, HttpContext.TraceIdentifier));
        }

        if (request.Amount > MaximumMoneyAmount || decimal.Round(request.Amount, 2, MidpointRounding.AwayFromZero) != request.Amount)
        {
            return BadRequest(new ApiEnvelope<object>(false, "Payment amount must be positive and have no more than two decimal places.", null, null, HttpContext.TraceIdentifier));
        }

        await using var transaction = await _dbContext.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);
        var loan = await GetLockedLoanQuery(loanId, branchId).SingleOrDefaultAsync(cancellationToken);
        if (loan is null)
        {
            return NotFound(new ApiEnvelope<object>(false, "Loan not found.", null, null, HttpContext.TraceIdentifier));
        }

        var priorPayment = await _dbContext.LoanPayments
            .AsNoTracking()
            .SingleOrDefaultAsync(payment => payment.LoanId == loanId && payment.IdempotencyKey == idempotencyKey, cancellationToken);
        if (priorPayment is not null)
        {
            if (priorPayment.Amount != request.Amount)
            {
                return Conflict(new ApiEnvelope<object>(false, "This Idempotency-Key was already used for a different payment.", null, null, HttpContext.TraceIdentifier));
            }

            await transaction.CommitAsync(cancellationToken);
            return Ok(LoanPaymentEnvelope(priorPayment, loan, "This repayment was already recorded."));
        }

        if (loan.Status is not (LoanStatus.Disbursed or LoanStatus.Overdue))
        {
            return Conflict(new ApiEnvelope<object>(false, "Repayments are accepted only for disbursed or overdue loans.", null, null, HttpContext.TraceIdentifier));
        }

        if (request.Amount <= 0m)
        {
            return BadRequest(new ApiEnvelope<object>(false, "Payment amount must be greater than zero.", null, null, HttpContext.TraceIdentifier));
        }

        if (request.Amount > loan.OutstandingBalance)
        {
            return BadRequest(new ApiEnvelope<object>(false, "Payment amount cannot exceed the outstanding loan balance.", null, null, HttpContext.TraceIdentifier));
        }

        var installments = await _dbContext.LoanInstallments
            .Where(installment => installment.LoanId == loan.Id)
            .OrderBy(installment => installment.InstallmentNumber)
            .ToListAsync(cancellationToken);
        if (installments.Count != loan.TenureMonths || installments.Any(installment => installment.DueDate is null))
        {
            throw new InvalidOperationException($"Loan {loan.Id} does not have a complete, activated repayment schedule.");
        }

        var allocations = LoanRepaymentAllocator.Allocate(installments, request.Amount);
        foreach (var allocation in allocations)
        {
            var installment = installments.Single(item => item.Id == allocation.InstallmentId);
            installment.PrincipalPaid += allocation.PrincipalAmount;
            installment.InterestPaid += allocation.InterestAmount;
            var installmentTotalPaid = installment.PrincipalPaid + installment.InterestPaid;
            installment.Status = installmentTotalPaid == installment.TotalDue
                ? "Paid"
                : "PartiallyPaid";
        }

        var principalAmount = allocations.Sum(allocation => allocation.PrincipalAmount);
        var interestAmount = allocations.Sum(allocation => allocation.InterestAmount);
        var now = DateTime.UtcNow;
        var payment = new LoanPayment
        {
            LoanId = loan.Id,
            IdempotencyKey = idempotencyKey,
            Amount = request.Amount,
            PrincipalAmount = principalAmount,
            InterestAmount = interestAmount,
            CreatedByUserId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) ? userId : null,
            CreatedAt = now
        };

        loan.OutstandingBalance -= request.Amount;
        loan.UpdatedAt = now;
        if (loan.OutstandingBalance == 0m)
        {
            loan.Status = LoanStatus.Repaid;
        }

        _dbContext.LoanPayments.Add(payment);
        await _dbContext.SaveChangesAsync(cancellationToken);
        var loanBranchId = await GetLoanBranchId(loan.Id, cancellationToken);
        var postingLines = new List<(string AccountCode, decimal Debit, decimal Credit)>
        {
            (AccountingPostingService.CashAccountCode, payment.Amount, 0m),
            (AccountingPostingService.LoansReceivableAccountCode, 0m, payment.PrincipalAmount)
        };
        if (payment.InterestAmount > 0m)
        {
            postingLines.Add((AccountingPostingService.LoanInterestIncomeAccountCode, 0m, payment.InterestAmount));
        }

        await _accountingPostingService.PostAsync(
            loanBranchId,
            "LoanPayment",
            payment.Id.ToString(),
            "Loan repayment",
            now,
            User,
            postingLines,
            cancellationToken);
        _dbContext.AuditLogs.Add(AuditLogFactory.Create(User, loanBranchId, "Loan repayment posted", "LoanPayment", payment.Id.ToString()));
        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return StatusCode(
            StatusCodes.Status201Created,
            LoanPaymentEnvelope(payment, loan, "Loan repayment posted successfully."));
    }

    [HttpPost("loans")]
    [RequirePermission(AccessControlCatalog.LoansCreate)]
    public async Task<ActionResult<ApiEnvelope<object>>> CreateLoan(
        [FromBody] CreateLoanRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        if (!BranchAccess.TryGetBranchScope(User, out var branchId))
        {
            return Forbid();
        }

        if (request.MemberId <= 0)
        {
            return BadRequest(new ApiEnvelope<object>(false, "A valid member is required.", null, null, HttpContext.TraceIdentifier));
        }

        var memberQuery = _dbContext.Members.Where(member => member.Id == request.MemberId);
        if (branchId.HasValue)
        {
            memberQuery = memberQuery.Where(member => member.BranchId == branchId.Value);
        }

        var memberInfo = await memberQuery
            .Select(member => new
            {
                member.BranchId,
                Name = member.FirstName + " " + member.LastName
            })
            .SingleOrDefaultAsync(cancellationToken);
        if (memberInfo is null)
        {
            return BadRequest(new ApiEnvelope<object>(false, "The selected member does not exist.", null, null, HttpContext.TraceIdentifier));
        }

        if (request.PrincipalAmount <= 0m)
        {
            return BadRequest(new ApiEnvelope<object>(false, "Principal amount must be greater than zero.", null, null, HttpContext.TraceIdentifier));
        }

        if (request.InterestRate < 0m)
        {
            return BadRequest(new ApiEnvelope<object>(false, "Interest rate cannot be negative.", null, null, HttpContext.TraceIdentifier));
        }

        if (request.TenureMonths <= 0)
        {
            return BadRequest(new ApiEnvelope<object>(false, "Loan tenure in months must be greater than zero.", null, null, HttpContext.TraceIdentifier));
        }

        if (string.IsNullOrWhiteSpace(request.ProductName))
        {
            return BadRequest(new ApiEnvelope<object>(false, "Loan product name is required.", null, null, HttpContext.TraceIdentifier));
        }

        if (!Enum.TryParse<LoanStatus>(request.Status, true, out var parsedStatus)
            || parsedStatus != LoanStatus.Pending)
        {
            return BadRequest(new ApiEnvelope<object>(false, "New loans must start in Pending status and follow the approval workflow.", null, null, HttpContext.TraceIdentifier));
        }

        var calculation = LoanCalculator.CalculateDecliningBalanceSchedule(
            request.PrincipalAmount,
            request.InterestRate,
            request.TenureMonths);

        var loan = new Loan
        {
            MemberId = request.MemberId,
            ProductName = request.ProductName.Trim(),
            PrincipalAmount = request.PrincipalAmount,
            InterestRate = request.InterestRate,
            TenureMonths = request.TenureMonths,
            OutstandingBalance = 0m,
            Status = parsedStatus,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await using (var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken))
        {
            _dbContext.Loans.Add(loan);
            await _dbContext.SaveChangesAsync(cancellationToken);
            var installments = calculation.Schedule
                .Select((entry, index) => new LoanInstallment
                {
                    LoanId = loan.Id,
                    InstallmentNumber = index + 1,
                    PrincipalDue = entry.Principal,
                    InterestDue = entry.Interest,
                    TotalDue = entry.Total,
                    BalanceAfter = entry.Balance,
                    Status = "NotScheduled"
                })
                .ToList();
            _dbContext.LoanInstallments.AddRange(installments);
            _dbContext.AuditLogs.Add(AuditLogFactory.Create(User, memberInfo.BranchId, "Loan created", "Loan", loan.Id.ToString()));
            await _dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }

        var created = new
        {
            id = loan.Id,
            memberId = loan.MemberId,
            member = memberInfo.Name,
            product = loan.ProductName,
            principalAmount = loan.PrincipalAmount,
            interestRate = loan.InterestRate,
            tenureMonths = loan.TenureMonths,
            outstanding = loan.OutstandingBalance,
            status = loan.Status.ToString(),
            createdAt = loan.CreatedAt,
            disbursedAt = loan.DisbursedAt,
            calculation = new
            {
                totalInterest = calculation.TotalInterest,
                totalRepayable = calculation.TotalRepayable,
                installment = calculation.Installment,
                schedule = calculation.Schedule.Select(entry => new
                {
                    principal = entry.Principal,
                    interest = entry.Interest,
                    total = entry.Total,
                    balance = entry.Balance
                }).ToList()
            }
        };

        return StatusCode(StatusCodes.Status201Created, new ApiEnvelope<object>(true, "Loan created successfully.", created, null, HttpContext.TraceIdentifier));
    }

    private IQueryable<Loan> GetLockedLoanQuery(int loanId, int? branchId)
        => branchId.HasValue
            ? _dbContext.Loans.FromSqlInterpolated(
                $"SELECT loan.* FROM \"Loans\" AS loan INNER JOIN \"Members\" AS member ON member.\"Id\" = loan.\"MemberId\" WHERE loan.\"Id\" = {loanId} AND member.\"BranchId\" = {branchId.Value} FOR UPDATE OF loan")
            : _dbContext.Loans.FromSqlInterpolated(
                $"SELECT * FROM \"Loans\" WHERE \"Id\" = {loanId} FOR UPDATE");

    private Task<int> GetLoanBranchId(int loanId, CancellationToken cancellationToken)
        => _dbContext.Loans
            .Where(loan => loan.Id == loanId)
            .Select(loan => loan.Member.BranchId)
            .SingleAsync(cancellationToken);

    private ApiEnvelope<object> LoanPaymentEnvelope(LoanPayment payment, Loan loan, string message)
        => new(
            true,
            message,
            new
            {
                id = payment.Id,
                loanId = payment.LoanId,
                amount = payment.Amount,
                principalAmount = payment.PrincipalAmount,
                interestAmount = payment.InterestAmount,
                createdAt = payment.CreatedAt,
                outstandingBalance = loan.OutstandingBalance,
                status = loan.Status.ToString()
            },
            null,
            HttpContext.TraceIdentifier);
}

public sealed class CreateLoanRequest
{
    [Required]
    [Range(1, int.MaxValue)]
    public int MemberId { get; set; }

    [Required]
    [StringLength(120, MinimumLength = 2)]
    public string ProductName { get; set; } = string.Empty;

    [Required]
    [Range(typeof(decimal), "0.01", "9999999999999999.99")]
    public decimal PrincipalAmount { get; set; }

    [Range(typeof(decimal), "0", "1")]
    public decimal InterestRate { get; set; }

    [Required]
    [Range(1, 600)]
    public int TenureMonths { get; set; }

    [Required]
    public string Status { get; set; } = "Pending";
}

public sealed class PostLoanRepaymentRequest
{
    [Range(typeof(decimal), "0.01", "9999999999999999.99")]
    public decimal Amount { get; set; }
}
