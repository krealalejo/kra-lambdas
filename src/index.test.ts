import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { S3Client } from '@aws-sdk/client-s3'
import type { S3Event } from 'aws-lambda'

vi.mock('./thumbnail.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./thumbnail.js')>()
  return {
    ...original,
    generateThumbnail: vi.fn().mockResolvedValue(Buffer.from('thumb-data')),
  }
})

import { handler } from './index.js'

function makeRecord(bucket: string, key: string): S3Event['Records'][number] {
  return {
    eventVersion: '2.1',
    eventSource: 'aws:s3',
    awsRegion: 'us-east-1',
    eventTime: new Date().toISOString(),
    eventName: 'ObjectCreated:Put',
    userIdentity: { principalId: 'EXAMPLE' },
    requestParameters: { sourceIPAddress: '127.0.0.1' },
    responseElements: { 'x-amz-request-id': 'EXAMPLE', 'x-amz-id-2': 'EXAMPLE' },
    s3: {
      s3SchemaVersion: '1.0',
      configurationId: 'test',
      bucket: { name: bucket, ownerIdentity: { principalId: 'EXAMPLE' }, arn: `arn:aws:s3:::${bucket}` },
      object: { key: encodeURIComponent(key), size: 1024, eTag: 'abc', sequencer: '001' },
    },
  }
}

describe('S3 thumbnail handler (index.ts)', () => {
  const sendMock = vi.fn()

  beforeAll(() => {
    vi.spyOn(S3Client.prototype, 'send').mockImplementation(sendMock)
  })

  afterEach(() => {
    sendMock.mockClear()
  })

  it('processes no records without error', async () => {
    const event: S3Event = { Records: [] }
    await expect(handler(event, {} as any, () => {})).resolves.toBeUndefined()
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('skips non-processable files (e.g. .txt)', async () => {
    const event: S3Event = { Records: [makeRecord('my-bucket', 'images/doc.txt')] }
    await handler(event, {} as any, () => {})
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('downloads image, generates thumbnail and uploads for a processable jpg', async () => {
    const fakeBody = {
      transformToByteArray: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    }
    sendMock
      .mockResolvedValueOnce({ Body: fakeBody })  // GetObjectCommand
      .mockResolvedValueOnce({})                  // PutObjectCommand

    const event: S3Event = { Records: [makeRecord('my-bucket', 'images/photo.jpg')] }
    await handler(event, {} as any, () => {})

    expect(sendMock).toHaveBeenCalledTimes(2)
  })

  it('skips record when S3 response body is empty', async () => {
    sendMock.mockResolvedValueOnce({ Body: null })

    const event: S3Event = { Records: [makeRecord('my-bucket', 'images/photo.png')] }
    await handler(event, {} as any, () => {})

    expect(sendMock).toHaveBeenCalledTimes(1)
  })

  it('catches and logs per-record errors without crashing the handler', async () => {
    sendMock.mockRejectedValueOnce(new Error('S3 read failure'))

    const event: S3Event = { Records: [makeRecord('my-bucket', 'images/photo.jpeg')] }
    await expect(handler(event, {} as any, () => {})).resolves.toBeUndefined()
  })

  it('continues processing remaining records after one fails', async () => {
    const fakeBody = {
      transformToByteArray: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    }
    sendMock
      .mockRejectedValueOnce(new Error('first record fails'))  // first record GetObject fails
      .mockResolvedValueOnce({ Body: fakeBody })               // second record GetObject succeeds
      .mockResolvedValueOnce({})                               // second record PutObject succeeds

    const event: S3Event = {
      Records: [
        makeRecord('my-bucket', 'images/bad.jpg'),
        makeRecord('my-bucket', 'images/good.png'),
      ],
    }
    await handler(event, {} as any, () => {})

    expect(sendMock).toHaveBeenCalledTimes(3)
  })

  it('decodes URL-encoded key with plus signs correctly', async () => {
    const fakeBody = {
      transformToByteArray: vi.fn().mockResolvedValue(new Uint8Array([1])),
    }
    sendMock
      .mockResolvedValueOnce({ Body: fakeBody })
      .mockResolvedValueOnce({})

    // Manually construct a record with a plus-encoded key
    const record = makeRecord('my-bucket', 'images/my+photo.jpg')
    record.s3.object.key = 'images/my+photo.jpg'
    const event: S3Event = { Records: [record] }

    await handler(event, {} as any, () => {})
    expect(sendMock).toHaveBeenCalledTimes(2)
  })
})
