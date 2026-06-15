import { scanRepo } from './api.js';
import {
  buildRepoScanErrorPayload,
  buildRepoScanPayload,
  getDeclarativeToolName,
  registerRepoScanTool,
  supportsWebMcp,
} from './webmcp.js';
import { buildRepoPathname, normalizeRepoInputValue } from './repo-location.js';

const THEME_STORAGE_KEY = 'is-ai-native-theme';
const THEME_OPTIONS = new Set(['system', 'light', 'dark']);
const themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

let toastTimer = null;
let activeScan = false;

function verdictClass(verdict) {
  if (verdict === 'AI-Native') return 'verdict-native';
  if (verdict === 'AI-Assisted') return 'verdict-assisted';
  return 'verdict-traditional';
}

function scoreClass(score) {
  if (score > 66) return 'score-green';
  if (score >= 33) return 'score-yellow';
  return 'score-red';
}

/* ── Theme toggle (self-contained; initial theme applied by theme-init.js) ── */
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

function updateThemeColorMeta(resolvedTheme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', resolvedTheme === 'dark' ? '#050805' : '#e8f0e7');
  }
}

function applyTheme(mode) {
  const resolvedTheme = resolveTheme(mode);
  const root = document.documentElement;
  root.dataset.themeMode = mode;
  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;
  updateThemeColorMeta(resolvedTheme);

  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    toggle.dataset.themeTarget = nextTheme;
    toggle.setAttribute('aria-label', `Switch to ${nextTheme} theme`);
    toggle.setAttribute('title', `Switch to ${nextTheme} theme`);
  }
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

  applyTheme(getSavedThemeMode());

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

/* ── Toast ── */
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) {
    return;
  }
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

/* ── WebMCP runtime status ── */
function renderWebMcpStatus() {
  const badge = document.getElementById('webmcp-status');
  const text = document.getElementById('webmcp-status-text');
  const help = document.getElementById('webmcp-status-help');
  if (!badge || !text || !help) {
    return;
  }

  badge.classList.remove('webmcp-status-pending');

  if (supportsWebMcp()) {
    badge.classList.add('webmcp-status-on');
    text.textContent = 'WebMCP runtime detected — tools are registered on this page.';
    help.textContent =
      'Open your WebMCP client (extension or DevTools panel) to see scan_repository and scan_repository_form.';
  } else {
    badge.classList.add('webmcp-status-off');
    text.textContent = 'WebMCP runtime not detected in this browser.';
    help.textContent =
      'Install the WebMCP Model Context Tools extension, or enable WebMCP in a recent Chrome (chrome://flags) to expose these tools. The form below still works on its own.';
  }
}

/* ── Compact result rendering ── */
function setProgress(visible) {
  const progress = document.getElementById('webmcp-demo-progress');
  if (progress) {
    progress.classList.toggle('hidden', !visible);
  }
}

function showDemoError(message) {
  const banner = document.getElementById('webmcp-demo-error');
  if (!banner) {
    return;
  }
  banner.textContent = message;
  banner.classList.remove('hidden');
}

function hideDemoError() {
  const banner = document.getElementById('webmcp-demo-error');
  if (banner) {
    banner.classList.add('hidden');
    banner.textContent = '';
  }
}

function appendSummaryItem(container, label, value, valueClass) {
  const item = document.createElement('div');
  item.className = 'summary-item';

  const labelNode = document.createElement('div');
  labelNode.className = 'si-label';
  labelNode.textContent = label;

  const valueNode = document.createElement('div');
  valueNode.className = valueClass ? `si-value ${valueClass}` : 'si-value';
  valueNode.textContent = value;

  item.append(labelNode, valueNode);
  container.append(item);
}

function renderDemoResult(result) {
  const panel = document.getElementById('webmcp-demo-result');
  if (!panel) {
    return;
  }

  panel.replaceChildren();

  const summary = document.createElement('div');
  summary.className = 'log-summary';

  appendSummaryItem(summary, 'repository', result.repo_name, 'si-agent-name');
  appendSummaryItem(summary, 'verdict', result.verdict, verdictClass(result.verdict));
  appendSummaryItem(summary, 'score', `${result.score}/100`, scoreClass(result.score));
  appendSummaryItem(summary, 'paths', String(result.paths_scanned ?? '—'));

  panel.append(summary);

  const reportPath = buildRepoPathname(result.repo_name);
  if (reportPath) {
    const link = document.createElement('a');
    link.className = 'webmcp-demo-report-link';
    link.href = reportPath;
    link.textContent = 'Open the full report →';
    panel.append(link);
  }

  panel.classList.remove('hidden');
}

async function runScan(repoUrl) {
  if (activeScan) {
    throw new Error('A repository scan is already in progress. Wait for it to finish before starting another scan.');
  }

  const input = document.getElementById('webmcp-demo-repo');
  const button = document.getElementById('webmcp-demo-btn');
  const normalized = normalizeRepoInputValue(repoUrl);
  if (input) {
    input.value = normalized;
  }

  activeScan = true;
  hideDemoError();
  setProgress(true);
  if (button) {
    button.disabled = true;
    button.textContent = 'running…';
  }
  if (input) {
    input.disabled = true;
  }

  try {
    const result = await scanRepo(normalized);
    renderDemoResult(result);
    return result;
  } catch (error) {
    showDemoError(error.message);
    throw error;
  } finally {
    activeScan = false;
    setProgress(false);
    if (button) {
      button.disabled = false;
      button.textContent = 'scan';
    }
    if (input) {
      input.disabled = false;
    }
  }
}

function wireDeclarativeForm() {
  const form = document.getElementById('webmcp-demo-form');
  const input = document.getElementById('webmcp-demo-repo');
  if (!form || !input) {
    return;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const repoUrl = input.value.trim();

    if (!repoUrl) {
      const error = new Error('GitHub repository is required. Provide owner/repository or a full GitHub URL.');
      showDemoError(error.message);
      if (event.agentInvoked && typeof event.respondWith === 'function') {
        event.respondWith(Promise.resolve(buildRepoScanErrorPayload(error, '')));
      }
      return;
    }

    const runPromise = runScan(repoUrl);

    if (event.agentInvoked && typeof event.respondWith === 'function') {
      event.respondWith(
        runPromise
          .then((result) => buildRepoScanPayload(result))
          .catch((error) => buildRepoScanErrorPayload(error, repoUrl)),
      );
      return;
    }

    void runPromise.catch(() => {});
  });
}

function registerImperativeTool() {
  if (!supportsWebMcp()) {
    return;
  }

  registerRepoScanTool({
    async executeScan(repoUrl) {
      return runScan(repoUrl);
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

document.addEventListener('DOMContentLoaded', () => {
  initThemeSwitcher();
  renderWebMcpStatus();
  wireDeclarativeForm();
  registerImperativeTool();

  const input = document.getElementById('webmcp-demo-repo');
  if (input) {
    input.focus({ preventScroll: true });
  }
});
