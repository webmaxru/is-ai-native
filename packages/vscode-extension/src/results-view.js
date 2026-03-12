function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderMetaRow(label, value) {
  if (value == null || value === '') {
    return '';
  }

  return `<div class="meta-row"><span class="meta-label">${escapeHtml(label)}</span><span class="meta-value">${escapeHtml(value)}</span></div>`;
}

function renderMatchedFiles(primitive, canOpenFiles) {
  if (!primitive.matched_files?.length) {
    return '<div class="file-empty">No matching files</div>';
  }

  return `<ul class="file-list">${primitive.matched_files
    .map((filePath) => {
      const label = escapeHtml(filePath);
      if (!canOpenFiles) {
        return `<li class="file-item"><span class="file-chip">${label}</span></li>`;
      }

      return `<li class="file-item"><button type="button" class="file-chip file-chip-button" data-open-file="${label}">${label}</button></li>`;
    })
    .join('')}</ul>`;
}

function renderPrimitive(primitive, canOpenFiles) {
  const statusClass = primitive.detected ? 'detected' : 'missing';

  return `
    <article class="primitive ${statusClass}">
      <div class="primitive-header">
        <div>
          <h3>${escapeHtml(primitive.name)}</h3>
          <p class="primitive-category">${escapeHtml(primitive.category)}</p>
        </div>
        <span class="status-pill">${primitive.detected ? 'Detected' : 'Missing'}</span>
      </div>
      <p class="primitive-description">${escapeHtml(primitive.description || '')}</p>
      ${renderMatchedFiles(primitive, canOpenFiles)}
    </article>
  `;
}

function renderAssistant(assistant) {
  return `<li class="assistant-item"><span>${escapeHtml(assistant.name)}</span><strong>${escapeHtml(`${assistant.score}%`)}</strong></li>`;
}

export function renderResultsHtml(result, { canOpenFiles = false, nonce } = {}) {
  const title = result.repo_name || result.repo_path || 'Is AI-Native Report';
  const scriptNonce = escapeHtml(nonce || '');

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${scriptNonce}';" />
      <title>Is AI-Native Results</title>
      <style>
        :root { color-scheme: light dark; }
        body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); }
        a { color: var(--vscode-textLink-foreground); }
        .hero { display: grid; gap: 14px; margin-bottom: 20px; }
        .hero h1 { margin: 0; font-size: 1.5rem; }
        .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
        .meta-row, .stat-card, .assistant-card, .primitive { border: 1px solid var(--vscode-panel-border); border-radius: 10px; background: color-mix(in srgb, var(--vscode-editor-background) 92%, var(--vscode-editor-foreground) 8%); }
        .meta-row { display: flex; justify-content: space-between; gap: 12px; padding: 10px 12px; }
        .meta-label { color: var(--vscode-descriptionForeground); }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; margin-bottom: 20px; }
        .stat-card { padding: 14px; }
        .stat-label { display: block; color: var(--vscode-descriptionForeground); margin-bottom: 8px; }
        .stat-value { font-size: 1.25rem; font-weight: 700; }
        .content-grid { display: grid; grid-template-columns: minmax(220px, 280px) minmax(0, 1fr); gap: 16px; align-items: start; }
        .assistant-card { padding: 14px; }
        .assistant-card h2, .primitives-panel h2 { margin-top: 0; }
        .assistant-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
        .assistant-item { display: flex; justify-content: space-between; gap: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--vscode-panel-border); }
        .assistant-item:last-child { border-bottom: 0; padding-bottom: 0; }
        .primitives-panel { display: grid; gap: 12px; }
        .primitive { padding: 14px; }
        .primitive.detected { border-color: var(--vscode-testing-iconPassed); }
        .primitive.missing { border-color: var(--vscode-testing-iconFailed); }
        .primitive-header { display: flex; justify-content: space-between; gap: 12px; align-items: start; margin-bottom: 8px; }
        .primitive-header h3 { margin: 0 0 4px; }
        .primitive-category, .primitive-description, .file-empty { color: var(--vscode-descriptionForeground); margin: 0; }
        .status-pill { padding: 4px 8px; border-radius: 999px; border: 1px solid var(--vscode-panel-border); font-size: 0.85rem; }
        .file-list { list-style: none; padding: 0; margin: 12px 0 0; display: flex; flex-wrap: wrap; gap: 8px; }
        .file-item { margin: 0; }
        .file-chip { display: inline-flex; padding: 6px 10px; border-radius: 999px; border: 1px solid var(--vscode-panel-border); font-family: var(--vscode-editor-font-family, var(--vscode-font-family)); font-size: 0.85rem; }
        .file-chip-button { background: transparent; color: inherit; cursor: pointer; }
        .file-chip-button:hover { border-color: var(--vscode-textLink-foreground); }
        @media (max-width: 800px) { .content-grid { grid-template-columns: 1fr; } }
      </style>
    </head>
    <body>
      <section class="hero">
        <div>
          <h1>${escapeHtml(title)}</h1>
          ${result.repo_url ? `<p><a href="${escapeHtml(result.repo_url)}">Open repository</a></p>` : ''}
        </div>
        <div class="meta-grid">
          ${renderMetaRow('Scanned', result.scanned_at)}
          ${renderMetaRow('Branch', result.branch)}
          ${renderMetaRow('Paths Scanned', result.paths_scanned)}
          ${renderMetaRow('Source', result.source)}
        </div>
      </section>
      <section class="stats">
        <article class="stat-card"><span class="stat-label">Overall Score</span><div class="stat-value">${escapeHtml(`${result.score}%`)}</div></article>
        <article class="stat-card"><span class="stat-label">Verdict</span><div class="stat-value">${escapeHtml(result.verdict)}</div></article>
        <article class="stat-card"><span class="stat-label">Detected Primitives</span><div class="stat-value">${escapeHtml(String((result.primitives || []).filter((primitive) => primitive.detected).length))}/${escapeHtml(String((result.primitives || []).length))}</div></article>
      </section>
      <section class="content-grid">
        <aside class="assistant-card">
          <h2>Per Assistant</h2>
          <ul class="assistant-list">${(result.per_assistant || []).map(renderAssistant).join('')}</ul>
        </aside>
        <section class="primitives-panel">
          <h2>Primitives</h2>
          ${(result.primitives || []).map((primitive) => renderPrimitive(primitive, canOpenFiles)).join('')}
        </section>
      </section>
      <script nonce="${scriptNonce}">
        const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
        document.addEventListener('click', (event) => {
          const trigger = event.target.closest('[data-open-file]');
          if (!trigger || !vscode) {
            return;
          }

          vscode.postMessage({ type: 'open-file', path: trigger.getAttribute('data-open-file') });
        });
      </script>
    </body>
  </html>`;
}