import { loadConfig } from '../../src/services/config-loader.js';

describe('config-loader', () => {
  it('loads current assistant metadata links', () => {
    const { assistants } = loadConfig();

    expect(assistants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'claude-code',
          name: 'Claude Code',
          website: 'https://code.claude.com/docs/en/overview',
          docLinks: ['https://code.claude.com/docs/en/overview'],
        }),
        expect.objectContaining({
          id: 'openai-codex',
          name: 'OpenAI Codex',
          website: 'https://developers.openai.com/codex',
          docLinks: ['https://developers.openai.com/codex'],
        }),
      ])
    );
  });

  it('loads documented repository-scoped primitive patterns', () => {
    const { primitives } = loadConfig();
    const byName = new Map(primitives.map((primitive) => [primitive.name, primitive]));

    expect(byName.get('Instruction Files').assistants['github-copilot'].patterns).toEqual(
      expect.arrayContaining(['.github/instructions/**/*.instructions.md', '**/AGENTS.md'])
    );
    expect(byName.get('Saved Prompts').assistants['github-copilot'].patterns).toEqual([
      '.github/prompts/*.prompt.md',
    ]);
    expect(byName.get('Custom Agent Definitions').assistants['openai-codex'].patterns).toEqual([
      '.codex/config.toml',
    ]);
    expect(byName.get('Skills').assistants['openai-codex'].patterns).toEqual([
      '.agents/skills/**/SKILL.md',
    ]);
    expect(byName.get('MCP Server Configurations').assistants['openai-codex'].patterns).toEqual([
      '.codex/config.toml',
    ]);
    expect(byName.get('Agent Hooks').assistants['github-copilot'].patterns).toEqual([
      '.github/hooks/*.json',
    ]);
  });
});