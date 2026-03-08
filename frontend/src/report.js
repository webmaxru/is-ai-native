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

function indicatorList(items) {
  return items
    .map(
      (item) => `
      <li class="indicator ${item.detected ? 'detected' : 'not-detected'}">
        <span class="indicator-icon">${item.detected ? '✅' : '❌'}</span>
        <span class="indicator-name">${escapeHtml(item.name)}</span>
      </li>`
    )
    .join('');
}

export function renderReport(result, { sharingEnabled = false } = {}) {
  const el = document.getElementById('report');
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
          <div class="score-badge ${escapeHtml(verdictClass(result.verdict))}">
            <span class="score-number">${escapeHtml(String(result.score))}</span>
            <span class="score-label">/ 100</span>
          </div>
          <span class="verdict ${escapeHtml(verdictClass(result.verdict))}">
            ${escapeHtml(result.verdict)}
          </span>
        </div>
      </div>

      <div class="report-sections">
        <section>
          <h3>AI Assistants</h3>
          <ul class="indicator-list">${indicatorList(result.assistants)}</ul>
        </section>
        <section>
          <h3>AI-Native Primitives</h3>
          <ul class="indicator-list">${indicatorList(result.primitives)}</ul>
        </section>
      </div>

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
