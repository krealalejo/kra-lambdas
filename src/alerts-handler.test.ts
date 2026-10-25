import { describe, it, expect, vi, afterEach } from 'vitest'
import type { SNSEvent } from 'aws-lambda'

vi.mock('./telegram.js', () => ({ sendTelegram: vi.fn().mockResolvedValue(undefined) }))

import { formatNotification, handler } from './alerts-handler.js'
import { sendTelegram } from './telegram.js'

function makeEvent(message: string, subject: string | null = null): SNSEvent {
  return { Records: [{ Sns: { Message: message, Subject: subject } }] } as SNSEvent
}

const alarmMessage = JSON.stringify({
  AlarmName: 'kra-email-errors',
  NewStateValue: 'ALARM',
  AlarmDescription: 'Email notifier failed',
  NewStateReason: 'Threshold crossed',
})

describe('formatNotification', () => {
  it('formats a CloudWatch alarm with its state icon, name, description and reason', () => {
    expect(formatNotification(alarmMessage)).toBe(
      '🚨 ALARM: kra-email-errors\n\nEmail notifier failed\n\nThreshold crossed',
    )
  })

  it('uses the OK icon when the alarm recovers', () => {
    const message = JSON.stringify({ AlarmName: 'a', NewStateValue: 'OK' })
    expect(formatNotification(message)).toBe('✅ OK: a')
  })

  it('falls back to a generic icon for unknown states', () => {
    const message = JSON.stringify({ AlarmName: 'a', NewStateValue: 'WEIRD' })
    expect(formatNotification(message)).toBe('📣 WEIRD: a')
  })

  it('reports an unknown state when the alarm has none', () => {
    const message = JSON.stringify({ AlarmName: 'a' })
    expect(formatNotification(message)).toBe('📣 UNKNOWN: a')
  })

  it('forwards plain text messages with their subject', () => {
    expect(formatNotification('Budget exceeded 80%', 'AWS Budgets')).toBe('📣 AWS Budgets\n\nBudget exceeded 80%')
  })

  it('uses a default title for plain text without subject', () => {
    expect(formatNotification('something happened')).toBe('📣 AWS notification\n\nsomething happened')
  })

  it('treats JSON without an AlarmName as plain text', () => {
    expect(formatNotification('{"foo":1}')).toBe('📣 AWS notification\n\n{"foo":1}')
  })
})

describe('alerts-handler', () => {
  afterEach(() => {
    vi.mocked(sendTelegram).mockClear()
  })

  it('sends one Telegram message per SNS record', async () => {
    await handler(makeEvent(alarmMessage), {} as any, () => {})
    expect(sendTelegram).toHaveBeenCalledTimes(1)
  })

  it('re-throws when Telegram fails so SNS retries delivery', async () => {
    vi.mocked(sendTelegram).mockRejectedValueOnce(new Error('Telegram down'))
    await expect(handler(makeEvent(alarmMessage), {} as any, () => {})).rejects.toThrow('Telegram down')
  })

  it('handles an event without Records', async () => {
    await expect(handler({} as SNSEvent, {} as any, () => {})).resolves.toBeUndefined()
    expect(sendTelegram).not.toHaveBeenCalled()
  })
})
