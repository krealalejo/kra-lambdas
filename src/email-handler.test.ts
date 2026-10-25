import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { SESClient } from '@aws-sdk/client-ses'
import type { DynamoDBStreamEvent } from 'aws-lambda'

process.env['FROM_EMAIL'] = 'hi@krealalejo.dev'
process.env['TO_EMAIL'] = 'krealalejo@gmail.com'

vi.mock('./telegram.js', () => ({ sendTelegram: vi.fn().mockResolvedValue(undefined) }))

import { handler } from './email-handler.js'
import { sendTelegram } from './telegram.js'

function makeInsertRecord(fields: Record<string, string | undefined>) {
  const newImage: Record<string, { S: string }> = {}
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) {
      newImage[k] = { S: v }
    }
  }
  return {
    eventName: 'INSERT' as const,
    dynamodb: { NewImage: newImage },
  }
}

function makeEvent(records: object[]): DynamoDBStreamEvent {
  return { Records: records } as DynamoDBStreamEvent
}

describe('email-handler', () => {
  const sendMock = vi.fn().mockResolvedValue({})

  beforeAll(() => {
    vi.spyOn(SESClient.prototype, 'send').mockImplementation(sendMock)
  })

  afterEach(() => {
    sendMock.mockClear()
    vi.mocked(sendTelegram).mockClear()
  })

  it('skips non-INSERT records (MODIFY)', async () => {
    const event = makeEvent([{
      eventName: 'MODIFY',
      dynamodb: { NewImage: { email: { S: 'a@b.com' }, message: { S: 'hi' } } },
    }])
    await handler(event, {} as any, () => {})
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('skips non-INSERT records (REMOVE)', async () => {
    const event = makeEvent([{
      eventName: 'REMOVE',
      dynamodb: { OldImage: { email: { S: 'a@b.com' } } },
    }])
    await handler(event, {} as any, () => {})
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('skips records missing email field', async () => {
    const event = makeEvent([makeInsertRecord({ message: 'Hello!' })])
    await handler(event, {} as any, () => {})
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('skips records missing message field', async () => {
    const event = makeEvent([makeInsertRecord({ email: 'user@test.com' })])
    await handler(event, {} as any, () => {})
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('calls ses.send once for valid INSERT with email and message', async () => {
    const event = makeEvent([makeInsertRecord({ email: 'user@test.com', message: 'Hello!' })])
    await handler(event, {} as any, () => {})
    expect(sendMock).toHaveBeenCalledTimes(1)
  })

  it('re-throws when ses.send throws, for ESM retry routing', async () => {
    sendMock.mockRejectedValueOnce(new Error('SES failure'))
    const event = makeEvent([makeInsertRecord({ email: 'user@test.com', message: 'Hello!' })])
    await expect(handler(event, {} as any, () => {})).rejects.toThrow('SES failure')
  })

  it('sends the lead to Telegram after the email', async () => {
    const event = makeEvent([makeInsertRecord({ email: 'user@test.com', message: 'Hello!' })])
    await handler(event, {} as any, () => {})
    expect(sendTelegram).toHaveBeenCalledWith('📬 New KRA lead\n\nEmail: user@test.com\n\nMessage:\nHello!')
  })

  it('does not fail the invocation when Telegram fails', async () => {
    vi.mocked(sendTelegram).mockRejectedValueOnce(new Error('Telegram down'))
    const event = makeEvent([makeInsertRecord({ email: 'user@test.com', message: 'Hello!' })])
    await expect(handler(event, {} as any, () => {})).resolves.toBeUndefined()
  })

  it('does not notify Telegram when the email send fails', async () => {
    sendMock.mockRejectedValueOnce(new Error('SES failure'))
    const event = makeEvent([makeInsertRecord({ email: 'user@test.com', message: 'Hello!' })])
    await expect(handler(event, {} as any, () => {})).rejects.toThrow('SES failure')
    expect(sendTelegram).not.toHaveBeenCalled()
  })

  it('skips INSERT record with no NewImage', async () => {
    const event = makeEvent([{ eventName: 'INSERT', dynamodb: {} }])
    await handler(event, {} as any, () => {})
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('handles an event without Records', async () => {
    const event = {} as DynamoDBStreamEvent
    await expect(handler(event, {} as any, () => {})).resolves.toBeUndefined()
    expect(sendMock).not.toHaveBeenCalled()
  })
})
