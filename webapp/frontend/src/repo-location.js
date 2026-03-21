const OWNER_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
const REPO_NAME_RE = /^[a-zA-Z0-9._-]{1,100}$/;
const REPO_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?\/[a-zA-Z0-9._-]{1,100}$/;

export function parseGitHubReference(input) {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (REPO_RE.test(trimmed)) {
    return trimmed;
  }

  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return null;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsedUrl.hostname !== 'github.com') {
    return null;
  }

  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    return null;
  }

  if (parsedUrl.search || parsedUrl.hash) {
    return null;
  }

  const match = parsedUrl.pathname.match(/^\/([^/]+)\/([^/]+?)(\.git)?\/?$/);
  if (!match) {
    return null;
  }

  const owner = match[1];
  const repo = match[2];

  if (!OWNER_RE.test(owner) || !REPO_NAME_RE.test(repo)) {
    return null;
  }

  return `${owner}/${repo}`;
}

export function normalizeRepoReference(value) {
  return parseGitHubReference(value);
}

export function normalizeRepoInputValue(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  return normalizeRepoReference(trimmed) || trimmed;
}

export function getRepoFromPath(pathname) {
  const match = pathname.match(/^\/([^/]+)\/([^/]+)\/?$/);
  if (!match) {
    return null;
  }

  try {
    return normalizeRepoReference(`${decodeURIComponent(match[1])}/${decodeURIComponent(match[2])}`);
  } catch {
    return null;
  }
}

export function buildRepoPathname(repoReference) {
  const normalized = normalizeRepoReference(repoReference);
  if (!normalized) {
    return null;
  }

  const [owner, repo] = normalized.split('/');
  return `/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

function resolveLocationHref(location) {
  if (typeof location?.href === 'string' && location.href) {
    return location.href;
  }

  const origin = location?.origin || 'https://example.com';
  const pathname = location?.pathname || '/';
  const search = location?.search || '';
  const hash = location?.hash || '';
  return `${origin}${pathname}${search}${hash}`;
}

export function syncRepoPathInBrowser(
  repoReference,
  { location = globalThis.window?.location, history = globalThis.window?.history } = {}
) {
  const pathname = buildRepoPathname(repoReference);
  if (!pathname || !location || typeof history?.pushState !== 'function') {
    return false;
  }

  if (location.pathname === pathname && !location.search && !location.hash) {
    return false;
  }

  const nextUrl = new URL(resolveLocationHref(location));
  nextUrl.pathname = pathname;
  nextUrl.search = '';
  nextUrl.hash = '';
  history.pushState(history.state ?? null, '', nextUrl);
  return true;
}