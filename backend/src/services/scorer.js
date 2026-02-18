/**
 * Score calculation service.
 * Computes overall and per-assistant readiness scores.
 * @module scorer
 */

/**
 * @typedef {Object} AssistantScore
 * @property {number} score - Percentage score (0-100)
 * @property {number} detected - Number of detected primitives
 * @property {number} total - Total number of primitives for this assistant
 */

/**
 * Calculates the overall readiness score.
 * Score = (detected categories / total categories) × 100.
 * A category counts as detected if ANY primitive in that category is detected.
 * @param {Array<{category: string, detected: boolean}>} scanResults - Scan results
 * @returns {number} Overall score (0-100), rounded to nearest integer
 */
export function calculateOverallScore(scanResults) {
  if (scanResults.length === 0) {
    return 0;
  }

  // Group by category
  const categories = new Map();
  for (const result of scanResults) {
    if (!categories.has(result.category)) {
      categories.set(result.category, false);
    }
    if (result.detected) {
      categories.set(result.category, true);
    }
  }

  const totalCategories = categories.size;
  if (totalCategories === 0) {
    return 0;
  }

  const detectedCategories = [...categories.values()].filter(Boolean).length;
  return Math.round((detectedCategories / totalCategories) * 100);
}

/**
 * Calculates per-assistant readiness scores.
 * For each assistant: (detected primitives / total primitives) × 100.
 * @param {Array<{detected: boolean, assistants: string[]}>} scanResults - Scan results
 * @returns {Record<string, AssistantScore>} Scores keyed by assistant ID
 */
export function calculatePerAssistantScores(scanResults) {
  /** @type {Record<string, {detected: number, total: number}>} */
  const assistantStats = {};

  for (const result of scanResults) {
    if (!result.assistants) {
      continue;
    }

    for (const assistantId of result.assistants) {
      if (!assistantStats[assistantId]) {
        assistantStats[assistantId] = { detected: 0, total: 0 };
      }
      assistantStats[assistantId].total++;
      if (result.detected) {
        assistantStats[assistantId].detected++;
      }
    }
  }

  /** @type {Record<string, AssistantScore>} */
  const scores = {};
  for (const [assistantId, stats] of Object.entries(assistantStats)) {
    scores[assistantId] = {
      score: stats.total === 0 ? 0 : Math.round((stats.detected / stats.total) * 100),
      detected: stats.detected,
      total: stats.total,
    };
  }

  return scores;
}
