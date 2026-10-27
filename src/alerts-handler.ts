import type { SNSEvent, SNSEventRecord, SNSHandler } from 'aws-lambda';
import pino from 'pino';
import { sendTelegram } from './telegram.js';
import { forEachInSequence } from './sequence.js';

const logger = pino({ level: 'error' });

const ALARM_STATE_ICONS: Record<string, string> = {
  ALARM: '🚨',
  OK: '✅',
  INSUFFICIENT_DATA: '⚠️',
};

interface CloudWatchAlarmMessage {
  AlarmName: string;
  NewStateValue?: string;
  NewStateReason?: string;
  AlarmDescription?: string;
}

function parseAlarm(message: string): CloudWatchAlarmMessage | undefined {
  try {
    const parsed = JSON.parse(message) as Partial<CloudWatchAlarmMessage>;
    return typeof parsed.AlarmName === 'string' ? (parsed as CloudWatchAlarmMessage) : undefined;
  } catch {
    return undefined;
  }
}

export function formatNotification(message: string, subject?: string | null): string {
  const alarm = parseAlarm(message);
  if (!alarm) {
    return [subject ? `📣 ${subject}` : '📣 AWS notification', message].join('\n\n');
  }

  const state = alarm.NewStateValue ?? 'UNKNOWN';
  const icon = ALARM_STATE_ICONS[state] ?? '📣';
  return [
    `${icon} ${state}: ${alarm.AlarmName}`,
    alarm.AlarmDescription,
    alarm.NewStateReason,
  ]
    .filter(Boolean)
    .join('\n\n');
}

async function forwardRecord(record: SNSEventRecord): Promise<void> {
  try {
    await sendTelegram(formatNotification(record.Sns.Message, record.Sns.Subject));
  } catch (error) {
    logger.error({ error }, 'Failed to forward notification to Telegram');
    throw error;
  }
}

export const handler: SNSHandler = async (event: SNSEvent): Promise<void> => {
  await forEachInSequence(event.Records ?? [], forwardRecord);
};
