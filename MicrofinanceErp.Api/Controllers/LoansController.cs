using MicrofinanceErp.Api.Models;
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
            .OrderBy(loan => loan.Id)
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
}
