import { scanRepo, fetchSharedReport, fetchConfig } from './api.js';
import { renderReport } from './report.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const THEME_STORAGE_KEY = 'is-ai-native-theme';
const THEME_OPTIONS = new Set(['system', 'light', 'dark']);
const themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

// GitHub owner: alphanumeric or hyphens, 1-39 chars, no leading/trailing hyphen
// GitHub repo: alphanumeric, hyphens, dots, underscores, 1-100 chars
const REPO_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?\/[a-zA-Z0-9._-]{1,100}$/;

const PROGRESS_STAGES = [
  { label: 'Fetching file tree…', percent: 20 },
  { label: 'Matching patterns…', percent: 60 },
  { label: 'Generating report…', percent: 90 },
];

let toastTimer = null;
let progressTimer = null;

function getSavedThemeMode() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_OPTIONS.has(saved) ? saved : 'system';
  } catch {
    return 'system';
  }
}

function resolveTheme(mode) {
  if (mode === 'light' || mode === 'dark') {
    return mode;
  }

  return themeMediaQuery.matches ? 'dark' : 'light';
}

function updateThemeControls(mode) {
  const buttons = document.querySelectorAll('[data-theme-option]');

  buttons.forEach((button) => {
    const selected = button.dataset.themeOption === mode;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

function updateThemeColorMeta(resolvedTheme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    return;
  }

  meta.setAttribute('content', resolvedTheme === 'dark' ? '#290000' : '#c4c4c4');
}

function applyTheme(mode) {
  const resolvedTheme = resolveTheme(mode);
  const root = document.documentElement;

  root.dataset.themeMode = mode;
  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;
  updateThemeControls(mode);
  updateThemeColorMeta(resolvedTheme);
}

function persistThemeMode(mode) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Ignore storage failures and keep the theme in memory only.
  }
}

function initThemeSwitcher() {
  const buttons = document.querySelectorAll('[data-theme-option]');
  if (buttons.length === 0) {
    return;
  }

  const mode = getSavedThemeMode();
  applyTheme(mode);

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const nextMode = button.dataset.themeOption;
      if (!THEME_OPTIONS.has(nextMode)) {
        return;
      }

      persistThemeMode(nextMode);
      applyTheme(nextMode);
    });
  });

  themeMediaQuery.addEventListener('change', () => {
    if (document.documentElement.dataset.themeMode === 'system') {
      applyTheme('system');
    }
  });
}

function normalizeRepoReference(value) {
  const sanitized = value.trim();
  return REPO_RE.test(sanitized) ? sanitized : null;
}

function getRepoFromPath(pathname) {
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

function syncViewState() {
  const body = document.body;
  const report = document.getElementById('report');
  const isShowingReport = report && !report.classList.contains('hidden');

  body.classList.toggle('landing-view', !isShowingReport);
  body.classList.toggle('results-view', isShowingReport);
}

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

function showProgress() {
  const area = document.getElementById('progress-area');
  const bar = document.getElementById('progress-bar');
  const stage = document.getElementById('progress-stage');

  area.classList.remove('hidden');
  bar.style.width = '5%';
  bar.setAttribute('aria-valuenow', '5');
  stage.textContent = 'Starting scan…';

  let idx = 0;
  progressTimer = setInterval(() => {
    if (idx < PROGRESS_STAGES.length) {
      const s = PROGRESS_STAGES[idx];
      bar.style.width = `${s.percent}%`;
      bar.setAttribute('aria-valuenow', String(s.percent));
      stage.textContent = s.label;
      idx++;
    }
  }, 1200);
}

function hideProgress() {
  clearInterval(progressTimer);
  progressTimer = null;

  const area = document.getElementById('progress-area');
  const bar = document.getElementById('progress-bar');

  bar.style.width = '100%';
  bar.setAttribute('aria-valuenow', '100');

  setTimeout(() => {
    area.classList.add('hidden');
    bar.style.width = '0%';
  }, 400);
}

async function loadSharedReport(id, sharingEnabled) {
  document.getElementById('scan-form').classList.add('hidden');
  document.getElementById('snapshot-banner').classList.remove('hidden');
  syncViewState();
  if (!sharingEnabled) {
    showError('Sharing is not enabled on this instance.');
    return;
  }
  try {
    const result = await fetchSharedReport(id);
    renderReport(result, { sharingEnabled: false });
    syncViewState();
  } catch (err) {
    showError(`Could not load shared report: ${err.message}`);
  }
}

async function handleScan(repoUrl, sharingEnabled) {
  hideError();
  setLoading(true);
  showProgress();
  document.getElementById('report').classList.add('hidden');
  syncViewState();

  const controller = new AbortController();
  try {
    const result = await scanRepo(repoUrl, controller.signal);
    hideProgress();
    renderReport(result, { sharingEnabled });
    syncViewState();
  } catch (err) {
    hideProgress();
    if (err.name !== 'AbortError') {
      showError(err.message);
    }
  } finally {
    setLoading(false);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  initThemeSwitcher();
  syncViewState();
  let sharingEnabled = false;
  try {
    const config = await fetchConfig();
    sharingEnabled = config.sharingEnabled === true;
  } catch {
    // If config fetch fails, treat sharing as disabled
  }

  // Check if this is a shared report URL: /_/report/<uuid>
  const match = window.location.pathname.match(/^\/_\/report\/([^/]+)$/);
  if (match) {
    const id = match[1];
    if (UUID_RE.test(id)) {
      loadSharedReport(id, sharingEnabled);
      return;
    }
  }

  // Normal scan flow
  const form = document.getElementById('form');
  const repoInput = document.getElementById('repo-url');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const repoUrl = repoInput.value.trim();
    if (repoUrl) handleScan(repoUrl, sharingEnabled);
  });

  // Auto-scan from /owner/repo on the current app host
  const repoFromPath = getRepoFromPath(window.location.pathname);
  if (repoFromPath) {
    repoInput.value = repoFromPath;
    handleScan(repoFromPath, sharingEnabled);
    return;
  }

  // Auto-scan from ?repo=owner/repo query parameter
  const params = new URLSearchParams(window.location.search);
  const repoParam = params.get('repo');
  if (repoParam) {
    const sanitized = normalizeRepoReference(repoParam);
    if (sanitized) {
      repoInput.value = sanitized;
      handleScan(sanitized, sharingEnabled);
    } else {
      showError('Invalid repo parameter. Expected format: owner/repository');
    }
  }
});
