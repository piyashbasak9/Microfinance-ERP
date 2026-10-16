using MicrofinanceErp.Api.Models;
using MicrofinanceErp.Api.Security;
using MicrofinanceErp.Domain.Security;
using Microsoft.AspNetCore.Mvc;

namespace MicrofinanceErp.Api.Controllers;

[ApiController]
[Route("api/v1")]
public class SettingsController : ControllerBase
{
    [HttpGet("settings/system")]
    [RequirePermission(AccessControlCatalog.SettingsRead)]
    public ActionResult<ApiEnvelope<object>> GetSystemSettings()
    {
        var settings = new
        {
            applicationName = "Microfinance ERP",
            currency = "BDT",
            timezone = "Asia/Dhaka",
            defaultBranch = "Dhaka Main",
            passwordPolicy = "At least 12 characters with uppercase, lowercase, number, and symbol",
            sessionTimeoutMinutes = 15
        };

        return Ok(new ApiEnvelope<object>(true, "System settings loaded.", settings, null, HttpContext.TraceIdentifier));
    }
}
