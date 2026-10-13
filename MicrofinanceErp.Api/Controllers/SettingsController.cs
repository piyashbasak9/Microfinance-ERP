using MicrofinanceErp.Api.Models;
using Microsoft.AspNetCore.Mvc;

namespace MicrofinanceErp.Api.Controllers;

[ApiController]
[Route("api/v1")]
public class SettingsController : ControllerBase
{
    [HttpGet("settings/system")]
    public ActionResult<ApiEnvelope<object>> GetSystemSettings()
    {
        var settings = new
        {
            applicationName = "Microfinance ERP",
            currency = "BDT",
            timezone = "Asia/Dhaka",
            defaultBranch = "Dhaka Main",
            passwordPolicy = "8+ chars, 1 uppercase, 1 number",
            sessionTimeoutMinutes = 15
        };

        return Ok(new ApiEnvelope<object>(true, "System settings loaded.", settings, null, HttpContext.TraceIdentifier));
    }
}
