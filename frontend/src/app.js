import { scanRepo, fetchSharedReport, fetchConfig } from './api.js';
import { renderReport } from './report.js';
import { initTelemetry, trackUiEvent, disableTelemetry, clearTelemetryIdentity } from './telemetry.js';
import {
  buildRepoScanErrorPayload,
  buildRepoScanPayload,
  getDeclarativeToolName,
  registerRepoScanTool,
  supportsWebMcp,
} from './webmcp.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const THEME_STORAGE_KEY = 'is-ai-native-theme';
const THEME_OPTIONS = new Set(['system', 'light', 'dark']);
const themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

// GitHub owner: alphanumeric or hyphens, 1-39 chars, no leading/trailing hyphen
// GitHub repo: alphanumeric, hyphens, dots, underscores, 1-100 chars
const REPO_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?\/[a-zA-Z0-9._-]{1,100}$/;

/**
 * Parse GitHub URL or short form (owner/repo) into owner/repo format.
 * Handles: https://github.com/owner/repo, http://github.com/owner/repo, owner/repo
 * @param {string} input - Raw user input
 * @returns {string|null} Normalized owner/repo string or null if invalid
 */
function parseGitHubReference(input) {
  if (!input || typeof input !== 'string') return null;
  
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Already in short form owner/repo
  if (REPO_RE.test(trimmed)) {
    return trimmed;
  }

  // Try to parse as URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      if (url.hostname !== 'github.com') return null;
      
      const match = url.pathname.match(/^\/([^/]+)\/([^/\s]+)/);
      if (!match) return null;
      
      const owner = match[1];
      const repo = match[2].replace(/\.git$/, '');
      
      return `${owner}/${repo}`;
    } catch {
      return null;
    }
  }

  return null;
}
const ANALYTICS_CONSENT_KEY = 'is-ai-native-analytics-consent';

const PROGRESS_STAGES = [
  { label: 'Fetching file tree…', percent: 20 },
  { label: 'Matching patterns…', percent: 60 },
  { label: 'Generating report…', percent: 90 },
];

let toastTimer = null;
let progressTimer = null;
let telemetryConfig = null;
let hasScanStarted = false;
let activeScanPromise = null;

function getAnalyticsConsent() {
  try {
    const value = localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

function setAnalyticsConsent(value) {
  try {
    if (value === null) {
      localStorage.removeItem(ANALYTICS_CONSENT_KEY);
    } else {
      localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
    }
  } catch {
    // Ignore storage failures and keep in-memory behavior.
  }
}

function renderAnalyticsConsentControl() {
  const el = document.getElementById('analytics-consent');
  if (!el) {
    return;
  }

  if (!telemetryConfig?.appInsightsConnectionString) {
    el.classList.remove('hidden');
    el.textContent = 'analytics: unavailable';
    return;
  }

  const consent = getAnalyticsConsent();
  el.classList.remove('hidden');

  if (consent === 'denied') {
    el.innerHTML = 'analytics: off <button type="button" class="footer-consent-action" data-analytics-action="allow">enable</button>';
  } else {
    el.innerHTML = 'analytics: on <button type="button" class="footer-consent-action" data-analytics-action="deny">disable</button>';
  }

  const actionBtn = el.querySelector('[data-analytics-action]');
  if (!actionBtn) {
    return;
  }

  actionBtn.addEventListener('click', () => {
    const action = actionBtn.getAttribute('data-analytics-action');

    if (action === 'allow') {
      setAnalyticsConsent('granted');
      if (telemetryConfig) {
        initTelemetry(telemetryConfig);
        trackUiEvent('analytics_consent_updated', { consent: 'granted' });
      }
    } else {
      setAnalyticsConsent('denied');
      trackUiEvent('analytics_consent_updated', { consent: 'denied' });
      disableTelemetry();
      clearTelemetryIdentity();
    }

    renderAnalyticsConsentControl();
  });
}

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
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) {
    return;
  }

  const resolvedTheme = resolveTheme(mode);
  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
  toggle.dataset.themeTarget = nextTheme;
  toggle.setAttribute('aria-label', `Switch to ${nextTheme} theme`);
  toggle.setAttribute('title', `Switch to ${nextTheme} theme`);
}

function updateThemeColorMeta(resolvedTheme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    return;
  }

  meta.setAttribute('content', resolvedTheme === 'dark' ? '#050805' : '#1a1c1a');
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
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) {
    return;
  }

  const mode = getSavedThemeMode();
  applyTheme(mode);

  toggle.addEventListener('click', () => {
    const currentResolvedTheme = resolveTheme(document.documentElement.dataset.themeMode || 'system');
    const nextMode = currentResolvedTheme === 'dark' ? 'light' : 'dark';

    persistThemeMode(nextMode);
    applyTheme(nextMode);
  });

  themeMediaQuery.addEventListener('change', () => {
    if (document.documentElement.dataset.themeMode === 'system') {
      applyTheme('system');
    }
  });
}

function normalizeRepoReference(value) {
  const parsed = parseGitHubReference(value);
  return parsed;
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

  body.classList.toggle('landing-view', !isShowingReport && !hasScanStarted);
  body.classList.toggle('results-view', isShowingReport);
}

function playFlipAnimation(element, firstRect, { scale = false } = {}) {
  if (!element || !firstRect) {
    return;
  }

  const lastRect = element.getBoundingClientRect();
  if (!lastRect.width || !lastRect.height) {
    return;
  }

  const deltaX = firstRect.left - lastRect.left;
  const deltaY = firstRect.top - lastRect.top;
  const scaleX = scale ? firstRect.width / lastRect.width : 1;
  const scaleY = scale ? firstRect.height / lastRect.height : 1;
  const hasMovement = Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5;
  const hasScale = Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01;

  if (!hasMovement && !hasScale) {
    return;
  }

  element.animate(
    [
      {
        transformOrigin: 'top left',
        transform: `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`,
      },
      {
        transformOrigin: 'top left',
        transform: 'translate(0, 0) scale(1, 1)',
      },
    ],
    {
      duration: 550,
      easing: 'cubic-bezier(0, 0, 0.2, 1)',
      fill: 'both',
    }
  );
}

function animateScanStart() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const scanForm = document.getElementById('scan-form');
  const scanLineContent = document.querySelector('.scan-line-content');
  const logBody = document.getElementById('log-body');

  if (!scanForm || !scanLineContent || !logBody) {
    return;
  }

  const scanFormRect = scanForm.getBoundingClientRect();
  const scanLineContentRect = scanLineContent.getBoundingClientRect();
  const logBodyRect = logBody.getBoundingClientRect();

  requestAnimationFrame(() => {
    playFlipAnimation(scanForm, scanFormRect);
    playFlipAnimation(scanLineContent, scanLineContentRect, { scale: true });
    playFlipAnimation(logBody, logBodyRect);
  });
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
  btn.textContent = loading ? 'running...' : 'scan';
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
    trackUiEvent('shared_report_loaded_client', {
      report_id: id,
      repo_name: result.repo_name,
    });
  } catch (err) {
    showError(`Could not load shared report: ${err.message}`);
    trackUiEvent('shared_report_load_failed_client', {
      report_id: id,
      error_name: err.name,
      reason: err.message,
    });
  }
}

async function executeScan(repoUrl, sharingEnabled) {
  const trimmedRepoUrl = repoUrl.trim();
  if (!trimmedRepoUrl) {
    throw new Error('GitHub repository is required. Provide owner/repository or a full GitHub URL.');
  }

  if (activeScanPromise) {
    throw new Error('A repository scan is already in progress. Wait for it to finish before starting another scan.');
  }

  const controller = new AbortController();
  const run = (async () => {
    hideError();
    if (!hasScanStarted) {
      hasScanStarted = true;
      animateScanStart();
    }
    setLoading(true);
    showProgress();
    document.getElementById('report').classList.add('hidden');
    const topbarScope = document.getElementById('topbar-scope');
    if (topbarScope) topbarScope.textContent = trimmedRepoUrl;
    syncViewState();

    try {
      trackUiEvent('scan_requested_client', {
        repo_reference: trimmedRepoUrl,
      });
      const result = await scanRepo(trimmedRepoUrl, controller.signal);
      hideProgress();
      renderReport(result, { sharingEnabled });
      syncViewState();
      trackUiEvent(
        'scan_succeeded_client',
        {
          repo_name: result.repo_name,
          verdict: result.verdict,
        },
        {
          score: Number(result.score),
        }
      );
      return result;
    } catch (err) {
      hideProgress();
      if (err.name !== 'AbortError') {
        showError(err.message);
        trackUiEvent('scan_failed_client', {
          repo_reference: trimmedRepoUrl,
          error_name: err.name,
          reason: err.message,
        });
      }
      throw err;
    } finally {
      setLoading(false);
    }
  })();

  activeScanPromise = run;

  try {
    return await run;
  } finally {
    if (activeScanPromise === run) {
      activeScanPromise = null;
    }
  }
}

async function handleScan(repoUrl, sharingEnabled) {
  hideError();
  try {
    return await executeScan(repoUrl, sharingEnabled);
  } catch (err) {
    if (err.name === 'AbortError') {
      return null;
    }

    return null;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  initThemeSwitcher();
  syncViewState();
  // Apply centering on landing page only (not for auto-scan URLs or shared reports)
  const isAutoScanPage = !!(
    getRepoFromPath(window.location.pathname) ||
    new URLSearchParams(window.location.search).get('repo') ||
    window.location.pathname.match(/^\/_\/report\/[^/]+$/)
  );

  let sharingEnabled = false;
  try {
    const config = await fetchConfig();
    sharingEnabled = config.sharingEnabled === true;
    telemetryConfig = config;
  } catch {
    // If config fetch fails, treat sharing as disabled
    telemetryConfig = null;
  }

  if (telemetryConfig?.appInsightsConnectionString && getAnalyticsConsent() !== 'denied') {
    initTelemetry(telemetryConfig);
  }

  renderAnalyticsConsentControl();

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
    if (!repoUrl) {
      const error = new Error('GitHub repository is required. Provide owner/repository or a full GitHub URL.');
      showError(error.message);
      if (e.agentInvoked && typeof e.respondWith === 'function') {
        e.respondWith(Promise.resolve(buildRepoScanErrorPayload(error, '')));
      }
      return;
    }

    const runPromise = executeScan(repoUrl, sharingEnabled);

    if (e.agentInvoked && typeof e.respondWith === 'function') {
      e.respondWith(
        runPromise
          .then((result) => buildRepoScanPayload(result))
          .catch((error) => buildRepoScanErrorPayload(error, repoUrl))
      );
      return;
    }

    void runPromise.catch(() => {});
  });

  if (supportsWebMcp()) {
    registerRepoScanTool({
      async executeScan(repoUrl) {
        repoInput.value = repoUrl;
        return executeScan(repoUrl, sharingEnabled);
      },
    });

    window.addEventListener('toolactivated', (event) => {
      if (event?.toolName === getDeclarativeToolName()) {
        showToast('WebMCP populated the repo scan form. Running scan…');
      }
    });

    window.addEventListener('toolcancel', (event) => {
      if (event?.toolName === getDeclarativeToolName()) {
        showToast('WebMCP canceled the repo scan form.');
      }
    });
  }

  // Auto-scan from /owner/repo on the current app host
  const repoFromPath = getRepoFromPath(window.location.pathname);
  if (repoFromPath) {
    repoInput.value = repoFromPath;
    void handleScan(repoFromPath, sharingEnabled);
    return;
  }

  // Auto-scan from ?repo=owner/repo query parameter
  const params = new URLSearchParams(window.location.search);
  const repoParam = params.get('repo');
  if (repoParam) {
    const sanitized = normalizeRepoReference(repoParam);
    if (sanitized) {
      repoInput.value = sanitized;
      void handleScan(sanitized, sharingEnabled);
    } else {
      showError('Invalid repo parameter. Expected format: owner/repository');
    }
    return;
  }

  // No auto-scan: focus the repo input for immediate typing
  repoInput.focus({ preventScroll: true });
});
