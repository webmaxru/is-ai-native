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

function primitiveRow(prim) {
  const statusIcon = prim.detected ? '✅' : '❌';
  const statusClass = prim.detected ? 'detected' : 'not-detected';

  const matchedHtml = prim.matched_files?.length
    ? `<span class="matched-files">${prim.matched_files.map((f) => escapeHtml(f)).join(', ')}</span>`
    : '';

  const docLinksHtml = prim.doc_links?.length
    ? `<div class="doc-links">${prim.doc_links
        .map((link) => `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">📖 Docs</a>`)
        .join(' ')}</div>`
    : '';

  const descHtml = prim.description
    ? `<p class="primitive-desc">${escapeHtml(prim.description)}</p>`
    : '';

  return `
    <li class="primitive-item ${statusClass}">
      <div class="primitive-header">
        <span class="primitive-icon">${statusIcon}</span>
        <span class="primitive-name">${escapeHtml(prim.name)}</span>
        <span class="primitive-category">${escapeHtml(prim.category)}</span>
      </div>
      ${matchedHtml}
      ${descHtml}
      ${docLinksHtml}
    </li>`;
}

function assistantSection(assistant) {
  const colorClass = scoreColorClass(assistant.score);

  return `
    <details class="assistant-card" open>
      <summary class="assistant-header">
        <span class="assistant-name">${escapeHtml(assistant.name)}</span>
        <span class="assistant-score ${colorClass}">${assistant.score}%</span>
      </summary>
      <ul class="primitive-list">
        ${assistant.primitives.map(primitiveRow).join('')}
      </ul>
    </details>`;
}

export function renderReport(result, { sharingEnabled = false } = {}) {
  const el = document.getElementById('report');
  const vClass = verdictClass(result.verdict);
  const sColorClass = scoreColorClass(result.score);
  const shareButtonsHtml = sharingEnabled
    ? '<button type="button" class="share-btn" data-share-report>🔗 Share Report</button>'
    : '';

  const hasPerAssistant = result.per_assistant?.length > 0;
  const hasPrimitives = result.primitives?.length > 0;

  const overallPrimitivesHtml = hasPrimitives
    ? `<section class="report-section">
        <h3>All Primitives</h3>
        <ul class="primitive-list">${result.primitives.map(primitiveRow).join('')}</ul>
      </section>`
    : `<section class="report-section">
        <h3>All Primitives</h3>
        <p class="empty-state">No AI-native primitives detected. Check the documentation links below to get started.</p>
      </section>`;

  const perAssistantHtml = hasPerAssistant
    ? `<section class="report-section">
        <h3>Per-Assistant Breakdown</h3>
        ${result.per_assistant.map(assistantSection).join('')}
      </section>`
    : '';

  el.innerHTML = `
    <div class="report-card">
      <div class="report-header">
        <h2 class="repo-name">
          <a id="repo-link" target="_blank" rel="noopener noreferrer">
            ${escapeHtml(result.repo_name)}
          </a>
        </h2>
        ${result.description ? `<p class="repo-desc">${escapeHtml(result.description)}</p>` : ''}
        ${sharingEnabled ? `<div class="report-actions">${shareButtonsHtml}</div>` : ''}
        <div class="score-row">
          <div class="score-badge ${escapeHtml(vClass)}">
            <span class="score-number">${escapeHtml(String(result.score))}</span>
            <span class="score-label">/ 100</span>
          </div>
          <span class="verdict ${escapeHtml(vClass)}">
            ${escapeHtml(result.verdict)}
          </span>
        </div>
        <div class="score-bar-container">
          <div class="score-bar ${sColorClass}" style="width: ${Math.max(2, result.score)}%" role="progressbar" aria-valuenow="${result.score}" aria-valuemin="0" aria-valuemax="100" aria-label="Readiness score: ${result.score} percent"></div>
        </div>
      </div>

      ${perAssistantHtml}
      ${overallPrimitivesHtml}

      <div class="report-footer">
        <span class="scanned-at">Scanned ${escapeHtml(new Date(result.scanned_at).toLocaleString())}</span>
        ${shareButtonsHtml}
      </div>
    </div>
  `;

  // Set repo link href via DOM API to prevent javascript: scheme XSS
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
    setButtonState({ disabled: false, text: '🔗 Share Report' });
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
    showToast('✅ Permalink copied to clipboard!');
    setButtonState({ disabled: false, text: '✅ Copied!' });
  };

  const shareWithNativeApi = async (url) => {
    if (!navigator.share) {
      return false;
    }

    const shareData = {
      title: `${result.repo_name} AI-native report`,
      text: `AI-native readiness report for ${result.repo_name}`,
      url,
    };

    if (navigator.canShare && !navigator.canShare(shareData)) {
      return false;
    }

    await navigator.share(shareData);
    showToast('✅ Report link ready to share.');
    setButtonState({ disabled: false, text: '✅ Shared' });
    return true;
  };

  buttons.forEach((button) => {
    button.addEventListener('click', async () => {
      setButtonState({ disabled: true, text: 'Sharing…' });

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

        showToast(`❌ ${err.message}`);
        resetButtons();
      }
    });
  });
}
