using MicrofinanceErp.Api.Models;
using Microsoft.AspNetCore.Mvc;

namespace MicrofinanceErp.Api.Controllers;

[ApiController]
[Route("api/v1")]
public class AuditController : ControllerBase
{
    [HttpGet("audit/logs")]
    public ActionResult<ApiEnvelope<object>> GetAuditLogs()
    {
        var entries = new[]
        {
            new { id = 1, actor = "System", action = "Bootstrap admin created", module = "Authentication", time = DateTime.UtcNow.AddHours(-3), outcome = "Success" },
            new { id = 2, actor = "Ayesha Karim", action = "Approved loan", module = "Loans", time = DateTime.UtcNow.AddHours(-5), outcome = "Success" },
            new { id = 3, actor = "Nabil Rahman", action = "Reconciled collection sheet", module = "Collections", time = DateTime.UtcNow.AddHours(-8), outcome = "Success" },
            new { id = 4, actor = "Rafi Islam", action = "Updated settings", module = "Settings", time = DateTime.UtcNow.AddHours(-12), outcome = "Success" }
        };

        return Ok(new ApiEnvelope<object>(true, "Audit log loaded.", entries, null, HttpContext.TraceIdentifier));
    }
}
