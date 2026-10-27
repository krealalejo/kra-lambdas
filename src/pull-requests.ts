const GITHUB_API = 'https://api.github.com';
const MAX_PULL_REQUESTS = 50;

export interface OpenPullRequest {
  title: string;
  url: string;
  repository: string;
  author: string;
}

interface GitHubSearchItem {
  title: string;
  html_url: string;
  repository_url: string;
  user: { login: string };
}

async function githubGet<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'kra-telegram-digest',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API responded with status ${response.status} for ${path}`);
  }

  return (await response.json()) as T;
}

export async function fetchOpenPullRequests(token: string): Promise<OpenPullRequest[]> {
  const { login } = await githubGet<{ login: string }>('/user', token);
  const query = encodeURIComponent(`is:pr is:open user:${login}`);
  const { items } = await githubGet<{ items: GitHubSearchItem[] }>(
    `/search/issues?q=${query}&sort=created&order=desc&per_page=${MAX_PULL_REQUESTS}`,
    token,
  );

  return items.map((item) => ({
    title: item.title,
    url: item.html_url,
    repository: item.repository_url.split('/').at(-1) ?? item.repository_url,
    author: item.user.login,
  }));
}

export function formatPullRequests(pullRequests: OpenPullRequest[]): string {
  if (pullRequests.length === 0) {
    return '🔀 Open pull requests\nNone, all clear.';
  }

  const lines = [`🔀 Open pull requests (${pullRequests.length})`];
  for (const pr of pullRequests) {
    lines.push('', `• ${pr.repository}: ${pr.title} (${pr.author})`, pr.url);
  }
  return lines.join('\n');
}
