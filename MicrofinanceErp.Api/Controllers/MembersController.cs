using System.ComponentModel.DataAnnotations;
using MicrofinanceErp.Api.Models;
using MicrofinanceErp.Domain.Entities;
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
                firstName = member.FirstName,
                lastName = member.LastName,
                name = member.FirstName + " " + member.LastName,
                phoneNumber = member.PhoneNumber,
                nationalId = member.NationalId,
                status = member.Status,
                branchId = member.BranchId,
                branch = member.Branch.Name,
                branchCode = member.Branch.Code,
                createdAt = member.CreatedAt,
                updatedAt = member.UpdatedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(new ApiEnvelope<object>(true, "Members loaded.", members, null, HttpContext.TraceIdentifier));
    }

    [HttpGet("members/{memberId:int}")]
    public async Task<ActionResult<ApiEnvelope<object>>> GetMember(int memberId, CancellationToken cancellationToken)
    {
        var member = await _dbContext.Members
            .AsNoTracking()
            .Where(item => item.Id == memberId)
            .Select(item => new
            {
                id = item.Id,
                firstName = item.FirstName,
                lastName = item.LastName,
                name = item.FirstName + " " + item.LastName,
                phoneNumber = item.PhoneNumber,
                nationalId = item.NationalId,
                status = item.Status,
                branchId = item.BranchId,
                branch = item.Branch.Name,
                branchCode = item.Branch.Code,
                createdAt = item.CreatedAt,
                updatedAt = item.UpdatedAt
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (member is null)
        {
            return NotFound(new ApiEnvelope<object>(false, "Member not found.", null, null, HttpContext.TraceIdentifier));
        }

        return Ok(new ApiEnvelope<object>(true, "Member loaded.", member, null, HttpContext.TraceIdentifier));
    }

    [HttpPost("members")]
    public async Task<ActionResult<ApiEnvelope<object>>> CreateMember(
        [FromBody] CreateMemberRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        if (request.BranchId <= 0)
        {
            return BadRequest(new ApiEnvelope<object>(false, "A valid branch is required.", null, null, HttpContext.TraceIdentifier));
        }

        var branchExists = await _dbContext.Branches.AnyAsync(item => item.Id == request.BranchId && item.IsActive, cancellationToken);
        if (!branchExists)
        {
            return BadRequest(new ApiEnvelope<object>(false, "The selected branch is not available.", null, null, HttpContext.TraceIdentifier));
        }

        var normalizedNationalId = string.IsNullOrWhiteSpace(request.NationalId)
            ? null
            : request.NationalId.Trim();

        if (!string.IsNullOrWhiteSpace(normalizedNationalId))
        {
            var duplicate = await _dbContext.Members.AnyAsync(
                member => member.BranchId == request.BranchId && member.NationalId != null && member.NationalId.Trim() == normalizedNationalId,
                cancellationToken);

            if (duplicate)
            {
                return Conflict(new ApiEnvelope<object>(false, "A member with this national ID already exists for the selected branch.", null, null, HttpContext.TraceIdentifier));
            }
        }

        var member = new Member
        {
            BranchId = request.BranchId,
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            PhoneNumber = string.IsNullOrWhiteSpace(request.PhoneNumber) ? null : request.PhoneNumber.Trim(),
            NationalId = normalizedNationalId,
            Status = string.IsNullOrWhiteSpace(request.Status) ? "Active" : request.Status.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Members.Add(member);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var created = await _dbContext.Members
            .AsNoTracking()
            .Where(item => item.Id == member.Id)
            .Select(item => new
            {
                id = item.Id,
                firstName = item.FirstName,
                lastName = item.LastName,
                name = item.FirstName + " " + item.LastName,
                phoneNumber = item.PhoneNumber,
                nationalId = item.NationalId,
                status = item.Status,
                branchId = item.BranchId,
                branch = item.Branch.Name,
                branchCode = item.Branch.Code,
                createdAt = item.CreatedAt
            })
            .SingleAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created, new ApiEnvelope<object>(true, "Member created successfully.", created, null, HttpContext.TraceIdentifier));
    }
}

public sealed class CreateMemberRequest
{
    [Required]
    [StringLength(120, MinimumLength = 2)]
    public string FirstName { get; set; } = string.Empty;

    [Required]
    [StringLength(120, MinimumLength = 2)]
    public string LastName { get; set; } = string.Empty;

    [Range(1, int.MaxValue)]
    public int BranchId { get; set; }

    [StringLength(20)]
    public string? PhoneNumber { get; set; }

    [StringLength(40)]
    public string? NationalId { get; set; }

    [StringLength(50)]
    public string? Status { get; set; }
}
