// SPRINT-GITHUB-AUTH-TRUTH-LOCK-007: GitHub auth helper
// Priority: App install token → Classic PAT → GH_TOKEN (local only)
// CI mode (CI=true) rejects GH_TOKEN fallback — fail-closed.

import { createSign } from 'node:crypto';

export type AuthSource = 'app' | 'classic_pat' | 'gh_token';

export interface GitHubAuth {
  token: string;
  source: AuthSource;
}

/**
 * Resolve a GitHub token for issue writes.
 *
 * Priority:
 *   1. GitHub App installation token (GITHUB_APP_ID + GITHUB_APP_PRIVATE_KEY + GITHUB_APP_INSTALLATION_ID)
 *   2. Classic PAT (GITHUB_TOKEN_CLASSIC)
 *   3. GH_TOKEN from gh CLI (local dev only — rejected in CI)
 *
 * @throws if no valid credential is available.
 */
export async function getGitHubAuth(): Promise<GitHubAuth> {
  const isCI = process.env.CI === 'true';

  // --- Tier 1: GitHub App ---
  const appId = process.env.GITHUB_APP_ID;
  const appKey = process.env.GITHUB_APP_PRIVATE_KEY;
  const installId = process.env.GITHUB_APP_INSTALLATION_ID;

  if (appId && appKey && installId) {
    const token = await mintInstallationToken(appId, appKey, installId);
    return { token, source: 'app' };
  }

  // --- Tier 2: Classic PAT ---
  const classicPat = process.env.GITHUB_TOKEN_CLASSIC;
  if (classicPat) {
    return { token: classicPat, source: 'classic_pat' };
  }

  // --- Tier 3: GH_TOKEN (local only) ---
  const ghToken = process.env.GH_TOKEN;
  if (ghToken) {
    if (isCI) {
      throw new GitHubAuthError(
        'GH_TOKEN is not valid for CI. Provide GITHUB_APP_* or GITHUB_TOKEN_CLASSIC.',
        'gh_token',
        'ci_rejected'
      );
    }
    return { token: ghToken, source: 'gh_token' };
  }

  // --- No credential found ---
  const hint = isCI
    ? 'Set GITHUB_APP_ID + GITHUB_APP_PRIVATE_KEY + GITHUB_APP_INSTALLATION_ID, or GITHUB_TOKEN_CLASSIC.'
    : 'Set GITHUB_TOKEN_CLASSIC, or run `gh auth login` to provide GH_TOKEN.';

  throw new GitHubAuthError(
    `No GitHub credential available for issue writes. ${hint}`,
    null,
    'no_credential'
  );
}

export class GitHubAuthError extends Error {
  readonly source: AuthSource | null;
  readonly code: string;

  constructor(message: string, source: AuthSource | null, code: string) {
    super(message);
    this.name = 'GitHubAuthError';
    this.source = source;
    this.code = code;
  }
}

// --- GitHub App JWT + Installation Token ---

/**
 * Mint a short-lived installation access token from GitHub App credentials.
 * 1. Build JWT signed with App private key
 * 2. Exchange JWT for installation access token via GitHub API
 */
async function mintInstallationToken(
  appId: string,
  privateKeyRaw: string,
  installationId: string
): Promise<string> {
  // Support escaped newlines from env vars
  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

  const jwt = buildAppJwt(appId, privateKey);

  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new GitHubAuthError(
      `GitHub App token exchange failed: HTTP ${res.status} — ${body.slice(0, 200)}`,
      'app',
      'app_token_exchange_failed'
    );
  }

  const data = (await res.json()) as { token?: string };
  if (!data.token) {
    throw new GitHubAuthError(
      'GitHub App token exchange returned no token',
      'app',
      'app_token_missing'
    );
  }

  return data.token;
}

/** Build a JWT for GitHub App authentication (RS256, 10-minute expiry) */
function buildAppJwt(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iat: now - 60, // 60s clock skew allowance
    exp: now + 600, // 10-minute expiry
    iss: appId,
  };

  const segments = [base64url(JSON.stringify(header)), base64url(JSON.stringify(payload))];

  const signer = createSign('RSA-SHA256');
  signer.update(segments.join('.'));
  const signature = signer.sign(privateKey, 'base64url');

  return `${segments.join('.')}.${signature}`;
}

function base64url(input: string): string {
  return Buffer.from(input).toString('base64url');
}
