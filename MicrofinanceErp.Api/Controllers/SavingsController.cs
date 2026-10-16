using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Security.Claims;
using MicrofinanceErp.Api.Models;
using MicrofinanceErp.Api.Security;
using MicrofinanceErp.Domain.Entities;
using MicrofinanceErp.Domain.Security;
using MicrofinanceErp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MicrofinanceErp.Api.Controllers;

[ApiController]
[Route("api/v1")]
public class SavingsController : ControllerBase
{
    private const decimal MaximumMoneyAmount = 9999999999999999.99m;
    private readonly MicrofinanceErpDbContext _dbContext;
    private readonly AccountingPostingService _accountingPostingService;

    public SavingsController(MicrofinanceErpDbContext dbContext, AccountingPostingService accountingPostingService)
    {
        _dbContext = dbContext;
        _accountingPostingService = accountingPostingService;
    }

    [HttpGet("savings/accounts")]
    [RequirePermission(AccessControlCatalog.SavingsRead)]
    public async Task<ActionResult<ApiEnvelope<object>>> GetAccounts(CancellationToken cancellationToken)
    {
        if (!BranchAccess.TryGetBranchScope(User, out var branchId))
        {
            return Forbid();
        }

        var query = _dbContext.SavingsAccounts.AsNoTracking();
        if (branchId.HasValue)
        {
            query = query.Where(account => account.Member.BranchId == branchId.Value);
        }

        var accounts = await query
            .OrderByDescending(account => account.CreatedAt)
            .Select(account => new
            {
                id = account.Id,
                accountNumber = account.AccountNumber,
                memberId = account.MemberId,
                member = account.Member.FirstName + " " + account.Member.LastName,
                productName = account.ProductName,
                currency = account.Currency,
                balance = account.Balance,
                minimumBalance = account.MinimumBalance,
                status = account.Status,
                createdAt = account.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(new ApiEnvelope<object>(true, "Savings accounts loaded.", accounts, null, HttpContext.TraceIdentifier));
    }

    [HttpPost("savings/accounts")]
    [RequirePermission(AccessControlCatalog.SavingsCreateAccount)]
    public async Task<ActionResult<ApiEnvelope<object>>> CreateAccount(
        [FromBody] CreateSavingsAccountRequest request,
        CancellationToken cancellationToken)
    {
        if (!BranchAccess.TryGetBranchScope(User, out var branchId))
        {
            return Forbid();
        }

        var memberQuery = _dbContext.Members
            .AsNoTracking()
            .Where(item => item.Id == request.MemberId);
        if (branchId.HasValue)
        {
            memberQuery = memberQuery.Where(item => item.BranchId == branchId.Value);
        }

        var member = await memberQuery
            .Select(item => new
            {
                item.Id,
                item.BranchId,
                item.Status,
                item.FirstName,
                item.LastName,
                BranchCode = item.Branch.Code
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (member is null)
        {
            return BadRequest(new ApiEnvelope<object>(false, "The selected member does not exist.", null, null, HttpContext.TraceIdentifier));
        }

        if (!string.Equals(member.Status, "Active", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new ApiEnvelope<object>(false, "A savings account can only be opened for an active member.", null, null, HttpContext.TraceIdentifier));
        }

        var now = DateTime.UtcNow;
        var account = new SavingsAccount
        {
            MemberId = member.Id,
            AccountNumber = $"TEMP-{Guid.NewGuid():N}",
            ProductName = request.ProductName.Trim(),
            Currency = "BDT",
            Balance = 0m,
            MinimumBalance = request.MinimumBalance,
            Status = "Active",
            CreatedAt = now
        };

        await using (var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken))
        {
            _dbContext.SavingsAccounts.Add(account);
            await _dbContext.SaveChangesAsync(cancellationToken);
            account.AccountNumber = $"{member.BranchCode}-SV-{account.Id:D6}";
            await _dbContext.SaveChangesAsync(cancellationToken);
            _dbContext.AuditLogs.Add(AuditLogFactory.Create(User, member.BranchId, "Savings account opened", "SavingsAccount", account.Id.ToString()));
            await _dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }

        var result = new
        {
            id = account.Id,
            accountNumber = account.AccountNumber,
            memberId = member.Id,
            member = member.FirstName + " " + member.LastName,
            productName = account.ProductName,
            currency = account.Currency,
            balance = account.Balance,
            minimumBalance = account.MinimumBalance,
            status = account.Status,
            createdAt = account.CreatedAt
        };

        return StatusCode(
            StatusCodes.Status201Created,
            new ApiEnvelope<object>(true, "Savings account opened successfully.", result, null, HttpContext.TraceIdentifier));
    }

    [HttpGet("savings/accounts/{accountId:int}/transactions")]
    [RequirePermission(AccessControlCatalog.SavingsRead)]
    public async Task<ActionResult<ApiEnvelope<object>>> GetTransactions(
        int accountId,
        CancellationToken cancellationToken)
    {
        if (!BranchAccess.TryGetBranchScope(User, out var branchId))
        {
            return Forbid();
        }

        var accountQuery = _dbContext.SavingsAccounts.Where(account => account.Id == accountId);
        if (branchId.HasValue)
        {
            accountQuery = accountQuery.Where(account => account.Member.BranchId == branchId.Value);
        }

        var accountExists = await accountQuery.AnyAsync(cancellationToken);
        if (!accountExists)
        {
            return NotFound(new ApiEnvelope<object>(false, "Savings account not found.", null, null, HttpContext.TraceIdentifier));
        }

        var entriesQuery = _dbContext.SavingsTransactions
            .AsNoTracking()
            .Where(item => item.SavingsAccountId == accountId);
        if (branchId.HasValue)
        {
            entriesQuery = entriesQuery.Where(item => item.SavingsAccount.Member.BranchId == branchId.Value);
        }

        var entries = await entriesQuery
            .OrderByDescending(item => item.CreatedAt)
            .Select(item => new
            {
                id = item.Id,
                type = item.Type,
                amount = item.Amount,
                balanceBefore = item.BalanceBefore,
                balanceAfter = item.BalanceAfter,
                createdAt = item.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(new ApiEnvelope<object>(true, "Savings transactions loaded.", entries, null, HttpContext.TraceIdentifier));
    }

    [HttpPost("savings/accounts/{accountId:int}/transactions")]
    [RequirePermission(AccessControlCatalog.SavingsTransact)]
    public async Task<ActionResult<ApiEnvelope<object>>> CreateTransaction(
        int accountId,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
        [FromBody] CreateSavingsTransactionRequest request,
        CancellationToken cancellationToken)
    {
        if (!BranchAccess.TryGetBranchScope(User, out var branchId))
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(idempotencyKey) || idempotencyKey.Length > 100)
        {
            return BadRequest(new ApiEnvelope<object>(
                false,
                "A unique Idempotency-Key header of at most 100 characters is required.",
                null,
                null,
                HttpContext.TraceIdentifier));
        }

        if (request.Amount > MaximumMoneyAmount || decimal.Round(request.Amount, 2, MidpointRounding.AwayFromZero) != request.Amount)
        {
            return BadRequest(new ApiEnvelope<object>(false, "Amount must be a positive value with no more than two decimal places.", null, null, HttpContext.TraceIdentifier));
        }

        var normalizedType = request.Type.Trim();
        if (!string.Equals(normalizedType, "Deposit", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(normalizedType, "Withdrawal", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new ApiEnvelope<object>(false, "Transaction type must be Deposit or Withdrawal.", null, null, HttpContext.TraceIdentifier));
        }

        normalizedType = normalizedType.Equals("Deposit", StringComparison.OrdinalIgnoreCase)
            ? "Deposit"
            : "Withdrawal";

        await using var dbTransaction = await _dbContext.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);

        var accountQuery = branchId.HasValue
            ? _dbContext.SavingsAccounts.FromSqlInterpolated(
                $"SELECT account.* FROM \"SavingsAccounts\" AS account INNER JOIN \"Members\" AS member ON member.\"Id\" = account.\"MemberId\" WHERE account.\"Id\" = {accountId} AND member.\"BranchId\" = {branchId.Value} FOR UPDATE OF account")
            : _dbContext.SavingsAccounts.FromSqlInterpolated(
                $"SELECT * FROM \"SavingsAccounts\" WHERE \"Id\" = {accountId} FOR UPDATE");
        var account = await accountQuery.SingleOrDefaultAsync(cancellationToken);

        if (account is null)
        {
            return NotFound(new ApiEnvelope<object>(false, "Savings account not found.", null, null, HttpContext.TraceIdentifier));
        }

        var priorTransaction = await _dbContext.SavingsTransactions
            .AsNoTracking()
            .SingleOrDefaultAsync(
                item => item.SavingsAccountId == accountId && item.IdempotencyKey == idempotencyKey,
                cancellationToken);

        if (priorTransaction is not null)
        {
            if (priorTransaction.Type != normalizedType || priorTransaction.Amount != request.Amount)
            {
                return Conflict(new ApiEnvelope<object>(
                    false,
                    "This Idempotency-Key was already used for a different transaction.",
                    null,
                    null,
                    HttpContext.TraceIdentifier));
            }

            await dbTransaction.CommitAsync(cancellationToken);
            return Ok(ToTransactionEnvelope(priorTransaction, "This transaction was already processed."));
        }

        if (!string.Equals(account.Status, "Active", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new ApiEnvelope<object>(false, "Transactions are only allowed on active savings accounts.", null, null, HttpContext.TraceIdentifier));
        }

        var memberStatus = await _dbContext.Members
            .Where(member => member.Id == account.MemberId)
            .Select(member => member.Status)
            .SingleAsync(cancellationToken);

        if (string.Equals(memberStatus, "Suspended", StringComparison.OrdinalIgnoreCase)
            || (normalizedType == "Withdrawal" && !string.Equals(memberStatus, "Active", StringComparison.OrdinalIgnoreCase)))
        {
            return BadRequest(new ApiEnvelope<object>(false, "This transaction is not permitted for the member's current status.", null, null, HttpContext.TraceIdentifier));
        }

        var balanceBefore = account.Balance;
        var balanceAfter = normalizedType == "Deposit"
            ? balanceBefore + request.Amount
            : balanceBefore - request.Amount;

        if (normalizedType == "Withdrawal" && balanceAfter < account.MinimumBalance)
        {
            return BadRequest(new ApiEnvelope<object>(
                false,
                "The withdrawal exceeds the available balance after preserving the minimum balance.",
                new { availableToWithdraw = Math.Max(0m, balanceBefore - account.MinimumBalance) },
                null,
                HttpContext.TraceIdentifier));
        }

        if (balanceAfter > MaximumMoneyAmount)
        {
            return BadRequest(new ApiEnvelope<object>(false, "The resulting balance exceeds the supported account limit.", null, null, HttpContext.TraceIdentifier));
        }

        var now = DateTime.UtcNow;
        account.Balance = balanceAfter;
        account.UpdatedAt = now;

        var entry = new SavingsTransaction
        {
            SavingsAccountId = account.Id,
            Type = normalizedType,
            Amount = request.Amount,
            BalanceBefore = balanceBefore,
            BalanceAfter = balanceAfter,
            IdempotencyKey = idempotencyKey,
            CreatedByUserId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) ? userId : null,
            CreatedAt = now
        };

        _dbContext.SavingsTransactions.Add(entry);
        await _dbContext.SaveChangesAsync(cancellationToken);
        var transactionBranchId = await _dbContext.Members
            .Where(member => member.Id == account.MemberId)
            .Select(member => member.BranchId)
            .SingleAsync(cancellationToken);
        var postingLines = normalizedType == "Deposit"
            ? new[]
            {
                (AccountingPostingService.CashAccountCode, request.Amount, 0m),
                (AccountingPostingService.MemberSavingsAccountCode, 0m, request.Amount)
            }
            : new[]
            {
                (AccountingPostingService.MemberSavingsAccountCode, request.Amount, 0m),
                (AccountingPostingService.CashAccountCode, 0m, request.Amount)
            };
        await _accountingPostingService.PostAsync(
            transactionBranchId,
            "SavingsTransaction",
            entry.Id.ToString(),
            $"Savings {normalizedType.ToLowerInvariant()}",
            now,
            User,
            postingLines,
            cancellationToken);
        _dbContext.AuditLogs.Add(AuditLogFactory.Create(
            User,
            transactionBranchId,
            $"Savings {normalizedType.ToLowerInvariant()} posted",
            "SavingsTransaction",
            entry.Id.ToString()));
        await _dbContext.SaveChangesAsync(cancellationToken);
        await dbTransaction.CommitAsync(cancellationToken);

        return StatusCode(
            StatusCodes.Status201Created,
            ToTransactionEnvelope(entry, $"{normalizedType} posted successfully."));
    }

    private ApiEnvelope<object> ToTransactionEnvelope(SavingsTransaction item, string message)
        => new(
            true,
            message,
            new
            {
                id = item.Id,
                accountId = item.SavingsAccountId,
                type = item.Type,
                amount = item.Amount,
                balanceBefore = item.BalanceBefore,
                balanceAfter = item.BalanceAfter,
                createdAt = item.CreatedAt
            },
            null,
            HttpContext.TraceIdentifier);
}

public sealed class CreateSavingsAccountRequest
{
    [Range(1, int.MaxValue)]
    public int MemberId { get; set; }

    [Required]
    [StringLength(120, MinimumLength = 2)]
    public string ProductName { get; set; } = string.Empty;

    [Range(typeof(decimal), "0", "9999999999999999.99")]
    public decimal MinimumBalance { get; set; }
}

public sealed class CreateSavingsTransactionRequest
{
    [Required]
    [StringLength(20)]
    public string Type { get; set; } = string.Empty;

    [Range(typeof(decimal), "0.01", "9999999999999999.99")]
    public decimal Amount { get; set; }
}
