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
public class BranchesController : ControllerBase
{
    private readonly MicrofinanceErpDbContext _dbContext;

    public BranchesController(MicrofinanceErpDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet("branches")]
    [RequirePermission(AccessControlCatalog.BranchesRead)]
    public async Task<ActionResult<ApiEnvelope<object>>> GetBranches(CancellationToken cancellationToken)
    {
        if (!BranchAccess.TryGetBranchScope(User, out var branchId))
        {
            return Forbid();
        }

        var query = _dbContext.Branches
            .AsNoTracking()
            .Where(branch => branch.IsActive);
        if (branchId.HasValue)
        {
            query = query.Where(branch => branch.Id == branchId.Value);
        }

        var branches = await query
            .OrderBy(branch => branch.Id)
            .Select(branch => new
            {
                id = branch.Id,
                name = branch.Name,
                code = branch.Code,
                address = branch.Address,
                isActive = branch.IsActive
            })
            .ToListAsync(cancellationToken);

        return Ok(new ApiEnvelope<object>(true, "Branches loaded.", branches, null, HttpContext.TraceIdentifier));
    }
}
