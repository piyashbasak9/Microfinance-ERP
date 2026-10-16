using MicrofinanceErp.Api.Models;
using MicrofinanceErp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MicrofinanceErp.Api.Controllers;

[ApiController]
[Route("api/v1")]
public class HealthController : ControllerBase
{
    private readonly MicrofinanceErpDbContext _dbContext;
    private readonly IWebHostEnvironment _environment;
    private readonly DateTime _startedAt = DateTime.UtcNow;

    public HealthController(MicrofinanceErpDbContext dbContext, IWebHostEnvironment environment)
    {
        _dbContext = dbContext;
        _environment = environment;
    }

    [HttpGet("health")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiEnvelope<object>>> GetHealth()
    {
        var databaseHealthy = await _dbContext.Database.CanConnectAsync();
        var uptimeSeconds = Math.Max(0, (DateTime.UtcNow - _startedAt).TotalSeconds);

        var payload = new
        {
            status = databaseHealthy ? "ok" : "degraded",
            environment = _environment.EnvironmentName,
            timestampUtc = DateTime.UtcNow,
            uptimeSeconds = Math.Round(uptimeSeconds, 2),
            database = new
            {
                connected = databaseHealthy,
                provider = "Npgsql"
            }
        };

        if (!databaseHealthy)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ApiEnvelope<object>(false, "API is running but database connectivity is degraded.", payload, TraceId: HttpContext.TraceIdentifier));
        }

        return Ok(new ApiEnvelope<object>(true, "API is healthy.", payload, TraceId: HttpContext.TraceIdentifier));
    }

    [HttpGet("health/ready")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiEnvelope<object>>> GetReadiness()
    {
        var databaseHealthy = await _dbContext.Database.CanConnectAsync();
        var payload = new
        {
            ready = databaseHealthy,
            database = new
            {
                connected = databaseHealthy,
                provider = "Npgsql"
            },
            timestampUtc = DateTime.UtcNow
        };

        if (!databaseHealthy)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ApiEnvelope<object>(false, "Service is not ready. Database is unavailable.", payload, TraceId: HttpContext.TraceIdentifier));
        }

        return Ok(new ApiEnvelope<object>(true, "Service is ready.", payload, TraceId: HttpContext.TraceIdentifier));
    }
}
