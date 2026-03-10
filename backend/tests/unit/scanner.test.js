import { loadPrimitives } from '../../src/services/config-loader.js';
import { scanPrimitives } from '../../src/services/scanner.js';

describe('scanner', () => {
  it('detects documented repository-scoped files for each assistant', () => {
    const { primitives } = loadPrimitives();
    const results = scanPrimitives(
      [
        '.github/instructions/backend.instructions.md',
        '.claude/CLAUDE.md',
        'services/payments/AGENTS.override.md',
        '.claude/skills/review/SKILL.md',
        '.agents/skills/refactor/SKILL.md',
        '.codex/config.toml',
        '.github/hooks/security.json',
      ],
      primitives
    );
    const byName = new Map(results.map((result) => [result.name, result]));

    expect(byName.get('Instruction Files').assistant_results['github-copilot']).toEqual(
      expect.objectContaining({ detected: true })
    );
    expect(byName.get('Instruction Files').assistant_results['claude-code']).toEqual(
      expect.objectContaining({ detected: true })
    );
    expect(byName.get('Instruction Files').assistant_results['openai-codex']).toEqual(
      expect.objectContaining({ detected: true })
    );
    expect(byName.get('Skills').assistant_results['claude-code']).toEqual(
      expect.objectContaining({ detected: true })
    );
    expect(byName.get('Skills').assistant_results['openai-codex']).toEqual(
      expect.objectContaining({ detected: true })
    );
    expect(byName.get('Custom Agent Definitions').assistant_results['openai-codex']).toEqual(
      expect.objectContaining({ detected: true, matched_files: ['.codex/config.toml'] })
    );
    expect(byName.get('MCP Server Configurations').assistant_results['openai-codex']).toEqual(
      expect.objectContaining({ detected: true, matched_files: ['.codex/config.toml'] })
    );
    expect(byName.get('Agent Hooks').assistant_results['github-copilot']).toEqual(
      expect.objectContaining({ detected: true, matched_files: ['.github/hooks/security.json'] })
    );
  });

  it('keeps Copilot prompt detection narrowed to .prompt.md files', () => {
    const { primitives } = loadPrimitives();
    const results = scanPrimitives(
      ['.github/prompts/review.md', '.github/prompts/review.prompt.md'],
      primitives
    );
    const savedPrompts = results.find((result) => result.name === 'Saved Prompts');

    expect(savedPrompts.assistant_results['github-copilot']).toEqual({
      detected: true,
      matched_files: ['.github/prompts/review.prompt.md'],
    });
  });
});