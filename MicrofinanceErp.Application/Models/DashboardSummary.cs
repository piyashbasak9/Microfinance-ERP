namespace MicrofinanceErp.Application.Models;

public sealed record MetricCard(string Label, decimal Value, string Trend, string Tone);

public sealed record DashboardSummary(
    decimal ActiveMembers,
    decimal SavingsBalance,
    decimal OutstandingLoans,
    decimal? TodayCollections,
    decimal? OverdueAmount,
    decimal? PortfolioAtRisk,
    IReadOnlyList<MetricCard> Metrics,
    IReadOnlyList<DashboardMember> RecentMembers,
    IReadOnlyList<DashboardLoan> RecentLoans);

public sealed record DashboardMember(int Id, string Name, string Status, string Branch);

public sealed record DashboardLoan(int Id, string Member, string Product, decimal Outstanding, string Status);
