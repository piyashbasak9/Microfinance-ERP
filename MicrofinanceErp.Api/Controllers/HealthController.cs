using MicrofinanceErp.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MicrofinanceErp.Api.Controllers;

[ApiController]
[Route("api/v1")]
public class HealthController : ControllerBase
{
    [HttpGet("health")]
    [AllowAnonymous]
    public ActionResult<ApiEnvelope<object>> GetHealth()
        => Ok(new ApiEnvelope<object>(true, "API is healthy.", new { status = "ok", time = DateTime.UtcNow },
            TraceId: HttpContext.TraceIdentifier));
}
