using MicrofinanceErp.Domain.Security;

namespace MicrofinanceErp.Api.Security;

public static class RoleNames
{
    public const string SuperAdmin = AccessControlCatalog.SuperAdmin;
    public const string BranchManager = AccessControlCatalog.BranchManager;
    public const string Accountant = AccessControlCatalog.Accountant;
    public const string Cashier = AccessControlCatalog.Cashier;
    public const string FieldOfficer = AccessControlCatalog.FieldOfficer;

    public const string MemberOperators = SuperAdmin + "," + BranchManager + "," + FieldOfficer;
    public const string SavingsOperators = SuperAdmin + "," + BranchManager + "," + Accountant + "," + Cashier;
    public const string LoanOperators = SuperAdmin + "," + BranchManager + "," + FieldOfficer;
    public const string LoanApprovers = SuperAdmin + "," + BranchManager;
    public const string LoanRepaymentOperators = SuperAdmin + "," + BranchManager + "," + Accountant + "," + Cashier;
    public const string AuditReaders = SuperAdmin + "," + BranchManager + "," + Accountant;
    public const string AccountingReaders = SuperAdmin + "," + BranchManager + "," + Accountant;
}
