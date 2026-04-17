import { describe, it, mock, before, afterEach } from 'node:test';
import assert from 'node:assert';
import { SESClient } from '@aws-sdk/client-ses';

// Set env before importing email module (module-level const reads this at import time)
process.env['FROM_EMAIL'] = 'krealalejo@gmail.com';

// Import once — ESM caches modules, subsequent dynamic imports return the same instance
import { sendLeadNotification } from './email.js';

describe('sendLeadNotification', () => {
  let sendMock: ReturnType<typeof mock.method>;

  before(() => {
    // Mock SESClient.prototype.send so the module-level `ses` instance uses our mock
    sendMock = mock.method(SESClient.prototype, 'send', async () => ({}));
  });

  afterEach(() => {
    sendMock.mock.resetCalls();
  });

  it('calls ses.send once', async () => {
    await sendLeadNotification('user@test.com', 'Hello!');
    assert.strictEqual(sendMock.mock.calls.length, 1);
  });

  it('uses FROM_EMAIL as Source and ToAddress', async () => {
    await sendLeadNotification('user@test.com', 'Hello!');
    const cmd = sendMock.mock.calls[0]?.arguments[0] as any;
    assert.strictEqual(cmd.input.Source, 'krealalejo@gmail.com');
    assert.deepStrictEqual(cmd.input.Destination.ToAddresses, ['krealalejo@gmail.com']);
  });

  it('sets Subject to Nuevo lead KRA', async () => {
    await sendLeadNotification('user@test.com', 'Hello!');
    const cmd = sendMock.mock.calls[0]?.arguments[0] as any;
    assert.strictEqual(cmd.input.Message.Subject.Data, 'Nuevo lead KRA');
  });

  it('body text contains email and message in correct format', async () => {
    await sendLeadNotification('user@test.com', 'my message');
    const cmd = sendMock.mock.calls[0]?.arguments[0] as any;
    const body = cmd.input.Message.Body.Text.Data as string;
    assert.ok(body.includes('user@test.com'), 'body must contain lead email');
    assert.ok(body.includes('my message'), 'body must contain lead message');
    assert.strictEqual(body, 'Email: user@test.com\n\nMensaje:\nmy message');
  });
});
