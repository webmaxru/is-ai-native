function escapeCsv(value) {
  const stringValue = value == null ? '' : String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}

function formatHuman(result) {
  const lines = [
    `Repository: ${result.repo_name || result.repo_path || 'unknown'}`,
    result.repo_url ? `URL: ${result.repo_url}` : `Path: ${result.repo_path}`,
    result.branch ? `Branch: ${result.branch}` : null,
    Number.isFinite(result.paths_scanned) ? `Paths Scanned: ${result.paths_scanned}` : null,
    `Overall Score: ${result.score}% (${result.verdict})`,
    '',
    'Per-assistant:',
    ...result.per_assistant.map((assistant) => `- ${assistant.name}: ${assistant.score}%`),
    '',
    'Primitives:',
    ...result.primitives.map((primitive) => {
      const status = primitive.detected ? '[x]' : '[ ]';
      const matches = primitive.matched_files.length > 0 ? ` -> ${primitive.matched_files.join(', ')}` : '';
      return `${status} ${primitive.name}${matches}`;
    }),
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
    return `${repoLabel}: ${result.score}% (${result.verdict})${branchLabel}`;
  }

  return JSON.stringify(result, null, 2);
}
