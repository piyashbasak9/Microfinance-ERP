using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MicrofinanceErp.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddStaffSecurityStamp : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "PasswordChangedAt",
                table: "StaffUsers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SecurityStamp",
                table: "StaffUsers",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.Sql(
                "UPDATE \"StaffUsers\" SET \"SecurityStamp\" = REPLACE(gen_random_uuid()::text, '-', '') WHERE \"SecurityStamp\" IS NULL;");

            migrationBuilder.AlterColumn<string>(
                name: "SecurityStamp",
                table: "StaffUsers",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(32)",
                oldMaxLength: 32,
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PasswordChangedAt",
                table: "StaffUsers");

            migrationBuilder.DropColumn(
                name: "SecurityStamp",
                table: "StaffUsers");
        }
    }
}
