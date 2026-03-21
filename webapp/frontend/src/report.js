import { shareReport } from './api.js';
import { showToast } from './app.js';
import { trackUiEvent } from './telemetry.js';

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

export function getVerdictForScore(score) {
  if (score >= 60) return 'AI-Native';
  if (score >= 30) return 'AI-Assisted';
  return 'Traditional';
}

const ASSISTANT_DOC_HINTS = {
  'github-copilot': ['docs.github.com', 'code.visualstudio.com/docs/copilot', 'github.com/features/copilot'],
  'claude-code': ['code.claude.com', 'docs.anthropic.com', 'anthropic.com'],
  'openai-codex': ['developers.openai.com', 'openai.com', 'github.com/openai/codex'],
};

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

function formatPathsScanned(count) {
  if (!Number.isFinite(count)) {
    return null;
  }

  return `${count.toLocaleString()} path${count === 1 ? '' : 's'}`;
}

function getAssistantKey(assistantName) {
  return toKebab(String(assistantName || ''));
}

function sanitizeHttpUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.href;
    }
  } catch {
    return null;
  }

  return null;
}

function selectPrimitiveDocLink(docLinks, assistantName) {
  const safeLinks = (docLinks || []).map(sanitizeHttpUrl).filter(Boolean);
  if (safeLinks.length === 0) {
    return null;
  }

  const assistantKey = getAssistantKey(assistantName);
  const hints = ASSISTANT_DOC_HINTS[assistantKey] || [];
  const preferredLink = safeLinks.find((link) => hints.some((hint) => link.includes(hint)));

  return preferredLink || safeLinks[0];
}

function primitivePopoverHtml(prim, assistantName) {
  const docLink = selectPrimitiveDocLink(prim.doc_links, assistantName);
  const assistantLabel = assistantName ? `${escapeHtml(assistantName)} documentation` : 'documentation';
  const assistantData = escapeHtml(String(assistantName || ''));
  const primitiveData = escapeHtml(String(prim.name || ''));
  const description = prim.description
    ? `<p class="primitive-popover-text">${escapeHtml(prim.description)}</p>`
    : '<p class="primitive-popover-text">Official documentation for this primitive.</p>';
  const linkHtml = docLink
    ? `<a class="primitive-popover-link" href="${escapeHtml(docLink)}" target="_blank" rel="noopener noreferrer" data-doc-link-kind="primitive-documentation" data-doc-link-source="report-primitive-popover" data-assistant-name="${assistantData}" data-primitive-name="${primitiveData}">${assistantLabel} &rarr;</a>`
    : '<span class="primitive-popover-link primitive-popover-link-disabled">documentation unavailable</span>';

  return `<span class="primitive-popover" role="tooltip">${description}${linkHtml}</span>`;
}

function enrichPrimitive(prim, primitiveMetaByName) {
  const meta = primitiveMetaByName.get(prim.name);
  if (!meta) {
    return prim;
  }

  return {
    ...meta,
    ...prim,
    description: prim.description || meta.description,
    doc_links: prim.doc_links || meta.doc_links,
  };
}

function primitiveDisclosureOpenAttr() {
  return window.matchMedia('(max-width: 620px)').matches ? '' : ' open';
}

function primitiveMetaHtml(prim, name, cat, fileSummary, assistantName, { expandable = false } = {}) {
  return `
    <span class="primitive-entry-meta-row">
      ${expandable ? '<span class="primitive-entry-chevron" aria-hidden="true">▼</span>' : ''}
      <span class="primitive-entry-meta">${escapeHtml(fileSummary)}</span>
      <span class="row-cat-wrap">
        <button type="button" class="row-cat row-cat-trigger" aria-label="About ${name}">${cat}</button>
        ${primitivePopoverHtml(prim, assistantName)}
      </span>
    </span>`;
}

function setPageHeading(text) {
  const heading = document.getElementById('page-heading');
  if (heading) {
    heading.textContent = text;
  }
}

function shareButtonHtml(idSuffix) {
  const disclosureId = `share-disclosure-popover-${idSuffix}`;
  const shareSource = idSuffix === 'top' ? 'report_top_bar' : 'report_footer_bar';
  return `
    <span class="share-disclosure-wrap">
      <button type="button" class="share-btn" data-share-report data-share-source="${shareSource}" aria-describedby="${disclosureId}">share report</button>
      <span id="${disclosureId}" class="share-disclosure-popover" role="tooltip">
        Shared report links are public and can be opened by anyone with the URL. Do not share private repository information here.
      </span>
    </span>`;
}

/**
 * Generate HTML for a block-based progress bar for a 0–100 score.
 * TOTAL_BLOCKS discrete blocks: filled ones are solid, the rest are border-only (empty).
 */
function progressBarHtml(score, colorClass) {
  const TOTAL_BLOCKS = 50;
  const full = Math.min(TOTAL_BLOCKS, Math.floor((Math.max(0, Math.min(100, score)) / 100) * TOTAL_BLOCKS));
  const blocks = [];
  for (let i = 0; i < TOTAL_BLOCKS; i++) {
    blocks.push(`<span class="${i < full ? 'bar-filled' : 'bar-empty'}"></span>`);
  }
  return `<div class="progress-track ${colorClass}" aria-hidden="true">${blocks.join('')}</div>`;
}

export function selectPreferredAssistant(result) {
  const assistants = Array.isArray(result?.per_assistant) ? result.per_assistant.filter(Boolean) : [];

  if (assistants.length === 0) {
    return null;
  }

  return assistants.reduce((bestAssistant, assistant) => {
    if (!bestAssistant) {
      return assistant;
    }

    const bestScore = Number.isFinite(bestAssistant.score) ? bestAssistant.score : 0;
    const assistantScore = Number.isFinite(assistant.score) ? assistant.score : 0;
    return assistantScore > bestScore ? assistant : bestAssistant;
  }, null);
}

/**
 * Render one primitive as a terminal log row.
 */
export function renderPrimitiveRow(prim, assistantName = '') {
  const found = prim.detected;
  const rowClass = found ? 'found' : 'absent';
  const icon = found ? '☑️' : '⬜';
  const name = escapeHtml(prim.name);
  const cat = escapeHtml((prim.category || '').toLowerCase());
  const fileCount = prim.matched_files?.length ?? 0;
  const hasMatchedFiles = fileCount > 0;
  const fileSummary = fileCount ? `${fileCount} file${fileCount !== 1 ? 's' : ''} found` : 'not found';
  const metaHtml = primitiveMetaHtml(prim, name, cat, fileSummary, assistantName, {
    expandable: hasMatchedFiles,
  });

  if (!hasMatchedFiles) {
    return `
      <div class="primitive-entry primitive-entry-static ${rowClass}">
        <div class="log-row primitive-entry-summary">
          <span class="row-icon">${icon}</span>
          <span class="row-name">${name}</span>
          ${metaHtml}
        </div>
      </div>`;
  }

  const openAttr = primitiveDisclosureOpenAttr();

  const fileItems = prim.matched_files
    .map((f) => `<div class="matched-file-item">${escapeHtml(f)}</div>`)
    .join('');
  const fileHtml = `<div class="row-file-list">${fileItems}</div>`;

  return `
    <details class="primitive-entry ${rowClass}"${openAttr}>
      <summary class="log-row primitive-entry-summary">
        <span class="row-icon">${icon}</span>
        <span class="row-name">${name}</span>
        ${metaHtml}
      </summary>
      <div class="primitive-entry-panel">
        <div class="primitive-entry-files">
          ${fileHtml}
        </div>
      </div>
    </details>`;
}

/**
 * Render one assistant as a collapsible terminal log section.
 */
function assistantSection(assistant, primitiveMetaByName, { label = null } = {}) {
  const colorClass = scoreColorClass(assistant.score);
  const slug = escapeHtml(toKebab(assistant.name));
  const rowsHtml = assistant.primitives?.length
    ? assistant.primitives
        .map((primitive) => enrichPrimitive(primitive, primitiveMetaByName))
        .map((primitive) => renderPrimitiveRow(primitive, assistant.name))
        .join('')
    : '<p class="log-empty">no primitives data available</p>';

  return `
    <details class="log-section" id="section-${slug}" open>
      <summary class="log-header">
        ${label ? `<span class="lh-kicker">${escapeHtml(label)}</span>` : ''}
        <span class="lh-title">${escapeHtml(assistant.name)}</span>
        <span class="lh-score ${colorClass}">${escapeHtml(String(assistant.score))}/100</span>
        <span class="lh-chevron" aria-hidden="true">▼</span>
      </summary>
      ${rowsHtml}
    </details>`;
}

export function renderReport(result, { sharingEnabled = false } = {}) {
  const el = document.getElementById('report');
  const primitiveMetaByName = new Map((result.primitives || []).map((primitive) => [primitive.name, primitive]));
  const pageHeading = result.repo_name
    ? `AI coding readiness report for ${result.repo_name}`
    : 'AI coding readiness report';
  const preferredAssistant = selectPreferredAssistant(result);
  const displayedScore = preferredAssistant ? preferredAssistant.score : result.score;
  const displayedVerdict = preferredAssistant ? getVerdictForScore(preferredAssistant.score) : result.verdict;
  const displayedPrimitives = preferredAssistant?.primitives || result.primitives || [];
  const vClass = verdictClass(displayedVerdict);
  const sColorClass = scoreColorClass(displayedScore);

  setPageHeading(pageHeading);

  // Count overall primitives
  const totalPrims = displayedPrimitives.length;
  const foundPrims = displayedPrimitives.filter((primitive) => primitive.detected).length;
  const primsColorClass =
    totalPrims > 0 && foundPrims === totalPrims ? 'score-green' : foundPrims > 0 ? 'score-yellow' : 'score-red';

  // Progress bar
  const barHtml = progressBarHtml(displayedScore, sColorClass);

  // Verdict display (terminal-style: uppercase kebab)
  const verdictDisplay = escapeHtml(toKebab(displayedVerdict).toUpperCase());

  // Human-friendly timestamp
  const scanTs = escapeHtml(formatTimestamp(result.scanned_at));

  const assistants = Array.isArray(result.per_assistant) ? result.per_assistant : [];

  // Per-assistant sections with preferred agent highlighted first when available.
  let sectionsHtml = '';
  if (assistants.length > 0) {
    sectionsHtml = assistants
      .map((assistant) => assistantSection(assistant, primitiveMetaByName, {
        label: preferredAssistant?.name === assistant.name ? 'preferred agent' : null,
      }))
      .join('');
  } else if (totalPrims > 0) {
    sectionsHtml = `
      <div class="log-section">
        <div class="log-header">
          <span class="lh-title">primitives</span>
          <span class="lh-score ${sColorClass}">${displayedScore}/100</span>
        </div>
        ${displayedPrimitives.map((primitive) => renderPrimitiveRow(primitive)).join('')}
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

  const topShareControlsHtml = sharingEnabled ? shareButtonHtml('top') : '';
  const footerShareControlsHtml = sharingEnabled ? shareButtonHtml('footer') : '';
  const pathsScanned = formatPathsScanned(result.paths_scanned);
  const assistantChipsHtml =
    assistants.length > 0
      ? assistants
          .map((assistant) => {
            const slug = escapeHtml(toKebab(assistant.name));
            const cc = scoreColorClass(assistant.score);
            const score = escapeHtml(String(Math.round(Number(assistant.score))));
            const preferredClass = preferredAssistant?.name === assistant.name ? ' as-chip-preferred' : '';
            return `<a href="#section-${slug}" class="as-chip ${cc}${preferredClass}">${escapeHtml(assistant.name)}: ${score}%</a>`;
          })
          .join('')
      : '';

  el.innerHTML = `
    <div class="log-summary">
      ${preferredAssistant ? `
      <div class="summary-item summary-item-agent">
        <div class="si-label">preferred agent</div>
        <div class="si-value si-agent-name">${escapeHtml(preferredAssistant.name)}</div>
      </div>` : ''}
      <div class="summary-item">
        <div class="si-label">readiness score</div>
        <div class="si-value ${sColorClass}">${escapeHtml(String(displayedScore))}<span class="si-denom">/100</span></div>
      </div>
      <div class="summary-item">
        <div class="si-label">verdict</div>
        <div class="si-value ${vClass}">${verdictDisplay}</div>
      </div>
      <div class="summary-item">
        <div class="si-label">primitives found</div>
        <div class="si-value ${primsColorClass}">${foundPrims}/${totalPrims}</div>
      </div>
      <div class="summary-item">
        <div class="si-label">scanned at</div>
        <div class="si-value si-small">${scanTs}</div>
      </div>
      ${result.branch ? `
      <div class="summary-item">
        <div class="si-label">branch</div>
        <div class="si-value si-small">${escapeHtml(result.branch)}</div>
      </div>` : ''}
      ${pathsScanned ? `
      <div class="summary-item">
        <div class="si-label">paths scanned</div>
        <div class="si-value si-small">${escapeHtml(pathsScanned)}</div>
      </div>` : ''}
      ${assistantChipsHtml ? `<div class="summary assistant scores">${assistantChipsHtml}</div>` : ''}
    </div>

    <div class="score-share-row">
      <div class="text-progress">
        <div class="bar-label">${preferredAssistant ? `preferred agent score: ${escapeHtml(String(displayedScore))}%` : `score: ${escapeHtml(String(displayedScore))}%`}</div>
        ${barHtml}
      </div>
      ${topShareControlsHtml ? `<div class="report-top-bar">${topShareControlsHtml}</div>` : ''}
    </div>

    ${sectionsHtml}

    <div class="report-footer-bar">
      <span class="scanned-at">
        <a id="repo-link" target="_blank" rel="noopener noreferrer">${escapeHtml(result.repo_name)}</a>
        ${result.description ? '&mdash; ' + escapeHtml(result.description) : ''}
      </span>
      ${footerShareControlsHtml}
    </div>
  `;

  // Set repo link href via DOM API to prevent javascript: scheme injection
  const repoLink = el.querySelector('#repo-link');
  if (repoLink) {
    const safeRepoUrl = sanitizeHttpUrl(result.repo_url);
    if (safeRepoUrl) {
      repoLink.href = safeRepoUrl;
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

  const copyToClipboard = async (url, source) => {
    if (!navigator.clipboard?.writeText) {
      throw new Error('Clipboard sharing is not available in this browser.');
    }
    await navigator.clipboard.writeText(url);
    showToast('permalink copied to clipboard');
    setButtonState({ disabled: false, text: 'copied!' });
    trackUiEvent('report_shared_client', {
      repo_name: result.repo_name,
      method: 'clipboard',
      source,
    });
  };

  const shareWithNativeApi = async (url, source) => {
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
    trackUiEvent('report_shared_client', {
      repo_name: result.repo_name,
      method: 'native_share',
      source,
    });
    return true;
  };

  buttons.forEach((button) => {
    button.addEventListener('click', async () => {
      const shareSource = button.dataset.shareSource || 'report';
      setButtonState({ disabled: true, text: 'sharing...' });
      trackUiEvent('cta_clicked_client', {
        cta_name: 'share-report',
        source: shareSource,
        cta_type: 'button',
        repo_name: result.repo_name,
      });
      trackUiEvent('report_share_requested_client', {
        repo_name: result.repo_name,
        source: shareSource,
      });
      try {
        const url = await resolveShareUrl();
        const shared = await shareWithNativeApi(url, shareSource);
        if (!shared) {
          await copyToClipboard(url, shareSource);
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          resetButtons();
          return;
        }
        showToast(`error: ${err.message}`);
        trackUiEvent('report_share_failed_client', {
          repo_name: result.repo_name,
          error_name: err.name,
          reason: err.message,
          source: shareSource,
        });
        resetButtons();
      }
    });
  });
}
