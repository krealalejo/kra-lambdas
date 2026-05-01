import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({});

export async function sendLeadNotification(email: string, message: string): Promise<void> {
  const FROM_EMAIL = process.env['FROM_EMAIL'];
  const TO_EMAIL = process.env['TO_EMAIL'];
  if (!FROM_EMAIL) {
    throw new Error('FROM_EMAIL environment variable is not set');
  }
  if (!TO_EMAIL) {
    throw new Error('TO_EMAIL environment variable is not set');
  }
  const command = new SendEmailCommand({
    Source: FROM_EMAIL,
    Destination: { ToAddresses: [TO_EMAIL] },
    Message: {
      Subject: { Data: 'Nuevo lead KRA', Charset: 'UTF-8' },
      Body: {
        Text: {
          Data: `Email: ${email}\n\nMensaje:\n${message}`,
          Charset: 'UTF-8',
        },
      },
    },
  });
  await ses.send(command);
  console.log(`[SUCCESS] Email sent for lead: ${email}`);
}
