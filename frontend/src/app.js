import { scanRepo, fetchSharedReport, fetchConfig } from './api.js';
import { renderReport } from './report.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let toastTimer = null;

export function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('visible');
    toast.classList.add('hidden');
    toastTimer = null;
  }, 3000);
}

function showError(message) {
  const banner = document.getElementById('error-banner');
  banner.textContent = message;
  banner.classList.remove('hidden');
}

function hideError() {
  document.getElementById('error-banner').classList.add('hidden');
}

function setLoading(loading) {
  const btn = document.getElementById('scan-btn');
  const input = document.getElementById('repo-url');
  btn.disabled = loading;
  input.disabled = loading;
  btn.textContent = loading ? 'Scanning…' : 'Scan';
}

async function loadSharedReport(id, sharingEnabled) {
  document.getElementById('scan-form').classList.add('hidden');
  document.getElementById('snapshot-banner').classList.remove('hidden');
  if (!sharingEnabled) {
    showError('Sharing is not enabled on this instance.');
    return;
  }
  try {
    const result = await fetchSharedReport(id);
    // Shared reports never show the Share button (already shared)
    renderReport(result, { sharingEnabled: false });
  } catch (err) {
    showError(`Could not load shared report: ${err.message}`);
  }
}

async function handleScan(repoUrl, sharingEnabled) {
  hideError();
  setLoading(true);
  document.getElementById('report').classList.add('hidden');

  const controller = new AbortController();
  try {
    const result = await scanRepo(repoUrl, controller.signal);
    renderReport(result, { sharingEnabled });
  } catch (err) {
    if (err.name !== 'AbortError') {
      showError(err.message);
    }
  } finally {
    setLoading(false);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  let sharingEnabled = false;
  try {
    const config = await fetchConfig();
    sharingEnabled = config.sharingEnabled === true;
  } catch {
    // If config fetch fails, treat sharing as disabled
  }

  // Check if this is a shared report URL: /report/<uuid>
  const match = window.location.pathname.match(/^\/report\/([^/]+)$/);
  if (match) {
    const id = match[1];
    if (UUID_RE.test(id)) {
      loadSharedReport(id, sharingEnabled);
      return;
    }
  }

  // Normal scan flow
  const form = document.getElementById('form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const repoUrl = document.getElementById('repo-url').value.trim();
    if (repoUrl) handleScan(repoUrl, sharingEnabled);
  });
});
