using MicrofinanceErp.Api.Models;
using Microsoft.AspNetCore.Mvc;

namespace MicrofinanceErp.Api.Controllers;

[ApiController]
[Route("api/v1")]
public class ReportsController : ControllerBase
{
    [HttpGet("reports/financial")]
    public ActionResult<ApiEnvelope<object>> GetFinancialReports()
    {
        var reports = new[]
        {
            new { name = "Trial Balance", category = "Financial", lastRun = "2026-10-12" },
            new { name = "Income Statement", category = "Financial", lastRun = "2026-10-12" },
            new { name = "Balance Sheet", category = "Financial", lastRun = "2026-10-11" }
        };

        return Ok(new ApiEnvelope<object>(true, "Financial reports loaded.", reports, null, HttpContext.TraceIdentifier));
    }
}
