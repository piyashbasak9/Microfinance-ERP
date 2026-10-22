using MicrofinanceErp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MicrofinanceErp.Infrastructure.Migrations;

[DbContext(typeof(MicrofinanceErpDbContext))]
[Migration("20261017100000_AddBranchManagementPermission")]
public partial class AddBranchManagementPermission : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            INSERT INTO "PermissionDefinitions" ("Code", "Description", "Module")
            VALUES ('Branches.Manage', 'Create and edit branches.', 'Branches');

            INSERT INTO "RolePermissions" ("AccessRoleName", "PermissionCode")
            VALUES ('Super Admin', 'Branches.Manage');
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DELETE FROM "RolePermissions"
            WHERE "PermissionCode" = 'Branches.Manage';

            DELETE FROM "PermissionDefinitions"
            WHERE "Code" = 'Branches.Manage';
            """);
    }
}
