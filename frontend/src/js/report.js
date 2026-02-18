/**
 * Report rendering module.
 * Displays scan results including overall score, per-assistant breakdown, and primitive details.
 * @module report
 */

/**
 * Gets the score class based on the score value.
 * @param {number} score - Score (0-100)
 * @returns {'high' | 'medium' | 'low'} Score level
 */
function getScoreLevel(score) {
  if (score > 66) {
    return 'high';
  }
  if (score >= 33) {
    return 'medium';
  }
  return 'low';
}

/**
 * Renders the complete readiness report.
 * @param {Object} data - Scan response data
 * @param {string} data.repoUrl - Repository URL
 * @param {number} data.overallScore - Overall readiness score
 * @param {Object} data.perAssistant - Per-assistant scores
 * @param {Array} data.primitives - Primitive detection results
 * @param {HTMLElement} container - Container element to render into
 */
export function renderReport(data, container) {
  container.innerHTML = '';

  // Check for zero-state
  const anyDetected = data.primitives.some((p) => p.detected);
  if (!anyDetected) {
    container.appendChild(renderZeroState());
    return;
  }

  // Overall score
  container.appendChild(renderOverallScore(data.overallScore));

  // Per-assistant breakdown
  if (data.perAssistant) {
    const assistantSection = document.createElement('div');
    assistantSection.className = 'assistant-sections';

    for (const [assistantId, scores] of Object.entries(data.perAssistant)) {
      const assistantPrimitives = data.primitives.filter((p) =>
        p.assistants.includes(assistantId),
      );
      assistantSection.appendChild(
        renderAssistantCard(assistantId, scores, assistantPrimitives),
      );
    }

    container.appendChild(assistantSection);
  }
}

/**
 * Renders the overall score section.
 * @param {number} score - Overall score (0-100)
 * @returns {HTMLElement} Score element
 */
function renderOverallScore(score) {
  const level = getScoreLevel(score);
  const section = document.createElement('div');
  section.className = `overall-score score-${level}`;
  section.innerHTML = `
    <div class="score-value" aria-label="Readiness score: ${score} percent">${score}%</div>
    <div class="score-label">Overall AI-Native Readiness Score</div>
    <div class="score-bar-container">
      <div class="score-bar" style="width: ${score}%"></div>
    </div>
  `;
  return section;
}

/**
 * Renders a per-assistant card with collapsible primitive list.
 * @param {string} assistantId - Assistant identifier
 * @param {Object} scores - Assistant score data
 * @param {number} scores.score - Score percentage
 * @param {number} scores.detected - Detected count
 * @param {number} scores.total - Total count
 * @param {Array} primitives - Primitives for this assistant
 * @returns {HTMLElement} Assistant card element
 */
function renderAssistantCard(assistantId, scores, primitives) {
  const level = getScoreLevel(scores.score);
  const displayName = getAssistantDisplayName(assistantId);

  const card = document.createElement('div');
  card.className = 'assistant-section';
  card.innerHTML = `
    <div class="assistant-card">
      <button class="assistant-header" aria-expanded="true" aria-controls="content-${assistantId}">
        <span class="assistant-name">${displayName}</span>
        <span class="assistant-score-badge badge-${level}">${scores.score}% (${scores.detected}/${scores.total})</span>
      </button>
      <div id="content-${assistantId}" class="assistant-content">
        <ul class="primitive-list" role="list">
          ${primitives.map((p) => renderPrimitiveItem(p)).join('')}
        </ul>
      </div>
    </div>
  `;

  // Toggle collapse
  const header = card.querySelector('.assistant-header');
  const content = card.querySelector('.assistant-content');
  header.addEventListener('click', () => {
    const expanded = header.getAttribute('aria-expanded') === 'true';
    header.setAttribute('aria-expanded', String(!expanded));
    content.classList.toggle('collapsed');
  });

  return card;
}

/**
 * Renders a single primitive item.
 * @param {Object} primitive - Primitive detection result
 * @returns {string} HTML string for the primitive item
 */
function renderPrimitiveItem(primitive) {
  const statusClass = primitive.detected ? 'detected' : 'missing';
  const statusLabel = primitive.detected ? 'Detected' : 'Missing';

  const filesHtml =
    primitive.detected && primitive.matchedFiles.length > 0
      ? `<div class="primitive-files">Found: ${primitive.matchedFiles.map((f) => `<code>${escapeHtml(f)}</code>`).join(', ')}</div>`
      : '';

  const docLinksHtml =
    primitive.docLinks.length > 0
      ? `<div class="primitive-doc-links">${primitive.docLinks.map((link) => `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">Documentation ↗</a>`).join(' ')}</div>`
      : '';

  return `
    <li class="primitive-item" aria-label="${escapeHtml(primitive.name)}: ${statusLabel}">
      <span class="primitive-status primitive-status-${statusClass}" aria-hidden="true"></span>
      <div class="primitive-details">
        <div class="primitive-name">${escapeHtml(primitive.name)}</div>
        <div class="primitive-description">${escapeHtml(primitive.description)}</div>
        ${filesHtml}
        ${docLinksHtml}
      </div>
    </li>
  `;
}

/**
 * Renders the zero-state when no primitives are detected.
 * @returns {HTMLElement} Zero state element
 */
function renderZeroState() {
  const section = document.createElement('div');
  section.className = 'zero-state';
  section.innerHTML = `
    <div class="overall-score score-low">
      <div class="score-value" aria-label="Readiness score: 0 percent">0%</div>
      <div class="score-label">Overall AI-Native Readiness Score</div>
      <div class="score-bar-container">
        <div class="score-bar" style="width: 0%"></div>
      </div>
    </div>
    <h3>No AI-Native Primitives Detected</h3>
    <p>This repository doesn't have any AI-native development configuration files yet.
       Get started by adding instruction files, saved prompts, or MCP configurations
       for your preferred AI assistant.</p>
    <p>Check the documentation for <a href="https://docs.github.com/en/copilot" target="_blank" rel="noopener noreferrer">GitHub Copilot</a>,
    <a href="https://docs.anthropic.com/en/docs/claude-code/overview" target="_blank" rel="noopener noreferrer">Claude Code</a>, or
    <a href="https://platform.openai.com/docs/guides/codex" target="_blank" rel="noopener noreferrer">OpenAI Codex</a> to learn more.</p>
  `;
  return section;
}

/**
 * Maps assistant ID to display name.
 * @param {string} assistantId - Assistant identifier
 * @returns {string} Display name
 */
function getAssistantDisplayName(assistantId) {
  const names = {
    'github-copilot': 'GitHub Copilot',
    'claude-code': 'Claude Code',
    'openai-codex': 'OpenAI Codex',
  };
  return names[assistantId] || assistantId;
}

/**
 * Escapes HTML special characters to prevent XSS.
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
