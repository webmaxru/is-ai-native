import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadPrimitivesConfig, loadAssistantsConfig, validatePrimitivesConfig, validateAssistantsConfig } from '../../src/services/config-loader.js';
import { readFileSync } from 'node:fs';

vi.mock('node:fs');

describe('config-loader', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('validatePrimitivesConfig', () => {
    it('should accept valid primitives config', () => {
      const config = {
        primitives: [
          {
            name: 'Test Primitive',
            category: 'instructions',
            description: 'A test primitive',
            docLinks: ['https://example.com/docs'],
            assistants: {
              'github-copilot': { patterns: ['*.md'] },
            },
          },
        ],
      };

      expect(() => validatePrimitivesConfig(config)).not.toThrow();
    });

    it('should reject config without primitives array', () => {
      expect(() => validatePrimitivesConfig({})).toThrow(/primitives.*array/i);
    });

    it('should reject config with empty primitives array', () => {
      expect(() => validatePrimitivesConfig({ primitives: [] })).toThrow(/empty/i);
    });

    it('should reject primitive missing name', () => {
      const config = {
        primitives: [
          {
            category: 'instructions',
            description: 'A test',
            docLinks: ['https://example.com'],
            assistants: { 'github-copilot': { patterns: ['*.md'] } },
          },
        ],
      };

      expect(() => validatePrimitivesConfig(config)).toThrow(/name/i);
    });

    it('should reject primitive missing category', () => {
      const config = {
        primitives: [
          {
            name: 'Test',
            description: 'A test',
            docLinks: ['https://example.com'],
            assistants: { 'github-copilot': { patterns: ['*.md'] } },
          },
        ],
      };

      expect(() => validatePrimitivesConfig(config)).toThrow(/category/i);
    });

    it('should reject primitive missing description', () => {
      const config = {
        primitives: [
          {
            name: 'Test',
            category: 'instructions',
            docLinks: ['https://example.com'],
            assistants: { 'github-copilot': { patterns: ['*.md'] } },
          },
        ],
      };

      expect(() => validatePrimitivesConfig(config)).toThrow(/description/i);
    });

    it('should reject primitive missing docLinks', () => {
      const config = {
        primitives: [
          {
            name: 'Test',
            category: 'instructions',
            description: 'A test',
            assistants: { 'github-copilot': { patterns: ['*.md'] } },
          },
        ],
      };

      expect(() => validatePrimitivesConfig(config)).toThrow(/docLinks/i);
    });

    it('should reject primitive with empty docLinks', () => {
      const config = {
        primitives: [
          {
            name: 'Test',
            category: 'instructions',
            description: 'A test',
            docLinks: [],
            assistants: { 'github-copilot': { patterns: ['*.md'] } },
          },
        ],
      };

      expect(() => validatePrimitivesConfig(config)).toThrow(/docLinks/i);
    });

    it('should reject primitive missing assistants', () => {
      const config = {
        primitives: [
          {
            name: 'Test',
            category: 'instructions',
            description: 'A test',
            docLinks: ['https://example.com'],
          },
        ],
      };

      expect(() => validatePrimitivesConfig(config)).toThrow(/assistants/i);
    });

    it('should reject primitive with empty assistants', () => {
      const config = {
        primitives: [
          {
            name: 'Test',
            category: 'instructions',
            description: 'A test',
            docLinks: ['https://example.com'],
            assistants: {},
          },
        ],
      };

      expect(() => validatePrimitivesConfig(config)).toThrow(/assistants/i);
    });

    it('should reject assistant entry missing patterns array', () => {
      const config = {
        primitives: [
          {
            name: 'Test',
            category: 'instructions',
            description: 'A test',
            docLinks: ['https://example.com'],
            assistants: { 'github-copilot': {} },
          },
        ],
      };

      expect(() => validatePrimitivesConfig(config)).toThrow(/patterns/i);
    });

    it('should reject assistant entry with empty patterns', () => {
      const config = {
        primitives: [
          {
            name: 'Test',
            category: 'instructions',
            description: 'A test',
            docLinks: ['https://example.com'],
            assistants: { 'github-copilot': { patterns: [] } },
          },
        ],
      };

      expect(() => validatePrimitivesConfig(config)).toThrow(/patterns/i);
    });

    it('should ignore extra fields gracefully', () => {
      const config = {
        primitives: [
          {
            name: 'Test',
            category: 'instructions',
            description: 'A test',
            docLinks: ['https://example.com'],
            assistants: { 'github-copilot': { patterns: ['*.md'] } },
            extraField: 'should be ignored',
          },
        ],
        version: '1.0',
      };

      expect(() => validatePrimitivesConfig(config)).not.toThrow();
    });
  });

  describe('validateAssistantsConfig', () => {
    it('should accept valid assistants config', () => {
      const config = {
        assistants: [
          {
            id: 'github-copilot',
            name: 'GitHub Copilot',
            description: 'AI pair programmer',
            website: 'https://copilot.github.com',
            docLinks: ['https://docs.github.com/copilot'],
          },
        ],
      };

      expect(() => validateAssistantsConfig(config)).not.toThrow();
    });

    it('should reject config without assistants array', () => {
      expect(() => validateAssistantsConfig({})).toThrow(/assistants.*array/i);
    });

    it('should reject assistant missing id', () => {
      const config = {
        assistants: [{ name: 'Test', description: 'Test', website: 'https://test.com', docLinks: ['https://test.com'] }],
      };

      expect(() => validateAssistantsConfig(config)).toThrow(/id/i);
    });
  });

  describe('loadPrimitivesConfig', () => {
    it('should load and validate valid config file', () => {
      const validConfig = {
        primitives: [
          {
            name: 'Test',
            category: 'instructions',
            description: 'A test',
            docLinks: ['https://example.com'],
            assistants: { 'github-copilot': { patterns: ['*.md'] } },
          },
        ],
      };
      readFileSync.mockReturnValue(JSON.stringify(validConfig));

      const result = loadPrimitivesConfig('/path/to/primitives.json');
      expect(result.primitives).toHaveLength(1);
      expect(result.primitives[0].name).toBe('Test');
    });

    it('should throw on malformed JSON', () => {
      readFileSync.mockReturnValue('{ invalid json }');

      expect(() => loadPrimitivesConfig('/path/to/primitives.json')).toThrow(/parse|json/i);
    });

    it('should throw on missing file', () => {
      readFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      expect(() => loadPrimitivesConfig('/missing.json')).toThrow();
    });
  });

  describe('loadAssistantsConfig', () => {
    it('should load and validate valid config file', () => {
      const validConfig = {
        assistants: [
          {
            id: 'github-copilot',
            name: 'GitHub Copilot',
            description: 'AI pair programmer',
            website: 'https://copilot.github.com',
            docLinks: ['https://docs.github.com/copilot'],
          },
        ],
      };
      readFileSync.mockReturnValue(JSON.stringify(validConfig));

      const result = loadAssistantsConfig('/path/to/assistants.json');
      expect(result.assistants).toHaveLength(1);
    });
  });
});
