/**
 * JSON configuration loader with schema validation.
 * Validates primitives.json and assistants.json at startup.
 * @module config-loader
 */

import { readFileSync } from 'node:fs';

/**
 * @typedef {Object} PrimitivesConfig
 * @property {Array<PrimitiveDefinition>} primitives - Array of primitive definitions
 */

/**
 * @typedef {Object} PrimitiveDefinition
 * @property {string} name - Primitive name
 * @property {string} category - Primitive category
 * @property {string} description - Human-readable description
 * @property {string[]} docLinks - Documentation URLs
 * @property {Record<string, {patterns: string[]}>} assistants - Assistant-specific patterns
 */

/**
 * @typedef {Object} AssistantsConfig
 * @property {Array<AssistantDefinition>} assistants - Array of assistant definitions
 */

/**
 * @typedef {Object} AssistantDefinition
 * @property {string} id - Unique assistant identifier
 * @property {string} name - Display name
 * @property {string} description - Human-readable description
 * @property {string} website - Official website URL
 * @property {string[]} docLinks - Documentation URLs
 */

/**
 * Loads and validates a primitives configuration file.
 * @param {string} filePath - Absolute path to primitives.json
 * @returns {PrimitivesConfig} Validated configuration
 * @throws {Error} If the file cannot be read, is malformed JSON, or fails validation
 */
export function loadPrimitivesConfig(filePath) {
  const raw = readConfigFile(filePath);
  const config = parseJson(raw, filePath);
  validatePrimitivesConfig(config);
  return config;
}

/**
 * Loads and validates an assistants configuration file.
 * @param {string} filePath - Absolute path to assistants.json
 * @returns {AssistantsConfig} Validated configuration
 * @throws {Error} If the file cannot be read, is malformed JSON, or fails validation
 */
export function loadAssistantsConfig(filePath) {
  const raw = readConfigFile(filePath);
  const config = parseJson(raw, filePath);
  validateAssistantsConfig(config);
  return config;
}

/**
 * Validates a primitives configuration object.
 * @param {unknown} config - Configuration to validate
 * @throws {Error} If validation fails with a descriptive error message
 */
export function validatePrimitivesConfig(config) {
  if (!config || !Array.isArray(config.primitives)) {
    throw new Error('Invalid config: "primitives" must be an array.');
  }

  if (config.primitives.length === 0) {
    throw new Error('Invalid config: "primitives" array must not be empty.');
  }

  for (let i = 0; i < config.primitives.length; i++) {
    const p = config.primitives[i];
    const prefix = `Primitive [${i}]`;

    if (!p.name || typeof p.name !== 'string') {
      throw new Error(`${prefix}: "name" is required and must be a non-empty string.`);
    }
    if (!p.category || typeof p.category !== 'string') {
      throw new Error(`${prefix} "${p.name}": "category" is required and must be a non-empty string.`);
    }
    if (!p.description || typeof p.description !== 'string') {
      throw new Error(`${prefix} "${p.name}": "description" is required and must be a non-empty string.`);
    }
    if (!Array.isArray(p.docLinks) || p.docLinks.length === 0) {
      throw new Error(`${prefix} "${p.name}": "docLinks" must be a non-empty array of strings.`);
    }
    if (!p.assistants || typeof p.assistants !== 'object' || Object.keys(p.assistants).length === 0) {
      throw new Error(`${prefix} "${p.name}": "assistants" must be an object with at least one assistant.`);
    }

    for (const [assistantId, assistantConfig] of Object.entries(p.assistants)) {
      if (!Array.isArray(assistantConfig.patterns) || assistantConfig.patterns.length === 0) {
        throw new Error(
          `${prefix} "${p.name}" → assistant "${assistantId}": "patterns" must be a non-empty array.`,
        );
      }
    }
  }
}

/**
 * Validates an assistants configuration object.
 * @param {unknown} config - Configuration to validate
 * @throws {Error} If validation fails with a descriptive error message
 */
export function validateAssistantsConfig(config) {
  if (!config || !Array.isArray(config.assistants)) {
    throw new Error('Invalid config: "assistants" must be an array.');
  }

  for (let i = 0; i < config.assistants.length; i++) {
    const a = config.assistants[i];
    const prefix = `Assistant [${i}]`;

    if (!a.id || typeof a.id !== 'string') {
      throw new Error(`${prefix}: "id" is required and must be a non-empty string.`);
    }
    if (!a.name || typeof a.name !== 'string') {
      throw new Error(`${prefix} "${a.id}": "name" is required and must be a non-empty string.`);
    }
  }
}

/**
 * Reads a configuration file from disk.
 * @param {string} filePath - Path to the config file
 * @returns {string} File contents
 * @throws {Error} If the file cannot be read
 */
function readConfigFile(filePath) {
  return readFileSync(filePath, 'utf-8');
}

/**
 * Parses a JSON string with a clear error message.
 * @param {string} raw - Raw JSON string
 * @param {string} filePath - File path for error context
 * @returns {unknown} Parsed JSON object
 * @throws {Error} If JSON is malformed
 */
function parseJson(raw, filePath) {
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse JSON from "${filePath}": ${err.message}`);
  }
}
