export function resolveApiBaseUrl(config = globalThis.__IS_AI_NATIVE_CONFIG__) {
  const configuredOrigin = config?.apiOrigin;
  if (configuredOrigin == null || configuredOrigin === '') {
    return '/api';
  }

  if (typeof configuredOrigin !== 'string') {
    throw new TypeError('Frontend apiOrigin must be a string');
  }

  let url;
  try {
    url = new URL(configuredOrigin);
  } catch {
    throw new Error('Frontend apiOrigin must be an absolute HTTP(S) origin');
  }

  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('Frontend apiOrigin must be an absolute HTTP(S) origin without a path');
  }

  return `${url.origin}/api`;
}

function apiUrl(path) {
  return `${resolveApiBaseUrl()}${path}`;
}

async function parseJsonResponse(res, fallbackMessage) {
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(res.ok ? 'API returned an invalid JSON response' : fallbackMessage);
  }

  if (!res.ok) {
    throw new Error(data?.error || fallbackMessage);
  }

  return data;
}

export async function scanRepo(repoUrl, signal) {
  const res = await fetch(apiUrl('/scan'), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_url: repoUrl }),
    signal,
  });
  return parseJsonResponse(res, 'Scan failed');
}

export async function shareReport(result, signal) {
  const res = await fetch(apiUrl('/report'), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ result }),
    signal,
  });
  const data = await parseJsonResponse(res, 'Failed to share report');
  return data; // { id, url }
}

export async function fetchSharedReport(id, signal) {
  const res = await fetch(apiUrl(`/report/${encodeURIComponent(id)}`), {
    headers: { Accept: 'application/json' },
    signal,
  });
  return parseJsonResponse(res, 'Report not found');
}
