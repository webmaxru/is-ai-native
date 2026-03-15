function escapeCsv(value) {
  const stringValue = value == null ? '' : String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}

function getVerdictForScore(score) {
  if (score >= 60) return 'AI-Native';
  if (score >= 30) return 'AI-Assisted';
  return 'Traditional';
}

function getPreferredAssistant(result) {
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

function formatHuman(result) {
  const preferredAssistant = getPreferredAssistant(result);
  const preferredScore = preferredAssistant ? preferredAssistant.score : result.score;
  const preferredVerdict = preferredAssistant ? getVerdictForScore(preferredAssistant.score) : result.verdict;
  const assistants = Array.isArray(result.per_assistant) ? result.per_assistant : [];
  const primitiveSections = assistants.length > 0
    ? assistants.flatMap((assistant) => {
        const assistantVerdict = getVerdictForScore(assistant.score);
        const heading = `${assistant.name}${preferredAssistant?.name === assistant.name ? ' (preferred agent)' : ''}: ${assistant.score}% (${assistantVerdict})`;
        const primitives = (assistant.primitives || []).map((primitive) => {
          const status = primitive.detected ? '[x]' : '[ ]';
          const matches = primitive.matched_files.length > 0 ? ` -> ${primitive.matched_files.join(', ')}` : '';
          return `${status} ${primitive.name}${matches}`;
        });

        return [heading, ...primitives, ''];
      })
    : [];

  const lines = [
    `Repository: ${result.repo_name || result.repo_path || 'unknown'}`,
    result.repo_url ? `URL: ${result.repo_url}` : `Path: ${result.repo_path}`,
    result.branch ? `Branch: ${result.branch}` : null,
    Number.isFinite(result.paths_scanned) ? `Paths Scanned: ${result.paths_scanned}` : null,
    preferredAssistant ? `Preferred Agent: ${preferredAssistant.name}` : null,
    `Readiness Score: ${preferredScore}% (${preferredVerdict})`,
    '',
    'Per-assistant:',
    ...assistants.map((assistant) => `- ${assistant.name}: ${assistant.score}%`),
    '',
    assistants.length > 0 ? 'Per-assistant primitives:' : 'Primitives:',
    ...(assistants.length > 0
      ? primitiveSections
      : result.primitives.map((primitive) => {
          const status = primitive.detected ? '[x]' : '[ ]';
          const matches = primitive.matched_files.length > 0 ? ` -> ${primitive.matched_files.join(', ')}` : '';
          return `${status} ${primitive.name}${matches}`;
        })),
  ];

  return lines.filter(Boolean).join('\n');
}

function formatCsv(result) {
  const header = [
    'repo_name',
    'repo_url',
    'repo_path',
    'verdict',
    'score',
    'primitive_name',
    'primitive_category',
    'detected',
    'matched_files',
  ];

  const rows = result.primitives.map((primitive) => [
    result.repo_name,
    result.repo_url,
    result.repo_path,
    result.verdict,
    result.score,
    primitive.name,
    primitive.category,
    primitive.detected,
    primitive.matched_files.join('|'),
  ]);

  return [header, ...rows]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\n');
}

export function formatResult(result, format = 'json') {
  if (format === 'human') {
    return formatHuman(result);
  }

  if (format === 'csv') {
    return formatCsv(result);
  }

  if (format === 'summary') {
    const repoLabel = result.repo_name || result.repo_path || 'unknown';
    const branchLabel = result.branch ? ` @ ${result.branch}` : '';
    const preferredAssistant = getPreferredAssistant(result);
    const preferredScore = preferredAssistant ? preferredAssistant.score : result.score;
    const preferredVerdict = preferredAssistant ? getVerdictForScore(preferredAssistant.score) : result.verdict;
    const assistantLabel = preferredAssistant ? ` [preferred: ${preferredAssistant.name}]` : '';
    return `${repoLabel}: ${preferredScore}% (${preferredVerdict})${assistantLabel}${branchLabel}`;
  }

  return JSON.stringify(result, null, 2);
}
