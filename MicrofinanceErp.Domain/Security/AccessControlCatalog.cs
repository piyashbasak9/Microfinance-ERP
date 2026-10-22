using MicrofinanceErp.Domain.Entities;

namespace MicrofinanceErp.Domain.Security;

public static class AccessControlCatalog
{
    public const string SuperAdmin = "Super Admin";
    public const string BranchManager = "Branch Manager";
    public const string Accountant = "Accountant";
    public const string Cashier = "Cashier";
    public const string FieldOfficer = "Field Officer";

    public const string DashboardRead = "Dashboard.Read";
    public const string BranchesRead = "Branches.Read";
    public const string BranchesManage = "Branches.Manage";
    public const string MembersRead = "Members.Read";
    public const string MembersCreate = "Members.Create";
    public const string MembersUpdate = "Members.Update";
    public const string SavingsRead = "Savings.Read";
    public const string SavingsCreateAccount = "Savings.CreateAccount";
    public const string SavingsTransact = "Savings.Transact";
    public const string LoansRead = "Loans.Read";
    public const string LoansCreate = "Loans.Create";
    public const string LoansApprove = "Loans.Approve";
    public const string LoansDisburse = "Loans.Disburse";
    public const string LoansRepay = "Loans.Repay";
    public const string CollectionsRead = "Collections.Read";
    public const string AccountingRead = "Accounting.Read";
    public const string ReportsRead = "Reports.Read";
    public const string AuditRead = "Audit.Read";
    public const string SettingsRead = "Settings.Read";
    public const string UsersManage = "Security.Users.Manage";
    public const string RolesManage = "Security.Roles.Manage";

    public static readonly PermissionDefinition[] Permissions =
    [
        new() { Code = DashboardRead, Module = "Dashboard", Description = "View the dashboard." },
        new() { Code = BranchesRead, Module = "Branches", Description = "View permitted branches." },
        new() { Code = BranchesManage, Module = "Branches", Description = "Create and edit branches." },
        new() { Code = MembersRead, Module = "Members", Description = "View members." },
        new() { Code = MembersCreate, Module = "Members", Description = "Create members." },
        new() { Code = MembersUpdate, Module = "Members", Description = "Edit member details and status." },
        new() { Code = SavingsRead, Module = "Savings", Description = "View savings accounts and transactions." },
        new() { Code = SavingsCreateAccount, Module = "Savings", Description = "Open savings accounts." },
        new() { Code = SavingsTransact, Module = "Savings", Description = "Post savings deposits and withdrawals." },
        new() { Code = LoansRead, Module = "Loans", Description = "View loans, schedules, and payments." },
        new() { Code = LoansCreate, Module = "Loans", Description = "Create loans." },
        new() { Code = LoansApprove, Module = "Loans", Description = "Approve pending loans." },
        new() { Code = LoansDisburse, Module = "Loans", Description = "Disburse approved loans." },
        new() { Code = LoansRepay, Module = "Loans", Description = "Post loan repayments." },
        new() { Code = CollectionsRead, Module = "Collections", Description = "View collection sheets." },
        new() { Code = AccountingRead, Module = "Accounting", Description = "View accounting information." },
        new() { Code = ReportsRead, Module = "Reports", Description = "View reports." },
        new() { Code = AuditRead, Module = "Audit", Description = "View audit logs." },
        new() { Code = SettingsRead, Module = "Settings", Description = "View system settings." },
        new() { Code = UsersManage, Module = "Security", Description = "Manage staff user accounts." },
        new() { Code = RolesManage, Module = "Security", Description = "Manage roles and their permissions." }
    ];

    public static readonly AccessRole[] Roles =
    [
        CreateRole(SuperAdmin, "Unrestricted system administrator.", true),
        CreateRole(BranchManager, "Manages branch operations and approvals.", true),
        CreateRole(Accountant, "Manages accounting and financial operations.", true),
        CreateRole(Cashier, "Posts approved cash and savings transactions.", true),
        CreateRole(FieldOfficer, "Manages member and field loan operations.", true)
    ];

    public static readonly RolePermission[] RolePermissions = BuildRolePermissions();

    private static AccessRole CreateRole(string name, string description, bool isSystemRole)
        => new()
        {
            Name = name,
            NormalizedName = name.ToUpperInvariant(),
            Description = description,
            IsSystemRole = isSystemRole,
            IsActive = true
        };

    private static RolePermission[] BuildRolePermissions()
    {
        var all = Permissions.Select(permission => permission.Code).ToArray();
        var branchManager = new[]
        {
            DashboardRead, BranchesRead, MembersRead, MembersCreate, MembersUpdate, SavingsRead, SavingsCreateAccount,
            SavingsTransact, LoansRead, LoansCreate, LoansApprove, LoansDisburse, LoansRepay,
            CollectionsRead, AccountingRead, ReportsRead, AuditRead, SettingsRead
        };
        var accountant = new[]
        {
            DashboardRead, BranchesRead, SavingsRead, SavingsTransact, LoansRead, LoansRepay,
            CollectionsRead, AccountingRead, ReportsRead, AuditRead
        };
        var cashier = new[]
        {
            DashboardRead, BranchesRead, SavingsRead, SavingsTransact,
            LoansRead, LoansRepay, CollectionsRead
        };
        var fieldOfficer = new[]
        {
            DashboardRead, BranchesRead, MembersRead, MembersCreate, MembersUpdate, SavingsRead, SavingsCreateAccount,
            LoansRead, LoansCreate, CollectionsRead, ReportsRead
        };

        return
        [
            .. Map(SuperAdmin, all),
            .. Map(BranchManager, branchManager),
            .. Map(Accountant, accountant),
            .. Map(Cashier, cashier),
            .. Map(FieldOfficer, fieldOfficer)
        ];
    }

    private static IEnumerable<RolePermission> Map(string roleName, IEnumerable<string> codes)
        => codes.Select(code => new RolePermission { AccessRoleName = roleName, PermissionCode = code });
}
