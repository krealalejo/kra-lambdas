import type { DynamoDBStreamEvent, DynamoDBStreamHandler } from 'aws-lambda';
import pino from 'pino';
import { sendLeadNotification } from './email.js';

const logger = pino({ level: 'error' });

export const handler: DynamoDBStreamHandler = async (event: DynamoDBStreamEvent): Promise<void> => {
  for (const record of event.Records) {
    if (record.eventName !== 'INSERT') {
      continue;
    }

    const newImage = record.dynamodb?.NewImage;
    if (!newImage) {
      continue;
    }

    const email = newImage['email']?.S;
    const message = newImage['message']?.S;

    if (!email || !message) {
      continue;
    }

    try {
      await sendLeadNotification(email, message);
    } catch (error) {
      logger.error({ email, error }, 'Failed to send lead notification');
      throw error;
    }
  }
};
