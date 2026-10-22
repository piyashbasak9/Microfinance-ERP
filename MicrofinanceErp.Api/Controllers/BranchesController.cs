using System.ComponentModel.DataAnnotations;
using MicrofinanceErp.Api.Models;
using MicrofinanceErp.Api.Security;
using MicrofinanceErp.Domain.Entities;
using MicrofinanceErp.Domain.Security;
using MicrofinanceErp.Infrastructure.Persistence;
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
    public async Task<ActionResult<ApiEnvelope<object>>> GetBranches(
        [FromQuery] bool includeInactive,
        CancellationToken cancellationToken)
    {
        if (!BranchAccess.TryGetBranchScope(User, out var branchId))
        {
            return Forbid();
        }

        var query = _dbContext.Branches.AsNoTracking();
        if (!includeInactive || branchId.HasValue)
        {
            query = query.Where(branch => branch.IsActive);
        }
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

    [HttpPost("branches")]
    [RequirePermission(AccessControlCatalog.BranchesManage)]
    public async Task<ActionResult<ApiEnvelope<object>>> CreateBranch(
        [FromBody] SaveBranchRequest request,
        CancellationToken cancellationToken)
    {
        var name = request.Name.Trim();
        var code = request.Code.Trim().ToUpperInvariant();
        if (await _dbContext.Branches.AnyAsync(branch => branch.Code.ToUpper() == code, cancellationToken))
        {
            return Conflict(new ApiEnvelope<object>(false, "A branch with that code already exists.", null, null, HttpContext.TraceIdentifier));
        }

        var branch = new Branch
        {
            Name = name,
            Code = code,
            Address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim(),
            IsActive = request.IsActive,
            CreatedAt = DateTime.UtcNow
        };
        await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        _dbContext.Branches.Add(branch);
        await _dbContext.SaveChangesAsync(cancellationToken);
        _dbContext.AuditLogs.Add(AuditLogFactory.Create(User, branch.Id, "Branch created", "Branch", branch.Id.ToString()));
        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return StatusCode(
            StatusCodes.Status201Created,
            new ApiEnvelope<object>(true, "Branch created.", ToResponse(branch), null, HttpContext.TraceIdentifier));
    }

    [HttpPut("branches/{branchId:int}")]
    [RequirePermission(AccessControlCatalog.BranchesManage)]
    public async Task<ActionResult<ApiEnvelope<object>>> UpdateBranch(
        int branchId,
        [FromBody] SaveBranchRequest request,
        CancellationToken cancellationToken)
    {
        var branch = await _dbContext.Branches.SingleOrDefaultAsync(item => item.Id == branchId, cancellationToken);
        if (branch is null)
        {
            return NotFound(new ApiEnvelope<object>(false, "Branch not found.", null, null, HttpContext.TraceIdentifier));
        }

        var name = request.Name.Trim();
        var code = request.Code.Trim().ToUpperInvariant();
        if (await _dbContext.Branches.AnyAsync(
                item => item.Id != branch.Id && item.Code.ToUpper() == code,
                cancellationToken))
        {
            return Conflict(new ApiEnvelope<object>(false, "A branch with that code already exists.", null, null, HttpContext.TraceIdentifier));
        }

        branch.Name = name;
        branch.Code = code;
        branch.Address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim();
        branch.IsActive = request.IsActive;
        branch.UpdatedAt = DateTime.UtcNow;
        _dbContext.AuditLogs.Add(AuditLogFactory.Create(User, branch.Id, "Branch updated", "Branch", branch.Id.ToString()));
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new ApiEnvelope<object>(true, "Branch updated.", ToResponse(branch), null, HttpContext.TraceIdentifier));
    }

    private static object ToResponse(Branch branch) => new
    {
        id = branch.Id,
        name = branch.Name,
        code = branch.Code,
        address = branch.Address,
        isActive = branch.IsActive
    };
}

public sealed class SaveBranchRequest
{
    [Required]
    [StringLength(200, MinimumLength = 2)]
    public string Name { get; init; } = string.Empty;

    [Required]
    [StringLength(50, MinimumLength = 2)]
    [RegularExpression(@"^[A-Za-z0-9_-]+$")]
    public string Code { get; init; } = string.Empty;

    [StringLength(300)]
    public string? Address { get; init; }

    public bool IsActive { get; init; } = true;
}
