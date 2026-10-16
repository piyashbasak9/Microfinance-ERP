using MicrofinanceErp.Api.Models;
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
    [Authorize]
    public async Task<ActionResult<ApiEnvelope<object>>> GetBranches(CancellationToken cancellationToken)
    {
        var branches = await _dbContext.Branches
            .AsNoTracking()
            .Where(branch => branch.IsActive)
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
