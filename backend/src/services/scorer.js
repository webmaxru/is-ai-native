/**
 * Calculates the overall readiness score using a category-based hybrid model.
 *
 * Overall score = (number of categories with at least one detected pattern across any assistant)
 *                 / (total defined categories) × 100
 *
 * @param {object[]} primitiveResults - Array of primitive scan results
 * @param {string} primitiveResults[].category - Primitive category
 * @param {boolean} primitiveResults[].detected - Whether the primitive was detected
 * @returns {number} Overall score 0–100 (rounded)
 */
export function calculateOverallScore(primitiveResults) {
  const categories = new Set(primitiveResults.map((p) => p.category));
  if (categories.size === 0) return 0;

  const detectedCategories = new Set(
    primitiveResults.filter((p) => p.detected).map((p) => p.category)
  );

  return Math.round((detectedCategories.size / categories.size) * 100);
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

      const detected = relevantPrimitives.filter((p) => p.detected).length;
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
