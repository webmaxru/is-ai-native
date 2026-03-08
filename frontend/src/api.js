const API_BASE = '/api';

export async function fetchConfig(signal) {
  const res = await fetch(`${API_BASE}/config`, { signal });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch config');
  return data; // { sharingEnabled: bool }
}

export async function scanRepo(repoUrl, signal) {
  const res = await fetch(`${API_BASE}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_url: repoUrl }),
    signal,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Scan failed');
  return data;
}

export async function shareReport(result, signal) {
  const res = await fetch(`${API_BASE}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ result }),
    signal,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to share report');
  return data; // { id, url }
}

export async function fetchSharedReport(id, signal) {
  const res = await fetch(`${API_BASE}/report/${encodeURIComponent(id)}`, { signal });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Report not found');
  return data;
}
