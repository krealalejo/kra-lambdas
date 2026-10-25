import type { ScheduledHandler } from 'aws-lambda';
import pino from 'pino';
import { fetchCostSummary, formatCostSummary } from './costs.js';
import { fetchOpenPullRequests, formatPullRequests } from './pull-requests.js';
import { getSecret, sendTelegram } from './telegram.js';

const logger = pino({ level: 'error' });

async function buildCostSection(): Promise<string> {
  return formatCostSummary(await fetchCostSummary(new Date()));
}

async function buildPullRequestSection(): Promise<string> {
  const tokenParameter = process.env['GITHUB_TOKEN_PARAM'];
  if (!tokenParameter) {
    throw new Error('GITHUB_TOKEN_PARAM environment variable is not set');
  }
  const token = await getSecret(tokenParameter);
  return formatPullRequests(await fetchOpenPullRequests(token));
}

async function settleSection(title: string, build: () => Promise<string>): Promise<string> {
  try {
    return await build();
  } catch (error) {
    logger.error({ error, title }, 'Failed to build digest section');
    return `${title}\nUnavailable this week.`;
  }
}

export const handler: ScheduledHandler = async (): Promise<void> => {
  const sections = await Promise.all([
    settleSection('💰 AWS costs', buildCostSection),
    settleSection('🔀 Open pull requests', buildPullRequestSection),
  ]);

  await sendTelegram(['📋 Weekly digest', ...sections].join('\n\n'));
};
