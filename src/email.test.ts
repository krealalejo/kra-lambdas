import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { SESClient } from '@aws-sdk/client-ses'

// Set env before importing email module (module-level const reads this at import time)
process.env['FROM_EMAIL'] = 'hi@krealalejo.dev'
process.env['TO_EMAIL'] = 'krealalejo@gmail.com'

import { sendLeadNotification } from './email.js'

describe('sendLeadNotification', () => {
  const sendMock = vi.fn().mockResolvedValue({})

  beforeAll(() => {
    vi.spyOn(SESClient.prototype, 'send').mockImplementation(sendMock)
  })

  afterEach(() => {
    sendMock.mockClear()
  })

  it('calls ses.send once', async () => {
    await sendLeadNotification('user@test.com', 'Hello!')
    expect(sendMock).toHaveBeenCalledTimes(1)
  })

  it('sends FROM hi@krealalejo.dev TO krealalejo@gmail.com', async () => {
    await sendLeadNotification('user@test.com', 'Hello!')
    const cmd = sendMock.mock.calls[0][0] as any
    expect(cmd.input.Source).toBe('hi@krealalejo.dev')
    expect(cmd.input.Destination.ToAddresses).toEqual(['krealalejo@gmail.com'])
  })

  it('sets Subject to Nuevo lead KRA', async () => {
    await sendLeadNotification('user@test.com', 'Hello!')
    const cmd = sendMock.mock.calls[0][0] as any
    expect(cmd.input.Message.Subject.Data).toBe('Nuevo lead KRA')
  })

  it('body text contains email and message in correct format', async () => {
    await sendLeadNotification('user@test.com', 'my message')
    const cmd = sendMock.mock.calls[0][0] as any
    const body = cmd.input.Message.Body.Text.Data as string
    expect(body).toContain('user@test.com')
    expect(body).toContain('my message')
    expect(body).toBe('Email: user@test.com\n\nMensaje:\nmy message')
  })

  it('throws if FROM_EMAIL is not set', async () => {
    const orig = process.env['FROM_EMAIL']
    delete process.env['FROM_EMAIL']
    await expect(sendLeadNotification('a@b.com', 'hi')).rejects.toThrow('FROM_EMAIL environment variable is not set')
    process.env['FROM_EMAIL'] = orig
  })

  it('throws if TO_EMAIL is not set', async () => {
    const orig = process.env['TO_EMAIL']
    delete process.env['TO_EMAIL']
    await expect(sendLeadNotification('a@b.com', 'hi')).rejects.toThrow('TO_EMAIL environment variable is not set')
    process.env['TO_EMAIL'] = orig
  })
})
