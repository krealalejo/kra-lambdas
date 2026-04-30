import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { S3Event, S3Handler } from 'aws-lambda';
import { generateThumbnail, buildOutputKey, isProcessableImage, selectStrategy } from './thumbnail.js';

const s3 = new S3Client({});

export const handler: S3Handler = async (event: S3Event): Promise<void> => {
  console.log('Received S3 event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    console.log(`Processing: s3://${bucket}/${key}`);

    if (!isProcessableImage(key)) {
      console.error(`[SKIP] Not a processable image: ${key}`);
      continue;
    }

    try {
      const getResponse = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));

      if (!getResponse.Body) {
        console.error(`[ERROR] Empty body for ${key}`);
        continue;
      }

      const inputBuffer = Buffer.from(await getResponse.Body.transformToByteArray());
      console.log(`Downloaded ${key}: ${inputBuffer.length} bytes`);

      const strategy = selectStrategy(key);
      const thumbnailBuffer = await generateThumbnail(inputBuffer, strategy);
      const outputKey = buildOutputKey(key);
      console.log(`Generated output (${strategy.width}px, q${strategy.quality}): ${thumbnailBuffer.length} bytes → ${outputKey}`);

      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: outputKey,
        Body: thumbnailBuffer,
        ContentType: 'image/webp',
      }));

      console.log(`[SUCCESS] Uploaded: s3://${bucket}/${outputKey}`);
    } catch (error) {
      console.error(`[ERROR] Failed to process ${key}:`, error);
    }
  }
};
