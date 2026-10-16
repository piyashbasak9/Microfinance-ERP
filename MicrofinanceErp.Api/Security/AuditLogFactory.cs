using System.Security.Claims;
using MicrofinanceErp.Domain.Entities;

namespace MicrofinanceErp.Api.Security;

public static class AuditLogFactory
{
    public static AuditLog Create(
        ClaimsPrincipal user,
        int branchId,
        string action,
        string entityType,
        string entityId,
        string outcome = "Success")
        => new()
        {
            ActorUserId = int.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var actorUserId)
                ? actorUserId
                : null,
            ActorName = user.FindFirstValue(ClaimTypes.Name) ?? "Unknown user",
            BranchId = branchId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            Outcome = outcome,
            CreatedAt = DateTime.UtcNow
        };

    public static AuditLog Create(
        StaffUser user,
        string action,
        string outcome = "Success")
        => new()
        {
            ActorUserId = user.Id,
            ActorName = user.FullName,
            BranchId = user.BranchId,
            Action = action,
            EntityType = "Authentication",
            EntityId = user.Id.ToString(),
            Outcome = outcome,
            CreatedAt = DateTime.UtcNow
        };

    public static AuditLog CreateAnonymousSignInFailure()
        => new()
        {
            ActorName = "Unknown user",
            Action = "Sign-in rejected",
            EntityType = "Authentication",
            EntityId = string.Empty,
            Outcome = "Failure",
            CreatedAt = DateTime.UtcNow
        };
}
