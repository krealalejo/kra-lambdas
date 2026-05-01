import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { SESClient } from '@aws-sdk/client-ses'
import type { DynamoDBStreamEvent } from 'aws-lambda'

process.env['FROM_EMAIL'] = 'hi@krealalejo.dev'
process.env['TO_EMAIL'] = 'krealalejo@gmail.com'

import { handler } from './email-handler.js'

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
})
