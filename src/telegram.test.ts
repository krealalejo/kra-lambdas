import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SSMClient } from '@aws-sdk/client-ssm'

process.env['TELEGRAM_BOT_TOKEN_PARAM'] = '/test/bot-token'
process.env['TELEGRAM_CHAT_ID_PARAM'] = '/test/chat-id'

import { getSecret, sendTelegram } from './telegram.js'

const secrets: Record<string, string | undefined> = {
  '/test/bot-token': 'token-123',
  '/test/chat-id': '42',
}

describe('telegram', () => {
  const ssmSend = vi.fn()
  const fetchMock = vi.fn()

  beforeEach(() => {
    ssmSend.mockImplementation(async (command: { input: { Name: string } }) => ({
      Parameter: { Value: secrets[command.input.Name] },
    }))
    vi.spyOn(SSMClient.prototype, 'send').mockImplementation(ssmSend)
    fetchMock.mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    ssmSend.mockReset()
    fetchMock.mockReset()
  })

  it('posts the message to the bot sendMessage endpoint with the chat id', async () => {
    await sendTelegram('hello')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string; method: string }]
    expect(url).toBe('https://api.telegram.org/bottoken-123/sendMessage')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toMatchObject({ chat_id: '42', text: 'hello' })
  })

  it('truncates messages longer than the Telegram limit', async () => {
    await sendTelegram('x'.repeat(5000))
    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }]
    expect(JSON.parse(init.body).text).toHaveLength(4096)
  })

  it('caches secrets between calls', async () => {
    await getSecret('/test/bot-token')
    await getSecret('/test/bot-token')
    expect(ssmSend.mock.calls.filter(([c]) => c.input.Name === '/test/bot-token').length).toBeLessThanOrEqual(1)
  })

  it('throws when the Telegram API responds with an error status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 })
    await expect(sendTelegram('hello')).rejects.toThrow('Telegram API responded with status 401')
  })

  it('throws when an SSM parameter has no value', async () => {
    await expect(getSecret('/test/missing')).rejects.toThrow('SSM parameter /test/missing has no value')
  })

  it('throws when the bot token parameter env var is not set', async () => {
    const original = process.env['TELEGRAM_BOT_TOKEN_PARAM']
    delete process.env['TELEGRAM_BOT_TOKEN_PARAM']
    await expect(sendTelegram('hello')).rejects.toThrow('TELEGRAM_BOT_TOKEN_PARAM environment variable is not set')
    process.env['TELEGRAM_BOT_TOKEN_PARAM'] = original
  })

  it('throws when the chat id parameter env var is not set', async () => {
    const original = process.env['TELEGRAM_CHAT_ID_PARAM']
    delete process.env['TELEGRAM_CHAT_ID_PARAM']
    await expect(sendTelegram('hello')).rejects.toThrow('TELEGRAM_CHAT_ID_PARAM environment variable is not set')
    process.env['TELEGRAM_CHAT_ID_PARAM'] = original
  })
})
