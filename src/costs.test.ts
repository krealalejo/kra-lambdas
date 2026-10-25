import { describe, it, expect, vi, afterEach } from 'vitest'
import { CostExplorerClient } from '@aws-sdk/client-cost-explorer'

import { fetchCostSummary, formatCostSummary } from './costs.js'

function makeResult(groups: Array<[string, string]>) {
  return {
    ResultsByTime: [
      {
        Groups: groups.map(([service, amount]) => ({
          Keys: [service],
          Metrics: { UnblendedCost: { Amount: amount } },
        })),
      },
    ],
  }
}

describe('fetchCostSummary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sums the week and month totals and ranks the top services', async () => {
    const send = vi
      .spyOn(CostExplorerClient.prototype, 'send')
      .mockImplementation(async (command: any) => {
        const start = command.input.TimePeriod.Start as string
        return start === '2026-10-01'
          ? makeResult([['EC2', '10'], ['S3', '2']])
          : makeResult([['EC2', '3'], ['S3', '1'], ['Lambda', '0'], ['SES', '0.5']])
      })

    const summary = await fetchCostSummary(new Date('2026-10-12T08:00:00Z'))

    expect(send).toHaveBeenCalledTimes(2)
    expect(summary.weekTotal).toBeCloseTo(4.5)
    expect(summary.monthToDate).toBeCloseTo(12)
    expect(summary.topServices).toEqual([
      { service: 'EC2', amount: 3 },
      { service: 'S3', amount: 1 },
      { service: 'SES', amount: 0.5 },
    ])
  })

  it('skips the month request on the first day of the month', async () => {
    const send = vi
      .spyOn(CostExplorerClient.prototype, 'send')
      .mockResolvedValue(makeResult([['EC2', '1']]) as any)

    const summary = await fetchCostSummary(new Date('2026-10-01T08:00:00Z'))

    expect(send).toHaveBeenCalledTimes(1)
    expect(summary.monthToDate).toBe(0)
    expect(summary.weekTotal).toBe(1)
  })

  it('tolerates empty responses and groups without keys or metrics', async () => {
    vi.spyOn(CostExplorerClient.prototype, 'send').mockResolvedValueOnce({} as any).mockResolvedValueOnce({
      ResultsByTime: [{ Groups: [{}] }, {}],
    } as any)

    const summary = await fetchCostSummary(new Date('2026-10-12T08:00:00Z'))

    expect(summary.weekTotal).toBe(0)
    expect(summary.monthToDate).toBe(0)
    expect(summary.topServices).toEqual([])
  })
})

describe('formatCostSummary', () => {
  it('lists totals and top services', () => {
    const text = formatCostSummary({
      weekTotal: 4.5,
      monthToDate: 12,
      topServices: [{ service: 'EC2', amount: 3 }],
    })
    expect(text).toBe(
      '💰 AWS costs\nLast 7 days: $4.50\nMonth to date: $12.00\n\nTop services this week:\n• EC2: $3.00',
    )
  })

  it('omits the services list when nothing was spent', () => {
    const text = formatCostSummary({ weekTotal: 0, monthToDate: 0, topServices: [] })
    expect(text).toBe('💰 AWS costs\nLast 7 days: $0.00\nMonth to date: $0.00')
  })
})
