import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { SESClient } from '@aws-sdk/client-ses'

// Set env before importing email module (module-level const reads this at import time)
process.env['FROM_EMAIL'] = 'krealalejo@gmail.com'

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

  it('uses FROM_EMAIL as Source and ToAddress', async () => {
    await sendLeadNotification('user@test.com', 'Hello!')
    const cmd = sendMock.mock.calls[0][0] as any
    expect(cmd.input.Source).toBe('krealalejo@gmail.com')
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
})
