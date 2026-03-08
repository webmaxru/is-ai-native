import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONFIG_DIR = join(__dirname, '../config');

/**
 * Validates a single primitive definition from primitives.json.
 * @param {object} p - Primitive definition
 * @param {number} index - Index in the array (for error messages)
 * @returns {string|null} Error message or null if valid
 */
function validatePrimitive(p, index) {
  if (!p.name || typeof p.name !== 'string') {
    return `primitives[${index}].name must be a non-empty string`;
  }
  if (!p.category || typeof p.category !== 'string') {
    return `primitives[${index}].category must be a non-empty string`;
  }
  if (!p.description || typeof p.description !== 'string') {
    return `primitives[${index}].description must be a non-empty string`;
  }
  if (!Array.isArray(p.docLinks) || p.docLinks.length === 0) {
    return `primitives[${index}].docLinks must be a non-empty array`;
  }
  if (!p.assistants || typeof p.assistants !== 'object' || Object.keys(p.assistants).length === 0) {
    return `primitives[${index}].assistants must be a non-empty object`;
  }
  for (const [assistantId, def] of Object.entries(p.assistants)) {
    if (!Array.isArray(def.patterns) || def.patterns.length === 0) {
      return `primitives[${index}].assistants.${assistantId}.patterns must be a non-empty array`;
    }
  }
  return null;
}

/**
 * Validates a single assistant definition from assistants.json.
 * @param {object} a - Assistant definition
 * @param {number} index - Index in the array
 * @returns {string|null} Error message or null if valid
 */
function validateAssistant(a, index) {
  if (!a.id || typeof a.id !== 'string') {
    return `assistants[${index}].id must be a non-empty string`;
  }
  if (!a.name || typeof a.name !== 'string') {
    return `assistants[${index}].name must be a non-empty string`;
  }
  return null;
}

/**
 * Loads and validates the primitives configuration.
 * @param {string} [filePath] - Override path for testing
 * @returns {{ primitives: object[] }} Validated primitives config
 */
export function loadPrimitives(filePath) {
  const path = filePath || join(CONFIG_DIR, 'primitives.json');
  let raw;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (err) {
    throw new Error(`Failed to read primitives config: ${path} — ${err.message}`);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in primitives config: ${path}`);
  }

  if (!Array.isArray(data.primitives) || data.primitives.length === 0) {
    throw new Error('primitives.json must contain a non-empty "primitives" array');
  }

  for (let i = 0; i < data.primitives.length; i++) {
    const err = validatePrimitive(data.primitives[i], i);
    if (err) throw new Error(`Invalid primitives.json: ${err}`);
  }

  return data;
}

/**
 * Loads and validates the assistants configuration.
 * @param {string} [filePath] - Override path for testing
 * @returns {{ assistants: object[] }} Validated assistants config
 */
export function loadAssistants(filePath) {
  const path = filePath || join(CONFIG_DIR, 'assistants.json');
  let raw;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (err) {
    throw new Error(`Failed to read assistants config: ${path} — ${err.message}`);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in assistants config: ${path}`);
  }

  if (!Array.isArray(data.assistants) || data.assistants.length === 0) {
    throw new Error('assistants.json must contain a non-empty "assistants" array');
  }

  for (let i = 0; i < data.assistants.length; i++) {
    const err = validateAssistant(data.assistants[i], i);
    if (err) throw new Error(`Invalid assistants.json: ${err}`);
  }

  return data;
}

/**
 * Loads and validates both configuration files.
 * @returns {{ primitives: object[], assistants: object[] }}
 */
export function loadConfig() {
  const { primitives } = loadPrimitives();
  const { assistants } = loadAssistants();
  return { primitives, assistants };
}
