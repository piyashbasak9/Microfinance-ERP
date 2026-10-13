using MicrofinanceErp.Api.Models;
using Microsoft.AspNetCore.Mvc;

namespace MicrofinanceErp.Api.Controllers;

[ApiController]
[Route("api/v1")]
public class SavingsController : ControllerBase
{
    [HttpGet("savings/accounts")]
    public ActionResult<ApiEnvelope<object>> GetAccounts()
    {
        var accounts = new[]
        {
            new { id = 301, accountNumber = "BR01-SV-000101", member = "Rahima Khatun", balance = 98000m, status = "Active" },
            new { id = 302, accountNumber = "BR01-SV-000102", member = "Abul Hasan", balance = 152500m, status = "Active" },
            new { id = 303, accountNumber = "BR01-SV-000103", member = "Shakila Begum", balance = 21500m, status = "Dormant" }
        };

        return Ok(new ApiEnvelope<object>(true, "Savings accounts loaded.", accounts, null, HttpContext.TraceIdentifier));
    }
}
