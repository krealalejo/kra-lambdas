import { describe, it, mock, before, afterEach } from 'node:test';
import assert from 'node:assert';
import { SESClient } from '@aws-sdk/client-ses';
import type { DynamoDBStreamEvent } from 'aws-lambda';

// Set env before importing modules (static imports are hoisted in ESM,
// but FROM_EMAIL is read at call time in email.ts so this is safe)
process.env['FROM_EMAIL'] = 'krealalejo@gmail.com';

import { handler } from './email-handler.js';

function makeInsertRecord(fields: Record<string, string | undefined>) {
  const newImage: Record<string, { S: string }> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) {
      newImage[k] = { S: v };
    }
  }
  return {
    eventName: 'INSERT' as const,
    dynamodb: { NewImage: newImage },
  };
}

function makeEvent(records: object[]): DynamoDBStreamEvent {
  return { Records: records } as DynamoDBStreamEvent;
}

describe('email-handler', () => {
  // Mock SESClient.prototype.send — this intercepts the actual SES call
  // made by sendLeadNotification, avoiding network calls in tests
  let sendMock: ReturnType<typeof mock.method>;

  before(() => {
    sendMock = mock.method(SESClient.prototype, 'send', async () => ({}));
  });

  afterEach(() => {
    sendMock.mock.resetCalls();
  });

  it('skips non-INSERT records (MODIFY)', async () => {
    const event = makeEvent([{
      eventName: 'MODIFY',
      dynamodb: { NewImage: { email: { S: 'a@b.com' }, message: { S: 'hi' } } },
    }]);
    await handler(event, {} as any, () => {});
    assert.strictEqual(sendMock.mock.calls.length, 0);
  });

  it('skips non-INSERT records (REMOVE)', async () => {
    const event = makeEvent([{
      eventName: 'REMOVE',
      dynamodb: { OldImage: { email: { S: 'a@b.com' } } },
    }]);
    await handler(event, {} as any, () => {});
    assert.strictEqual(sendMock.mock.calls.length, 0);
  });

  it('skips records missing email field', async () => {
    const event = makeEvent([makeInsertRecord({ message: 'Hello!' })]);
    await handler(event, {} as any, () => {});
    assert.strictEqual(sendMock.mock.calls.length, 0);
  });

  it('skips records missing message field', async () => {
    const event = makeEvent([makeInsertRecord({ email: 'user@test.com' })]);
    await handler(event, {} as any, () => {});
    assert.strictEqual(sendMock.mock.calls.length, 0);
  });

  it('calls ses.send once for valid INSERT with email and message', async () => {
    const event = makeEvent([makeInsertRecord({ email: 'user@test.com', message: 'Hello!' })]);
    await handler(event, {} as any, () => {});
    assert.strictEqual(sendMock.mock.calls.length, 1);
  });

  it('re-throws when ses.send throws, for ESM retry routing', async () => {
    sendMock.mock.mockImplementationOnce(async () => { throw new Error('SES failure'); });
    const event = makeEvent([makeInsertRecord({ email: 'user@test.com', message: 'Hello!' })]);
    await assert.rejects(
      () => handler(event, {} as any, () => {}) as Promise<unknown>,
      /SES failure/
    );
  });
});
