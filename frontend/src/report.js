import { shareReport } from './api.js';
import { showToast } from './app.js';

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function verdictClass(verdict) {
  if (verdict === 'AI-Native') return 'verdict-native';
  if (verdict === 'AI-Assisted') return 'verdict-assisted';
  return 'verdict-traditional';
}

function scoreColorClass(score) {
  if (score > 66) return 'score-green';
  if (score >= 33) return 'score-yellow';
  return 'score-red';
}

/** Convert a display string to terminal-style kebab-case (e.g. "Saved Prompts" → "saved-prompts"). */
function toKebab(str) {
  return str.toLowerCase().replace(/\s+/g, '-');
}

/** Format an ISO timestamp string as human-friendly UTC (e.g. "9 Mar 2026 16:30 UTC"). */
function formatTimestamp(ts) {
  const d = new Date(ts);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = d.getUTCDate();
  const month = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} ${hh}:${mm} UTC`;
}

/**
 * Generate an ASCII block-character progress bar for a 0–100 score.
 * 50 characters total: filled (█) then trailing (▀).
 */
function asciiProgressBar(score) {
  const TOTAL = 50;
  const full = Math.floor(score / 2);
  const rest = TOTAL - full;
  return '\u2588'.repeat(full) + '\u2580'.repeat(rest);
}

/**
 * Render one primitive as a terminal log row.
 */
function primitiveRow(prim) {
  const found = prim.detected;
  const rowClass = found ? 'found' : 'absent';
  const icon = found ? '+' : '-';
  const name = escapeHtml(toKebab(prim.name));
  const cat = escapeHtml((prim.category || '').toLowerCase());

  let fileHtml;
  if (prim.matched_files?.length) {
    const fileItems = prim.matched_files
      .map((f) => `<div class="matched-file-item">${escapeHtml(f)}</div>`)
      .join('');
    const count = prim.matched_files.length;
    fileHtml = `<details class="row-file-accordion" open>
        <summary>${count} file${count !== 1 ? 's' : ''} found</summary>
        ${fileItems}
      </details>`;
  } else {
    fileHtml = '<span class="row-file">not found</span>';
  }

  const descHtml = prim.description
    ? `<div class="log-row absent" style="border:none;opacity:1;padding-top:0;">
         <span class="row-icon" style="visibility:hidden">-</span>
         <span class="row-desc">${escapeHtml(prim.description)}</span>
       </div>`
    : '';

  const docLinksHtml = prim.doc_links?.length
    ? `<div class="row-docs">${prim.doc_links
        .map((link) => `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">docs &rarr;</a>`)
        .join('')}</div>`
    : '';

  return `
    <div class="log-row ${rowClass}">
      <span class="row-icon">${icon}</span>
      <span class="row-name">${name}</span>
      <span class="row-cat">${cat}</span>
      ${fileHtml}
    </div>${descHtml}${docLinksHtml}`;
}

/**
 * Render one assistant as a collapsible terminal log section.
 */
function assistantSection(assistant) {
  const colorClass = scoreColorClass(assistant.score);
  const slug = escapeHtml(toKebab(assistant.name));
  const rowsHtml = assistant.primitives?.length
    ? assistant.primitives.map(primitiveRow).join('')
    : '<p class="log-empty">no primitives data available</p>';

  return `
    <details class="log-section" id="section-${slug}" open>
      <summary class="log-header">
        <span class="lh-title">${slug}</span>
        <span class="lh-score ${colorClass}">${escapeHtml(String(assistant.score))}/100</span>
        <span class="lh-chevron" aria-hidden="true">▼</span>
      </summary>
      ${rowsHtml}
    </details>`;
}

export function renderReport(result, { sharingEnabled = false } = {}) {
  const el = document.getElementById('report');
  const vClass = verdictClass(result.verdict);
  const sColorClass = scoreColorClass(result.score);

  // Update topbar breadcrumb with the repo name
  const topbarScope = document.getElementById('topbar-scope');
  if (topbarScope) topbarScope.textContent = result.repo_name;

  // Count overall primitives
  const totalPrims = result.primitives?.length ?? 0;
  const foundPrims = result.primitives?.filter((p) => p.detected).length ?? 0;
  const primsColorClass =
    totalPrims > 0 && foundPrims === totalPrims ? 'score-green' : foundPrims > 0 ? 'score-yellow' : 'score-red';

  // ASCII bar
  const asciiBar = asciiProgressBar(result.score);

  // Verdict display (terminal-style: uppercase kebab)
  const verdictDisplay = escapeHtml(toKebab(result.verdict).toUpperCase());

  // Human-friendly timestamp
  const scanTs = escapeHtml(formatTimestamp(result.scanned_at));

  // Per-assistant sections (preferred) or flat primitive list
  let sectionsHtml = '';
  if (result.per_assistant?.length) {
    sectionsHtml = result.per_assistant.map((a) => assistantSection(a)).join('');
  } else if (totalPrims > 0) {
    sectionsHtml = `
      <div class="log-section">
        <div class="log-header">
          <span class="lh-title">primitives</span>
          <span class="lh-score ${sColorClass}">${result.score}/100</span>
        </div>
        ${result.primitives.map(primitiveRow).join('')}
      </div>`;
  } else {
    sectionsHtml = `
      <div class="log-section">
        <div class="log-header">
          <span class="lh-title">primitives</span>
          <span class="lh-score score-red">0/100</span>
        </div>
        <p class="log-empty">no AI-native primitives detected — check the documentation to get started</p>
      </div>`;
  }

  const shareButtonHtml = sharingEnabled
    ? '<button type="button" class="share-btn" data-share-report>share-report</button>'
    : '';

  // Per-assistant score chips for summary (link to each section)
  const assistantChipsHtml =
    result.per_assistant?.length
      ? result.per_assistant
          .map((a) => {
            const slug = escapeHtml(toKebab(a.name));
            const cc = scoreColorClass(a.score);
            const score = escapeHtml(String(Math.round(Number(a.score))));
            return `<a href="#section-${slug}" class="as-chip ${cc}">${slug}: ${score}%</a>`;
          })
          .join('')
      : '';

  el.innerHTML = `
    <div class="log-summary">
      <div class="summary-item">
        <div class="si-label">readiness-score</div>
        <div class="si-value ${sColorClass}">${escapeHtml(String(result.score))}<span class="si-denom">/100</span></div>
      </div>
      <div class="summary-item">
        <div class="si-label">verdict</div>
        <div class="si-value ${vClass}">${verdictDisplay}</div>
      </div>
      <div class="summary-item">
        <div class="si-label">primitives-found</div>
        <div class="si-value ${primsColorClass}">${foundPrims}/${totalPrims}</div>
      </div>
      <div class="summary-item">
        <div class="si-label">scanned-at</div>
        <div class="si-value si-small">${scanTs}</div>
      </div>
      ${assistantChipsHtml ? `<div class="summary-assistant-scores">${assistantChipsHtml}</div>` : ''}
    </div>

    <div class="text-progress">
      <div class="bar-label">score: ${escapeHtml(String(result.score))}%</div>
      <span class="ascii-bar">${asciiBar}</span>
    </div>

    ${shareButtonHtml ? `<div class="report-top-bar">${shareButtonHtml}</div>` : ''}

    ${sectionsHtml}

    <div class="report-footer-bar">
      <span class="scanned-at">
        <a id="repo-link" target="_blank" rel="noopener noreferrer">${escapeHtml(result.repo_name)}</a>
        ${result.description ? '&mdash; ' + escapeHtml(result.description) : ''}
      </span>
      ${shareButtonHtml}
    </div>
  `;

  // Set repo link href via DOM API to prevent javascript: scheme injection
  const repoLink = el.querySelector('#repo-link');
  if (repoLink) {
    try {
      const parsed = new URL(result.repo_url);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        repoLink.href = parsed.href;
      }
    } catch {
      // Omit href if the URL is unparseable
    }
  }

  el.classList.remove('hidden');

  if (sharingEnabled) {
    addShareButton(result);
  }
}

function addShareButton(result) {
  const buttons = [...document.querySelectorAll('[data-share-report]')];
  if (buttons.length === 0) return;

  let sharedUrlPromise = null;

  const setButtonState = ({ disabled, text }) => {
    buttons.forEach((button) => {
      button.disabled = disabled;
      button.textContent = text;
    });
  };

  const resetButtons = () => {
    setButtonState({ disabled: false, text: 'share-report' });
  };

  const resolveShareUrl = async () => {
    if (!sharedUrlPromise) {
      sharedUrlPromise = shareReport(result)
        .then(({ url }) => new URL(url, window.location.origin).href)
        .catch((error) => {
          sharedUrlPromise = null;
          throw error;
        });
    }
    return sharedUrlPromise;
  };

  const copyToClipboard = async (url) => {
    if (!navigator.clipboard?.writeText) {
      throw new Error('Clipboard sharing is not available in this browser.');
    }
    await navigator.clipboard.writeText(url);
    showToast('permalink copied to clipboard');
    setButtonState({ disabled: false, text: 'copied!' });
  };

  const shareWithNativeApi = async (url) => {
    if (!navigator.share) return false;
    const shareData = {
      title: `${result.repo_name} AI-native report`,
      text: `AI-native readiness report for ${result.repo_name}`,
      url,
    };
    if (navigator.canShare && !navigator.canShare(shareData)) return false;
    await navigator.share(shareData);
    showToast('report link ready to share');
    setButtonState({ disabled: false, text: 'shared' });
    return true;
  };

  buttons.forEach((button) => {
    button.addEventListener('click', async () => {
      setButtonState({ disabled: true, text: 'sharing...' });
      try {
        const url = await resolveShareUrl();
        const shared = await shareWithNativeApi(url);
        if (!shared) {
          await copyToClipboard(url);
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          resetButtons();
          return;
        }
        showToast(`error: ${err.message}`);
        resetButtons();
      }
    });
  });
}
