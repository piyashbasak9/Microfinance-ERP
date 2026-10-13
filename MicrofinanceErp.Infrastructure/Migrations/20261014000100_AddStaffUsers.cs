using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using MicrofinanceErp.Infrastructure.Persistence;

#nullable disable

namespace MicrofinanceErp.Infrastructure.Migrations;

[DbContext(typeof(MicrofinanceErpDbContext))]
[Migration("20261014000100_AddStaffUsers")]
public partial class AddStaffUsers : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "StaffUsers",
            columns: table => new
            {
                Id = table.Column<int>(type: "integer", nullable: false)
                    .Annotation("Npgsql:ValueGenerationStrategy", Npgsql.EntityFrameworkCore.PostgreSQL.Metadata.NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                NormalizedEmail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                FullName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                PasswordHash = table.Column<string>(type: "text", nullable: false),
                Role = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                BranchId = table.Column<int>(type: "integer", nullable: true),
                IsActive = table.Column<bool>(type: "boolean", nullable: false),
                FailedLoginCount = table.Column<int>(type: "integer", nullable: false),
                LockoutEnd = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                LastLoginAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_StaffUsers", user => user.Id);
                table.ForeignKey(
                    name: "FK_StaffUsers_Branches_BranchId",
                    column: user => user.BranchId,
                    principalTable: "Branches",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "IX_StaffUsers_BranchId",
            table: "StaffUsers",
            column: "BranchId");

        migrationBuilder.CreateIndex(
            name: "IX_StaffUsers_NormalizedEmail",
            table: "StaffUsers",
            column: "NormalizedEmail",
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "StaffUsers");
    }
}
