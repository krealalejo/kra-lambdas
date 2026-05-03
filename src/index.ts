import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { S3Event, S3Handler } from 'aws-lambda';
import pino from 'pino';
import { generateThumbnail, buildOutputKey, isProcessableImage, selectStrategy } from './thumbnail.js';

const s3 = new S3Client({});
const logger = pino({ level: 'error' });

export const handler: S3Handler = async (event: S3Event): Promise<void> => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    if (!isProcessableImage(key)) {
      continue;
    }

    try {
      const getResponse = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));

      if (!getResponse.Body) {
        logger.error({ key }, 'Empty body from S3');
        continue;
      }

      const inputBuffer = Buffer.from(await getResponse.Body.transformToByteArray());
      const strategy = selectStrategy(key);
      const thumbnailBuffer = await generateThumbnail(inputBuffer, strategy);
      const outputKey = buildOutputKey(key);

      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: outputKey,
        Body: thumbnailBuffer,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      }));
    } catch (error) {
      logger.error({ key, error }, 'Failed to process thumbnail');
    }
  }
};
