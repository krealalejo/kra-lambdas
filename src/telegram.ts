import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

const TELEGRAM_MESSAGE_LIMIT = 4096;

const ssm = new SSMClient({});
const secretCache = new Map<string, string>();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }
  return value;
}

export async function getSecret(parameterName: string): Promise<string> {
  const cached = secretCache.get(parameterName);
  if (cached) {
    return cached;
  }
  const result = await ssm.send(new GetParameterCommand({ Name: parameterName, WithDecryption: true }));
  const value = result.Parameter?.Value;
  if (!value) {
    throw new Error(`SSM parameter ${parameterName} has no value`);
  }
  secretCache.set(parameterName, value);
  return value;
}

export async function sendTelegram(text: string): Promise<void> {
  const tokenParameter = requireEnv('TELEGRAM_BOT_TOKEN_PARAM');
  const chatIdParameter = requireEnv('TELEGRAM_CHAT_ID_PARAM');
  const [token, chatId] = await Promise.all([getSecret(tokenParameter), getSecret(chatIdParameter)]);

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text.slice(0, TELEGRAM_MESSAGE_LIMIT),
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Telegram API responded with status ${response.status}`);
  }
}
