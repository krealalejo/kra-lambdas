import { CostExplorerClient, GetCostAndUsageCommand } from '@aws-sdk/client-cost-explorer';

const TOP_SERVICES_COUNT = 5;
const DAYS_IN_WEEK = 7;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const costExplorer = new CostExplorerClient({ region: 'us-east-1' });

export interface ServiceCost {
  service: string;
  amount: number;
}

export interface CostSummary {
  weekTotal: number;
  monthToDate: number;
  topServices: ServiceCost[];
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function fetchCostsByService(start: Date, end: Date): Promise<ServiceCost[]> {
  if (toIsoDate(start) >= toIsoDate(end)) {
    return [];
  }

  const result = await costExplorer.send(
    new GetCostAndUsageCommand({
      TimePeriod: { Start: toIsoDate(start), End: toIsoDate(end) },
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost'],
      GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
    }),
  );

  const totals = new Map<string, number>();
  for (const period of result.ResultsByTime ?? []) {
    for (const group of period.Groups ?? []) {
      const service = group.Keys?.[0] ?? 'Unknown';
      const amount = Number(group.Metrics?.['UnblendedCost']?.Amount ?? 0);
      totals.set(service, (totals.get(service) ?? 0) + amount);
    }
  }

  return [...totals.entries()].map(([service, amount]) => ({ service, amount }));
}

function sumAmounts(costs: ServiceCost[]): number {
  return costs.reduce((total, cost) => total + cost.amount, 0);
}

export async function fetchCostSummary(today: Date): Promise<CostSummary> {
  const weekStart = new Date(today.getTime() - DAYS_IN_WEEK * MILLISECONDS_PER_DAY);
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  const [weekCosts, monthCosts] = await Promise.all([
    fetchCostsByService(weekStart, today),
    fetchCostsByService(monthStart, today),
  ]);

  return {
    weekTotal: sumAmounts(weekCosts),
    monthToDate: sumAmounts(monthCosts),
    topServices: weekCosts
      .filter((cost) => cost.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, TOP_SERVICES_COUNT),
  };
}

export function formatCostSummary(summary: CostSummary): string {
  const lines = [
    '💰 AWS costs',
    `Last 7 days: $${summary.weekTotal.toFixed(2)}`,
    `Month to date: $${summary.monthToDate.toFixed(2)}`,
  ];

  if (summary.topServices.length > 0) {
    lines.push('', 'Top services this week:');
    for (const { service, amount } of summary.topServices) {
      lines.push(`• ${service}: $${amount.toFixed(2)}`);
    }
  }

  return lines.join('\n');
}
