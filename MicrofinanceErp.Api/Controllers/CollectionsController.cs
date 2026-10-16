using MicrofinanceErp.Api.Models;
using MicrofinanceErp.Api.Security;
using MicrofinanceErp.Domain.Security;
using Microsoft.AspNetCore.Mvc;

namespace MicrofinanceErp.Api.Controllers;

[ApiController]
[Route("api/v1")]
public class CollectionsController : ControllerBase
{
    [HttpGet("collections/sheets")]
    [RequirePermission(AccessControlCatalog.CollectionsRead)]
    public ActionResult<ApiEnvelope<object>> GetSheets()
    {
        var sheets = new[]
        {
            new { id = 701, center = "North Center", dueDate = "2026-10-12", officer = "Mizan", collected = 89000m, received = 87500m, status = "Reconciled" },
            new { id = 702, center = "East Center", dueDate = "2026-10-13", officer = "Farhana", collected = 102500m, received = 102500m, status = "Posted" },
            new { id = 703, center = "South Center", dueDate = "2026-10-14", officer = "Nabil", collected = 64000m, received = 62000m, status = "Submitted" }
        };

        return Ok(new ApiEnvelope<object>(true, "Collection sheets loaded.", sheets, null, HttpContext.TraceIdentifier));
    }
}
