using System.Security.Claims;

namespace MicrofinanceErp.Api.Security;

public static class BranchAccess
{
    public static bool TryGetBranchScope(ClaimsPrincipal user, out int? branchId)
    {
        branchId = null;
        if (user.IsInRole(RoleNames.SuperAdmin))
        {
            return true;
        }

        if (!int.TryParse(user.FindFirstValue("branch_id"), out var scopedBranchId) || scopedBranchId <= 0)
        {
            return false;
        }

        branchId = scopedBranchId;
        return true;
    }
}
