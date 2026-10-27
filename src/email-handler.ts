import type { DynamoDBRecord, DynamoDBStreamEvent, DynamoDBStreamHandler } from 'aws-lambda';
import pino from 'pino';
import { sendLeadNotification } from './email.js';
import { sendTelegram } from './telegram.js';
import { forEachInSequence } from './sequence.js';

const logger = pino({ level: 'error' });

async function notifyLead(record: DynamoDBRecord): Promise<void> {
  if (record.eventName !== 'INSERT') {
    return;
  }

  const newImage = record.dynamodb?.NewImage;
  if (!newImage) {
    return;
  }

  const email = newImage['email']?.S;
  const message = newImage['message']?.S;

  if (!email || !message) {
    return;
  }

  try {
    await sendLeadNotification(email, message);
  } catch (error) {
    logger.error({ email, error }, 'Failed to send lead notification');
    throw error;
  }

  try {
    await sendTelegram(`📬 New KRA lead\n\nEmail: ${email}\n\nMessage:\n${message}`);
  } catch (error) {
    logger.error({ email, error }, 'Failed to send lead Telegram notification');
  }
}

export const handler: DynamoDBStreamHandler = async (event: DynamoDBStreamEvent): Promise<void> => {
  await forEachInSequence(event.Records ?? [], notifyLead);
};
