import type { DynamoDBStreamEvent, DynamoDBStreamHandler } from 'aws-lambda';
import { sendLeadNotification } from './email.js';

export const handler: DynamoDBStreamHandler = async (event: DynamoDBStreamEvent): Promise<void> => {
  console.log('Received DynamoDB Stream event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    if (record.eventName !== 'INSERT') {
      console.error(`[SKIP] Not an INSERT event: ${record.eventName}`);
      continue;
    }

    const newImage = record.dynamodb?.NewImage;
    if (!newImage) {
      console.error('[SKIP] No NewImage in record');
      continue;
    }

    const email = newImage['email']?.S;
    const message = newImage['message']?.S;

    if (!email || !message) {
      console.error('[SKIP] Missing email or message field', { email, message });
      continue;
    }

    try {
      await sendLeadNotification(email, message);
      console.log(`[SUCCESS] Notification sent for lead: ${email}`);
    } catch (error) {
      console.error(`[ERROR] Failed to send notification for ${email}:`, error);
      throw error;
    }
  }
};
