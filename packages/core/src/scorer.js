/**
 * Calculates the overall readiness score across all supported assistant/primitive pairs.
 *
 * Overall score = (detected assistant-specific primitive matches)
 *                 / (total assistant-specific primitive opportunities) × 100
 *
 * This ensures that a primitive only counts for the assistants that actually support it,
 * and missing coverage for one assistant is not masked by another assistant matching the
 * same primitive category.
 *
 * @param {object[]} primitiveResults - Array of primitive scan results
 * @param {object} primitiveResults[].assistant_results - Per-assistant detection results
 * @returns {number} Overall score 0–100 (rounded)
 */
export function calculateOverallScore(primitiveResults) {
  let totalOpportunities = 0;
  let detectedOpportunities = 0;

  for (const primitive of primitiveResults) {
    for (const assistantResult of Object.values(primitive.assistant_results || {})) {
      totalOpportunities += 1;
      if (assistantResult?.detected) {
        detectedOpportunities += 1;
      }
    }
  }

  if (totalOpportunities === 0) return 0;

  return Math.round((detectedOpportunities / totalOpportunities) * 100);
}

/**
 * Calculates per-assistant readiness scores.
 *
 * Per-assistant score = (detected primitives for that assistant / total primitives for that assistant) × 100
 *
 * @param {object[]} primitiveResults - Array of primitive scan results
 * @param {object[]} primitiveResults[].assistant_results - Per-assistant detection results
 * @param {object[]} assistantDefs - Assistant definitions from config
 * @param {string} assistantDefs[].id - Assistant ID
 * @param {string} assistantDefs[].name - Assistant display name
 * @returns {object[]} Per-assistant breakdowns with scores
 */
export function calculatePerAssistantScores(primitiveResults, assistantDefs) {
  return assistantDefs
    .map((assistant) => {
      const relevantPrimitives = [];

      for (const prim of primitiveResults) {
        const assistantResult = prim.assistant_results?.[assistant.id];
        if (assistantResult) {
          relevantPrimitives.push({
            name: prim.name,
            category: prim.category,
            detected: assistantResult.detected,
            matched_files: assistantResult.matched_files,
          });
        }
      }

      if (relevantPrimitives.length === 0) return null;

      const detected = relevantPrimitives.filter((primitive) => primitive.detected).length;
      const score = Math.round((detected / relevantPrimitives.length) * 100);

      return {
        id: assistant.id,
        name: assistant.name,
        score,
        primitives: relevantPrimitives,
      };
    })
    .filter(Boolean);
}

/**
 * Determines the readiness verdict based on the overall score.
 * @param {number} score - Overall score 0–100
 * @returns {string} 'AI-Native' | 'AI-Assisted' | 'Traditional'
 */
export function getVerdict(score) {
  if (score >= 60) return 'AI-Native';
  if (score >= 30) return 'AI-Assisted';
  return 'Traditional';
}

/**
 * Selects the score used for the shared top-level verdict.
 *
 * The overall score still reflects assistant-specific coverage across all supported
 * assistant/primitive pairs. The top-level verdict, however, follows the strongest
 * assistant readiness so a repo can surface its best-supported assistant directly.
 *
 * @param {object[]} perAssistantScores - Per-assistant score breakdowns
 * @param {number} [fallbackScore=0] - Score to use when no per-assistant scores exist
 * @returns {number} Score 0-100 used to determine the top-level verdict
 */
export function calculateTopLevelVerdictScore(perAssistantScores, fallbackScore = 0) {
  if (!Array.isArray(perAssistantScores) || perAssistantScores.length === 0) {
    return fallbackScore;
  }

  return perAssistantScores.reduce((maxScore, assistant) => {
    const assistantScore = Number.isFinite(assistant?.score) ? assistant.score : 0;
    return Math.max(maxScore, assistantScore);
  }, 0);
}