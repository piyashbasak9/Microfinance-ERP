using MicrofinanceErp.Api.Models;
using MicrofinanceErp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MicrofinanceErp.Api.Controllers;

[ApiController]
[Route("api/v1")]
public class MembersController : ControllerBase
{
    private readonly MicrofinanceErpDbContext _dbContext;

    public MembersController(MicrofinanceErpDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet("members")]
    public async Task<ActionResult<ApiEnvelope<object>>> GetMembers(CancellationToken cancellationToken)
    {
        var members = await _dbContext.Members
            .AsNoTracking()
            .OrderBy(member => member.Id)
            .Select(member => new
            {
                id = member.Id,
                name = member.FirstName + " " + member.LastName,
                phoneNumber = member.PhoneNumber,
                status = member.Status,
                branch = member.Branch.Name,
                branchCode = member.Branch.Code,
                createdAt = member.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(new ApiEnvelope<object>(true, "Members loaded.", members, null, HttpContext.TraceIdentifier));
    }
}
