using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace MicrofinanceErp.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddLoanPayments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_LoanInstallments_Amounts",
                table: "LoanInstallments");

            migrationBuilder.AddColumn<decimal>(
                name: "InterestPaid",
                table: "LoanInstallments",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "PrincipalPaid",
                table: "LoanInstallments",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "LoanPayments",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    LoanId = table.Column<int>(type: "integer", nullable: false),
                    IdempotencyKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PrincipalAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    InterestAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CreatedByUserId = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoanPayments", x => x.Id);
                    table.CheckConstraint("CK_LoanPayments_Amounts", "\"Amount\" > 0 AND \"PrincipalAmount\" >= 0 AND \"InterestAmount\" >= 0 AND \"PrincipalAmount\" + \"InterestAmount\" = \"Amount\"");
                    table.ForeignKey(
                        name: "FK_LoanPayments_Loans_LoanId",
                        column: x => x.LoanId,
                        principalTable: "Loans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.AddCheckConstraint(
                name: "CK_LoanInstallments_Amounts",
                table: "LoanInstallments",
                sql: "\"PrincipalDue\" >= 0 AND \"InterestDue\" >= 0 AND \"TotalDue\" > 0 AND \"BalanceAfter\" >= 0 AND \"PrincipalPaid\" >= 0 AND \"PrincipalPaid\" <= \"PrincipalDue\" AND \"InterestPaid\" >= 0 AND \"InterestPaid\" <= \"InterestDue\"");

            migrationBuilder.CreateIndex(
                name: "IX_LoanPayments_LoanId_CreatedAt",
                table: "LoanPayments",
                columns: new[] { "LoanId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_LoanPayments_LoanId_IdempotencyKey",
                table: "LoanPayments",
                columns: new[] { "LoanId", "IdempotencyKey" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LoanPayments");

            migrationBuilder.DropCheckConstraint(
                name: "CK_LoanInstallments_Amounts",
                table: "LoanInstallments");

            migrationBuilder.DropColumn(
                name: "InterestPaid",
                table: "LoanInstallments");

            migrationBuilder.DropColumn(
                name: "PrincipalPaid",
                table: "LoanInstallments");

            migrationBuilder.AddCheckConstraint(
                name: "CK_LoanInstallments_Amounts",
                table: "LoanInstallments",
                sql: "\"PrincipalDue\" >= 0 AND \"InterestDue\" >= 0 AND \"TotalDue\" > 0 AND \"BalanceAfter\" >= 0");
        }
    }
}
