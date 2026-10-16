using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace MicrofinanceErp.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAuthenticationLifecycleAndPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AccessRoles",
                columns: table => new
                {
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    NormalizedName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    IsSystemRole = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccessRoles", x => x.Name);
                });

            migrationBuilder.CreateTable(
                name: "PasswordResetTokens",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    StaffUserId = table.Column<int>(type: "integer", nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UsedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PasswordResetTokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PasswordResetTokens_StaffUsers_StaffUserId",
                        column: x => x.StaffUserId,
                        principalTable: "StaffUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PermissionDefinitions",
                columns: table => new
                {
                    Code = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Module = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Description = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PermissionDefinitions", x => x.Code);
                });

            migrationBuilder.CreateTable(
                name: "RefreshTokens",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    StaffUserId = table.Column<int>(type: "integer", nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SecurityStamp = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RevokedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReplacedByTokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RefreshTokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RefreshTokens_StaffUsers_StaffUserId",
                        column: x => x.StaffUserId,
                        principalTable: "StaffUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RolePermissions",
                columns: table => new
                {
                    AccessRoleName = table.Column<string>(type: "character varying(100)", nullable: false),
                    PermissionCode = table.Column<string>(type: "character varying(100)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RolePermissions", x => new { x.AccessRoleName, x.PermissionCode });
                    table.ForeignKey(
                        name: "FK_RolePermissions_AccessRoles_AccessRoleName",
                        column: x => x.AccessRoleName,
                        principalTable: "AccessRoles",
                        principalColumn: "Name",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RolePermissions_PermissionDefinitions_PermissionCode",
                        column: x => x.PermissionCode,
                        principalTable: "PermissionDefinitions",
                        principalColumn: "Code",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.InsertData(
                table: "AccessRoles",
                columns: new[] { "Name", "Description", "IsActive", "IsSystemRole", "NormalizedName" },
                values: new object[,]
                {
                    { "Accountant", "Manages accounting and financial operations.", true, true, "ACCOUNTANT" },
                    { "Branch Manager", "Manages branch operations and approvals.", true, true, "BRANCH MANAGER" },
                    { "Cashier", "Posts approved cash and savings transactions.", true, true, "CASHIER" },
                    { "Field Officer", "Manages member and field loan operations.", true, true, "FIELD OFFICER" },
                    { "Super Admin", "Unrestricted system administrator.", true, true, "SUPER ADMIN" }
                });

            migrationBuilder.InsertData(
                table: "PermissionDefinitions",
                columns: new[] { "Code", "Description", "Module" },
                values: new object[,]
                {
                    { "Accounting.Read", "View accounting information.", "Accounting" },
                    { "Audit.Read", "View audit logs.", "Audit" },
                    { "Branches.Read", "View permitted branches.", "Branches" },
                    { "Collections.Read", "View collection sheets.", "Collections" },
                    { "Dashboard.Read", "View the dashboard.", "Dashboard" },
                    { "Loans.Approve", "Approve pending loans.", "Loans" },
                    { "Loans.Create", "Create loans.", "Loans" },
                    { "Loans.Disburse", "Disburse approved loans.", "Loans" },
                    { "Loans.Read", "View loans, schedules, and payments.", "Loans" },
                    { "Loans.Repay", "Post loan repayments.", "Loans" },
                    { "Members.Create", "Create members.", "Members" },
                    { "Members.Read", "View members.", "Members" },
                    { "Reports.Read", "View reports.", "Reports" },
                    { "Savings.CreateAccount", "Open savings accounts.", "Savings" },
                    { "Savings.Read", "View savings accounts and transactions.", "Savings" },
                    { "Savings.Transact", "Post savings deposits and withdrawals.", "Savings" },
                    { "Security.Roles.Manage", "Manage roles and their permissions.", "Security" },
                    { "Security.Users.Manage", "Manage staff user accounts.", "Security" },
                    { "Settings.Read", "View system settings.", "Settings" }
                });

            migrationBuilder.InsertData(
                table: "RolePermissions",
                columns: new[] { "AccessRoleName", "PermissionCode" },
                values: new object[,]
                {
                    { "Accountant", "Accounting.Read" },
                    { "Accountant", "Audit.Read" },
                    { "Accountant", "Branches.Read" },
                    { "Accountant", "Collections.Read" },
                    { "Accountant", "Dashboard.Read" },
                    { "Accountant", "Loans.Read" },
                    { "Accountant", "Loans.Repay" },
                    { "Accountant", "Reports.Read" },
                    { "Accountant", "Savings.Read" },
                    { "Accountant", "Savings.Transact" },
                    { "Branch Manager", "Accounting.Read" },
                    { "Branch Manager", "Audit.Read" },
                    { "Branch Manager", "Branches.Read" },
                    { "Branch Manager", "Collections.Read" },
                    { "Branch Manager", "Dashboard.Read" },
                    { "Branch Manager", "Loans.Approve" },
                    { "Branch Manager", "Loans.Create" },
                    { "Branch Manager", "Loans.Disburse" },
                    { "Branch Manager", "Loans.Read" },
                    { "Branch Manager", "Loans.Repay" },
                    { "Branch Manager", "Members.Create" },
                    { "Branch Manager", "Members.Read" },
                    { "Branch Manager", "Reports.Read" },
                    { "Branch Manager", "Savings.CreateAccount" },
                    { "Branch Manager", "Savings.Read" },
                    { "Branch Manager", "Savings.Transact" },
                    { "Branch Manager", "Settings.Read" },
                    { "Cashier", "Branches.Read" },
                    { "Cashier", "Collections.Read" },
                    { "Cashier", "Dashboard.Read" },
                    { "Cashier", "Loans.Read" },
                    { "Cashier", "Loans.Repay" },
                    { "Cashier", "Savings.Read" },
                    { "Cashier", "Savings.Transact" },
                    { "Field Officer", "Branches.Read" },
                    { "Field Officer", "Collections.Read" },
                    { "Field Officer", "Dashboard.Read" },
                    { "Field Officer", "Loans.Create" },
                    { "Field Officer", "Loans.Read" },
                    { "Field Officer", "Members.Create" },
                    { "Field Officer", "Members.Read" },
                    { "Field Officer", "Reports.Read" },
                    { "Field Officer", "Savings.CreateAccount" },
                    { "Field Officer", "Savings.Read" },
                    { "Super Admin", "Accounting.Read" },
                    { "Super Admin", "Audit.Read" },
                    { "Super Admin", "Branches.Read" },
                    { "Super Admin", "Collections.Read" },
                    { "Super Admin", "Dashboard.Read" },
                    { "Super Admin", "Loans.Approve" },
                    { "Super Admin", "Loans.Create" },
                    { "Super Admin", "Loans.Disburse" },
                    { "Super Admin", "Loans.Read" },
                    { "Super Admin", "Loans.Repay" },
                    { "Super Admin", "Members.Create" },
                    { "Super Admin", "Members.Read" },
                    { "Super Admin", "Reports.Read" },
                    { "Super Admin", "Savings.CreateAccount" },
                    { "Super Admin", "Savings.Read" },
                    { "Super Admin", "Savings.Transact" },
                    { "Super Admin", "Security.Roles.Manage" },
                    { "Super Admin", "Security.Users.Manage" },
                    { "Super Admin", "Settings.Read" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_StaffUsers_Role",
                table: "StaffUsers",
                column: "Role");

            migrationBuilder.CreateIndex(
                name: "IX_AccessRoles_NormalizedName",
                table: "AccessRoles",
                column: "NormalizedName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PasswordResetTokens_StaffUserId_ExpiresAt",
                table: "PasswordResetTokens",
                columns: new[] { "StaffUserId", "ExpiresAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PasswordResetTokens_TokenHash",
                table: "PasswordResetTokens",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_StaffUserId_ExpiresAt",
                table: "RefreshTokens",
                columns: new[] { "StaffUserId", "ExpiresAt" });

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_TokenHash",
                table: "RefreshTokens",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RolePermissions_PermissionCode",
                table: "RolePermissions",
                column: "PermissionCode");

            migrationBuilder.AddForeignKey(
                name: "FK_StaffUsers_AccessRoles_Role",
                table: "StaffUsers",
                column: "Role",
                principalTable: "AccessRoles",
                principalColumn: "Name",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_StaffUsers_AccessRoles_Role",
                table: "StaffUsers");

            migrationBuilder.DropTable(
                name: "PasswordResetTokens");

            migrationBuilder.DropTable(
                name: "RefreshTokens");

            migrationBuilder.DropTable(
                name: "RolePermissions");

            migrationBuilder.DropTable(
                name: "AccessRoles");

            migrationBuilder.DropTable(
                name: "PermissionDefinitions");

            migrationBuilder.DropIndex(
                name: "IX_StaffUsers_Role",
                table: "StaffUsers");
        }
    }
}
