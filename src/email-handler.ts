import type { DynamoDBStreamEvent, DynamoDBStreamHandler } from 'aws-lambda';
import { sendLeadNotification } from './email.js';

export const handler: DynamoDBStreamHandler = async (event: DynamoDBStreamEvent): Promise<void> => {
  console.log('Received DynamoDB Stream event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    // Belt-and-suspenders guard — ESM filter handles this at AWS level,
    // but we guard here too in case the ESM filter is misconfigured.
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
      // Re-throw so Lambda marks this invocation as failed.
      // With batch_size=1 and maximum_retry_attempts=2 in the ESM,
      // Lambda will retry twice then route to the SQS DLQ.
      throw error;
    }
  }
};
