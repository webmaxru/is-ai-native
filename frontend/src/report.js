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
        ${sharingEnabled ? '<button id="share-btn" class="share-btn">🔗 Share Report</button>' : ''}
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
  const btn = document.getElementById('share-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Sharing…';
    try {
      const { url } = await shareReport(result);
      await navigator.clipboard.writeText(url);
      showToast('✅ Permalink copied to clipboard!');
      btn.textContent = '✅ Copied!';
    } catch (err) {
      showToast(`❌ ${err.message}`);
      btn.disabled = false;
      btn.textContent = '🔗 Share Report';
    }
  });
}
