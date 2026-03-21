const VALID_VERDICTS = new Set(['AI-Native', 'AI-Assisted', 'Traditional']);
const VALID_SOURCES = new Set(['github', 'unknown']);
const MAX_PRIMITIVES = 200;
const MAX_ASSISTANTS = 20;
const MAX_MATCHED_FILES = 200;
const MAX_DOC_LINKS = 10;

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function expectPlainObject(value, name) {
  if (!isPlainObject(value)) {
    throw new Error(`${name} must be an object`);
  }

  return value;
}

function normalizeString(value, name, { maxLength, allowNull = false } = {}) {
  if (value == null) {
    if (allowNull) {
      return null;
    }
    throw new Error(`${name} must be a string`);
  }

  if (typeof value !== 'string') {
    throw new Error(`${name} must be a string`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${name} must not be empty`);
  }

  if (trimmed.length > maxLength) {
    throw new Error(`${name} must be at most ${maxLength} characters`);
  }

  return trimmed;
}

function normalizeOptionalString(value, name, { maxLength } = {}) {
  if (value == null || value === '') {
    return null;
  }

  return normalizeString(value, name, { maxLength, allowNull: true });
}

function normalizeInteger(value, name, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }

  return value;
}

function normalizeHttpUrl(value, name, { requireGitHubHost = false } = {}) {
  const url = normalizeString(value, name, { maxLength: 2048 });

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`${name} must use https`);
  }

  if (requireGitHubHost && parsed.hostname !== 'github.com') {
    throw new Error(`${name} must be a github.com URL`);
  }

  return parsed.href;
}

function normalizeStringArray(value, name, { maxItems, maxLength } = {}) {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array`);
  }

  if (value.length > maxItems) {
    throw new Error(`${name} must contain at most ${maxItems} items`);
  }

  return value.map((item, index) => normalizeString(item, `${name}[${index}]`, { maxLength }));
}

function normalizePrimitive(value, index, { includeDocLinks } = {}) {
  const primitive = expectPlainObject(value, `result.primitives[${index}]`);

  const normalized = {
    name: normalizeString(primitive.name, `result.primitives[${index}].name`, { maxLength: 120 }),
    category: normalizeString(primitive.category, `result.primitives[${index}].category`, { maxLength: 80 }),
    detected: Boolean(primitive.detected),
    matched_files: normalizeStringArray(primitive.matched_files || [], `result.primitives[${index}].matched_files`, {
      maxItems: MAX_MATCHED_FILES,
      maxLength: 1024,
    }),
  };

  if (hasOwn(primitive, 'description')) {
    normalized.description = normalizeOptionalString(primitive.description, `result.primitives[${index}].description`, {
      maxLength: 2000,
    });
  }

  if (includeDocLinks && hasOwn(primitive, 'doc_links')) {
    normalized.doc_links = normalizeStringArray(primitive.doc_links || [], `result.primitives[${index}].doc_links`, {
      maxItems: MAX_DOC_LINKS,
      maxLength: 2048,
    }).map((link, linkIndex) => normalizeHttpUrl(link, `result.primitives[${index}].doc_links[${linkIndex}]`));
  }

  if (hasOwn(primitive, 'assistant_results')) {
    normalized.assistant_results = normalizeAssistantResults(
      primitive.assistant_results,
      `result.primitives[${index}].assistant_results`
    );
  }

  return normalized;
}

function normalizeAssistantResults(value, name) {
  const assistantResults = expectPlainObject(value, name);

  return Object.fromEntries(
    Object.entries(assistantResults).map(([assistantId, assistantResult]) => {
      const normalizedResult = expectPlainObject(assistantResult, `${name}.${assistantId}`);

      return [
        assistantId,
        {
          detected: Boolean(normalizedResult.detected),
          matched_files: normalizeStringArray(
            normalizedResult.matched_files || [],
            `${name}.${assistantId}.matched_files`,
            {
              maxItems: MAX_MATCHED_FILES,
              maxLength: 1024,
            }
          ),
        },
      ];
    })
  );
}

function normalizeAssistant(value, index) {
  const assistant = expectPlainObject(value, `result.per_assistant[${index}]`);
  const primitives = Array.isArray(assistant.primitives) ? assistant.primitives : [];

  return {
    id: normalizeString(assistant.id, `result.per_assistant[${index}].id`, { maxLength: 80 }),
    name: normalizeString(assistant.name, `result.per_assistant[${index}].name`, { maxLength: 120 }),
    score: normalizeInteger(assistant.score, `result.per_assistant[${index}].score`, { min: 0, max: 100 }),
    primitives: primitives.map((primitive, primitiveIndex) => ({
      name: normalizeString(primitive?.name, `result.per_assistant[${index}].primitives[${primitiveIndex}].name`, {
        maxLength: 120,
      }),
      category: normalizeString(
        primitive?.category,
        `result.per_assistant[${index}].primitives[${primitiveIndex}].category`,
        { maxLength: 80 }
      ),
      detected: Boolean(primitive?.detected),
      matched_files: normalizeStringArray(
        primitive?.matched_files || [],
        `result.per_assistant[${index}].primitives[${primitiveIndex}].matched_files`,
        {
          maxItems: MAX_MATCHED_FILES,
          maxLength: 1024,
        }
      ),
    })),
  };
}

export function normalizeSharedReportResult(value) {
  const result = expectPlainObject(value, 'result');

  if (result.repo_path != null) {
    throw new Error('Shared reports only support GitHub repository scans');
  }

  const repoUrl = normalizeHttpUrl(result.repo_url, 'result.repo_url', { requireGitHubHost: true });
  let source;
  if (hasOwn(result, 'source')) {
    source = normalizeString(result.source, 'result.source', { maxLength: 20 });

    if (!VALID_SOURCES.has(source)) {
      throw new Error(`result.source must be one of: ${Array.from(VALID_SOURCES).join(', ')}`);
    }
  }

  const verdict = normalizeString(result.verdict, 'result.verdict', { maxLength: 40 });
  if (!VALID_VERDICTS.has(verdict)) {
    throw new Error(`result.verdict must be one of: ${Array.from(VALID_VERDICTS).join(', ')}`);
  }

  const primitives = Array.isArray(result.primitives) ? result.primitives : null;
  if (!primitives) {
    throw new Error('result.primitives must be an array');
  }
  if (primitives.length > MAX_PRIMITIVES) {
    throw new Error(`result.primitives must contain at most ${MAX_PRIMITIVES} items`);
  }

  const perAssistant = Array.isArray(result.per_assistant) ? result.per_assistant : null;
  if (!perAssistant) {
    throw new Error('result.per_assistant must be an array');
  }
  if (perAssistant.length > MAX_ASSISTANTS) {
    throw new Error(`result.per_assistant must contain at most ${MAX_ASSISTANTS} items`);
  }

  const scannedAt = normalizeString(result.scanned_at, 'result.scanned_at', { maxLength: 64 });
  if (Number.isNaN(Date.parse(scannedAt))) {
    throw new Error('result.scanned_at must be a valid ISO timestamp');
  }

  const normalized = {
    repo_url: repoUrl,
    repo_name: normalizeString(result.repo_name, 'result.repo_name', { maxLength: 200 }),
    score: normalizeInteger(result.score, 'result.score', { min: 0, max: 100 }),
    verdict,
    scanned_at: scannedAt,
    primitives: primitives.map((primitive, index) => normalizePrimitive(primitive, index, { includeDocLinks: true })),
    per_assistant: perAssistant.map((assistant, index) => normalizeAssistant(assistant, index)),
  };

  if (source !== undefined) {
    normalized.source = source;
  }
  if (hasOwn(result, 'description')) {
    normalized.description = normalizeOptionalString(result.description, 'result.description', { maxLength: 2000 });
  }
  if (hasOwn(result, 'stars')) {
    normalized.stars = result.stars == null ? null : normalizeInteger(result.stars, 'result.stars', { min: 0, max: 100000000 });
  }
  if (hasOwn(result, 'branch')) {
    normalized.branch = normalizeOptionalString(result.branch, 'result.branch', { maxLength: 255 });
  }
  if (hasOwn(result, 'paths_scanned')) {
    normalized.paths_scanned =
      result.paths_scanned == null
        ? null
        : normalizeInteger(result.paths_scanned, 'result.paths_scanned', { min: 0, max: 100000000 });
  }

  return normalized;
}