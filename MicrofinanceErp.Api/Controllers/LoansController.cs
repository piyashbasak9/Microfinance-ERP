using System.ComponentModel.DataAnnotations;
using MicrofinanceErp.Api.Models;
using MicrofinanceErp.Domain;
using MicrofinanceErp.Domain.Entities;
using MicrofinanceErp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MicrofinanceErp.Api.Controllers;

[ApiController]
[Route("api/v1")]
public class LoansController : ControllerBase
{
    private readonly MicrofinanceErpDbContext _dbContext;

    public LoansController(MicrofinanceErpDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet("loans/portfolio")]
    public async Task<ActionResult<ApiEnvelope<object>>> GetPortfolio(CancellationToken cancellationToken)
    {
        var loans = await _dbContext.Loans
            .AsNoTracking()
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

    [HttpPost("loans")]
    public async Task<ActionResult<ApiEnvelope<object>>> CreateLoan(
        [FromBody] CreateLoanRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        if (request.MemberId <= 0)
        {
            return BadRequest(new ApiEnvelope<object>(false, "A valid member is required.", null, null, HttpContext.TraceIdentifier));
        }

        var memberExists = await _dbContext.Members.AnyAsync(member => member.Id == request.MemberId, cancellationToken);
        if (!memberExists)
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

        if (!Enum.TryParse<LoanStatus>(request.Status, true, out var parsedStatus))
        {
            return BadRequest(new ApiEnvelope<object>(false, "Invalid loan status.", null, null, HttpContext.TraceIdentifier));
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
            OutstandingBalance = calculation.TotalRepayable,
            Status = parsedStatus,
            CreatedAt = DateTime.UtcNow,
            DisbursedAt = parsedStatus == LoanStatus.Disbursed ? DateTime.UtcNow : null,
            UpdatedAt = DateTime.UtcNow
        };

        _dbContext.Loans.Add(loan);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var created = new
        {
            id = loan.Id,
            memberId = loan.MemberId,
            member = loan.Member?.FirstName + " " + loan.Member?.LastName,
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
    [Range(0.01, double.MaxValue)]
    public decimal PrincipalAmount { get; set; }

    [Range(0, double.MaxValue)]
    public decimal InterestRate { get; set; }

    [Required]
    [Range(1, int.MaxValue)]
    public int TenureMonths { get; set; }

    [Required]
    public string Status { get; set; } = "Approved";
}
