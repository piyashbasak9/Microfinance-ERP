using MicrofinanceErp.Api.Models;
using Microsoft.AspNetCore.Mvc;

namespace MicrofinanceErp.Api.Controllers;

[ApiController]
[Route("api/v1")]
public class AccountingController : ControllerBase
{
    [HttpGet("accounting/trial-balance")]
    public ActionResult<ApiEnvelope<object>> GetTrialBalance()
    {
        var entries = new[]
        {
            new { account = "Cash in Hand", debit = 845000m, credit = 0m },
            new { account = "Loans to Members", debit = 3182000m, credit = 0m },
            new { account = "Member Savings", debit = 0m, credit = 4890000m },
            new { account = "Interest Income on Loans", debit = 0m, credit = 125000m }
        };

        return Ok(new ApiEnvelope<object>(true, "Trial balance loaded.", entries, null, HttpContext.TraceIdentifier));
    }
}
