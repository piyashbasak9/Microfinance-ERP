using MicrofinanceErp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MicrofinanceErp.Infrastructure.Migrations;

[DbContext(typeof(MicrofinanceErpDbContext))]
[Migration("20261017093000_AddMemberUpdatePermission")]
public partial class AddMemberUpdatePermission : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            INSERT INTO "PermissionDefinitions" ("Code", "Description", "Module")
            VALUES ('Members.Update', 'Edit member details and status.', 'Members');

            INSERT INTO "RolePermissions" ("AccessRoleName", "PermissionCode")
            VALUES
                ('Branch Manager', 'Members.Update'),
                ('Field Officer', 'Members.Update'),
                ('Super Admin', 'Members.Update');
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DELETE FROM "RolePermissions"
            WHERE "PermissionCode" = 'Members.Update';

            DELETE FROM "PermissionDefinitions"
            WHERE "Code" = 'Members.Update';
            """);
    }
}
