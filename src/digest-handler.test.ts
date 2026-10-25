import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('./telegram.js', () => ({
  sendTelegram: vi.fn().mockResolvedValue(undefined),
  getSecret: vi.fn().mockResolvedValue('gh-token'),
}))
vi.mock('./costs.js', () => ({
  fetchCostSummary: vi.fn(),
  formatCostSummary: vi.fn().mockReturnValue('COSTS'),
}))
vi.mock('./pull-requests.js', () => ({
  fetchOpenPullRequests: vi.fn(),
  formatPullRequests: vi.fn().mockReturnValue('PRS'),
}))

import { handler } from './digest-handler.js'
import { sendTelegram } from './telegram.js'
import { fetchCostSummary } from './costs.js'
import { fetchOpenPullRequests } from './pull-requests.js'

process.env['GITHUB_TOKEN_PARAM'] = '/test/github-token'

const run = () => (handler as any)({}, {}, () => {})

describe('digest-handler', () => {
  afterEach(() => {
    vi.mocked(sendTelegram).mockClear()
    vi.mocked(fetchCostSummary).mockReset()
    vi.mocked(fetchOpenPullRequests).mockReset()
  })

  it('sends one message combining the cost and pull request sections', async () => {
    vi.mocked(fetchCostSummary).mockResolvedValue({ weekTotal: 1, monthToDate: 2, topServices: [] })
    vi.mocked(fetchOpenPullRequests).mockResolvedValue([])

    await run()

    expect(sendTelegram).toHaveBeenCalledTimes(1)
    expect(sendTelegram).toHaveBeenCalledWith('📋 Weekly digest\n\nCOSTS\n\nPRS')
  })

  it('still sends the pull requests when the cost section fails', async () => {
    vi.mocked(fetchCostSummary).mockRejectedValue(new Error('ce down'))
    vi.mocked(fetchOpenPullRequests).mockResolvedValue([])

    await run()

    expect(sendTelegram).toHaveBeenCalledWith('📋 Weekly digest\n\n💰 AWS costs\nUnavailable this week.\n\nPRS')
  })

  it('still sends the costs when the pull request section fails', async () => {
    vi.mocked(fetchCostSummary).mockResolvedValue({ weekTotal: 1, monthToDate: 2, topServices: [] })
    vi.mocked(fetchOpenPullRequests).mockRejectedValue(new Error('github down'))

    await run()

    expect(sendTelegram).toHaveBeenCalledWith(
      '📋 Weekly digest\n\nCOSTS\n\n🔀 Open pull requests\nUnavailable this week.',
    )
  })

  it('marks the pull request section unavailable when the token parameter is not configured', async () => {
    vi.mocked(fetchCostSummary).mockResolvedValue({ weekTotal: 1, monthToDate: 2, topServices: [] })
    const original = process.env['GITHUB_TOKEN_PARAM']
    delete process.env['GITHUB_TOKEN_PARAM']

    await run()

    process.env['GITHUB_TOKEN_PARAM'] = original
    expect(fetchOpenPullRequests).not.toHaveBeenCalled()
    expect(sendTelegram).toHaveBeenCalledWith(
      '📋 Weekly digest\n\nCOSTS\n\n🔀 Open pull requests\nUnavailable this week.',
    )
  })

  it('propagates a failure to deliver the digest itself', async () => {
    vi.mocked(fetchCostSummary).mockResolvedValue({ weekTotal: 1, monthToDate: 2, topServices: [] })
    vi.mocked(fetchOpenPullRequests).mockResolvedValue([])
    vi.mocked(sendTelegram).mockRejectedValueOnce(new Error('Telegram down'))

    await expect(run()).rejects.toThrow('Telegram down')
  })
})
