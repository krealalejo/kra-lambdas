import { describe, it, expect, vi, afterEach } from 'vitest'

import { fetchOpenPullRequests, formatPullRequests } from './pull-requests.js'

const fetchMock = vi.fn()

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body }
}

describe('fetchOpenPullRequests', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('looks up the user and maps their open pull requests', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ login: 'kevin' }))
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              title: 'Bump deps',
              html_url: 'https://github.com/kevin/kra-api/pull/7',
              repository_url: 'https://api.github.com/repos/kevin/kra-api',
              user: { login: 'dependabot[bot]' },
            },
          ],
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchOpenPullRequests('gh-token')

    expect(result).toEqual([
      {
        title: 'Bump deps',
        url: 'https://github.com/kevin/kra-api/pull/7',
        repository: 'kra-api',
        author: 'dependabot[bot]',
      },
    ])
    const [userUrl, userInit] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }]
    expect(userUrl).toBe('https://api.github.com/user')
    expect(userInit.headers['Authorization']).toBe('Bearer gh-token')
    const [searchUrl] = fetchMock.mock.calls[1] as [string]
    expect(searchUrl).toContain(encodeURIComponent('is:pr is:open user:kevin'))
  })

  it('throws when GitHub responds with an error status', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 401))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchOpenPullRequests('bad')).rejects.toThrow('GitHub API responded with status 401 for /user')
  })
})

describe('formatPullRequests', () => {
  it('reports when there are no open pull requests', () => {
    expect(formatPullRequests([])).toBe('🔀 Open pull requests\nNone, all clear.')
  })

  it('lists each pull request with its link', () => {
    const text = formatPullRequests([
      { title: 'Fix bug', url: 'https://github.com/o/r/pull/1', repository: 'r', author: 'kevin' },
    ])
    expect(text).toBe('🔀 Open pull requests (1)\n\n• r: Fix bug (kevin)\nhttps://github.com/o/r/pull/1')
  })
})
