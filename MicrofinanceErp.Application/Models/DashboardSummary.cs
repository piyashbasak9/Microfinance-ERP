namespace MicrofinanceErp.Application.Models;

public sealed record MetricCard(string Label, decimal Value, string Trend, string Tone);

public sealed record DashboardSummary(
    decimal ActiveMembers,
    decimal SavingsBalance,
    decimal OutstandingLoans,
    decimal TodayCollections,
    decimal OverdueAmount,
    decimal PortfolioAtRisk,
    IReadOnlyList<MetricCard> Metrics);

public static class DashboardService
{
    public static DashboardSummary GetSummary()
    {
        var metrics = new[]
        {
            new MetricCard("Active Members", 1284m, "+8.4%", "positive"),
            new MetricCard("Savings Balance", 4890000m, "+5.2%", "positive"),
            new MetricCard("Outstanding Loans", 3182000m, "+1.9%", "positive"),
            new MetricCard("PAR 30", 7.4m, "-0.6%", "neutral")
        };

        return new DashboardSummary(
            ActiveMembers: 1284m,
            SavingsBalance: 4890000m,
            OutstandingLoans: 3182000m,
            TodayCollections: 245000m,
            OverdueAmount: 89000m,
            PortfolioAtRisk: 7.4m,
            Metrics: metrics);
    }
}
