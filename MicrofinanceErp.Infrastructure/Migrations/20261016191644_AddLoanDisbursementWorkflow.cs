using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MicrofinanceErp.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddLoanDisbursementWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "DueDate",
                table: "LoanInstallments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "LoanInstallments",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "NotScheduled");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DueDate",
                table: "LoanInstallments");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "LoanInstallments");
        }
    }
}
