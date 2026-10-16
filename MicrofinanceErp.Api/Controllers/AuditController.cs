using MicrofinanceErp.Api.Models;
using MicrofinanceErp.Api.Security;
using MicrofinanceErp.Domain.Security;
using MicrofinanceErp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MicrofinanceErp.Api.Controllers;

[ApiController]
[Route("api/v1")]
public class AuditController : ControllerBase
{
    private readonly MicrofinanceErpDbContext _dbContext;

    public AuditController(MicrofinanceErpDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet("audit/logs")]
    [RequirePermission(AccessControlCatalog.AuditRead)]
    public async Task<ActionResult<ApiEnvelope<object>>> GetAuditLogs(CancellationToken cancellationToken)
    {
        if (!BranchAccess.TryGetBranchScope(User, out var branchId))
        {
            return Forbid();
        }

        var query = _dbContext.AuditLogs.AsNoTracking();
        if (branchId.HasValue)
        {
            query = query.Where(log => log.BranchId == branchId.Value);
        }

        var entries = await query
            .OrderByDescending(log => log.CreatedAt)
            .ThenByDescending(log => log.Id)
            .Take(200)
            .Select(log => new
            {
                id = log.Id,
                actor = log.ActorName,
                action = log.Action,
                module = log.EntityType,
                time = log.CreatedAt,
                outcome = log.Outcome,
                entityId = log.EntityId
            })
            .ToListAsync(cancellationToken);

        return Ok(new ApiEnvelope<object>(true, "Audit log loaded.", entries, null, HttpContext.TraceIdentifier));
    }
}
