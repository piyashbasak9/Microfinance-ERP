using MicrofinanceErp.Api.Models;
using MicrofinanceErp.Application.Models;
using Microsoft.AspNetCore.Mvc;

namespace MicrofinanceErp.Api.Controllers;

[ApiController]
[Route("api/v1")]
public class DashboardController : ControllerBase
{
    [HttpGet("dashboard/summary")]
    public ActionResult<ApiEnvelope<DashboardSummary>> GetSummary()
    {
        var summary = DashboardService.GetSummary();
        return Ok(new ApiEnvelope<DashboardSummary>(true, "Dashboard summary loaded.", summary, null, HttpContext.TraceIdentifier));
    }
}
