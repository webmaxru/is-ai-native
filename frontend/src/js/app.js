/**
 * Main application module.
 * Handles form submission, input validation, progress indicators, and error display.
 * @module app
 */

import { scanRepository } from './api.js';
import { renderReport } from './report.js';

/** Progress stages displayed during a scan */
const PROGRESS_STAGES = ['Fetching file tree…', 'Matching patterns…', 'Generating report…'];

/** Minimum display time per stage in ms */
const STAGE_MIN_DISPLAY = 600;

/**
 * Initialises the application: wires up event listeners and manages scan lifecycle.
 */
export function initApp() {
  const form = document.getElementById('scan-form');
  const urlInput = document.getElementById('repo-url');
  const submitBtn = form.querySelector('button[type="submit"]');
  const errorArea = document.getElementById('error-area');
  const errorMessage = document.getElementById('error-message');
  const progressArea = document.getElementById('progress-area');
  const progressText = document.getElementById('progress-stage');
  const reportArea = document.getElementById('report-area');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError(errorArea, errorMessage);
    clearReport(reportArea);

    const url = urlInput.value.trim();
    const validationError = validateUrl(url);
    if (validationError) {
      showError(errorArea, errorMessage, validationError);
      urlInput.focus();
      return;
    }

    setLoading(submitBtn, true);
    showProgress(progressArea, progressText);

    try {
      const stagePromise = animateStages(progressText);
      const data = await scanRepository(url);
      await stagePromise; // ensure stages complete visually
      hideProgress(progressArea);
      renderReport(data, reportArea);
      reportArea.classList.remove('hidden');
    } catch (err) {
      hideProgress(progressArea);
      showError(errorArea, errorMessage, formatError(err));
    } finally {
      setLoading(submitBtn, false);
    }
  });
}

/**
 * Validates a GitHub repository URL.
 * @param {string} url - URL to validate
 * @returns {string|null} Error message or null if valid
 */
function validateUrl(url) {
  if (!url) {
    return 'Please enter a GitHub repository URL.';
  }
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'github.com' && parsed.hostname !== 'www.github.com') {
      return 'Please enter a valid GitHub URL (e.g. https://github.com/owner/repo).';
    }
    const segments = parsed.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    if (segments.length < 2) {
      return 'URL must include both owner and repository name (e.g. https://github.com/owner/repo).';
    }
  } catch {
    return 'Please enter a valid URL starting with https://.';
  }
  return null;
}

/**
 * Shows an error message in the error area.
 * @param {HTMLElement} area - Error container
 * @param {HTMLElement} msgEl - Error message paragraph
 * @param {string} message - Error message to display
 */
function showError(area, msgEl, message) {
  msgEl.textContent = message;
  area.classList.remove('hidden');
}

/**
 * Clears the error area.
 * @param {HTMLElement} area - Error container
 * @param {HTMLElement} msgEl - Error message paragraph
 */
function clearError(area, msgEl) {
  msgEl.textContent = '';
  area.classList.add('hidden');
}

/**
 * Clears the report area.
 * @param {HTMLElement} area - Report container
 */
function clearReport(area) {
  area.innerHTML = '';
  area.classList.add('hidden');
}

/**
 * Toggles loading state on the submit button.
 * @param {HTMLButtonElement} btn - Submit button
 * @param {boolean} loading - Whether to show loading state
 */
function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.setAttribute('aria-busy', String(loading));
  btn.textContent = loading ? 'Scanning…' : 'Scan Repository';
}

/**
 * Shows the progress area.
 * @param {HTMLElement} area - Progress container
 * @param {HTMLElement} text - Progress text element
 */
function showProgress(area, text) {
  text.textContent = PROGRESS_STAGES[0];
  area.classList.remove('hidden');
  area.setAttribute('aria-valuenow', '0');
}

/**
 * Hides the progress area.
 * @param {HTMLElement} area - Progress container
 */
function hideProgress(area) {
  area.classList.add('hidden');
}

/**
 * Animates through progress stages with minimum display time.
 * Returns a promise that resolves once all stages have been shown.
 * @param {HTMLElement} textEl - Progress text element
 * @returns {Promise<void>}
 */
function animateStages(textEl) {
  return new Promise((resolve) => {
    let i = 0;
    function next() {
      if (i >= PROGRESS_STAGES.length) {
        resolve();
        return;
      }
      textEl.textContent = PROGRESS_STAGES[i];
      i++;
      setTimeout(next, STAGE_MIN_DISPLAY);
    }
    next();
  });
}

/**
 * Formats an API error into a user-friendly message.
 * @param {Error} err - Error from the API client
 * @returns {string} User-friendly error message
 */
function formatError(err) {
  if (err.name === 'AbortError') {
    return 'The request timed out. Please try again.';
  }
  if (err.statusCode === 404) {
    return 'Repository not found. Please check the URL and try again.';
  }
  if (err.statusCode === 403) {
    return 'Access denied. The repository may be private or the rate limit was exceeded.';
  }
  if (err.statusCode === 429) {
    const retryAfter = err.retryAfter ? ` Try again in ${err.retryAfter} seconds.` : '';
    return `Rate limit exceeded.${retryAfter}`;
  }
  return err.message || 'An unexpected error occurred. Please try again.';
}

// Auto-initialise when the DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}
