import {
  calculateOverallScore,
  calculatePerAssistantScores,
  getVerdict,
} from '../../src/services/scorer.js';

describe('scorer', () => {
  it('returns 0 for an empty overall score input', () => {
    expect(calculateOverallScore([])).toBe(0);
  });

  it('counts missing assistant hooks in the overall score', () => {
    const primitiveResults = [
      {
        name: 'Instruction Files',
        category: 'instructions',
        assistant_results: {
          'github-copilot': { detected: true, matched_files: ['.github/copilot-instructions.md'] },
          'claude-code': { detected: true, matched_files: ['CLAUDE.md'] },
        },
      },
      {
        name: 'Agent Hooks',
        category: 'hooks',
        assistant_results: {
          'github-copilot': { detected: true, matched_files: ['.github/hooks/pre-commit.sh'] },
          'claude-code': { detected: false, matched_files: [] },
        },
      },
    ];

    expect(calculateOverallScore(primitiveResults)).toBe(75);
  });

  it('calculates per-assistant scores from supported primitives only', () => {
    const primitiveResults = [
      {
        name: 'Instruction Files',
        category: 'instructions',
        assistant_results: {
          'github-copilot': { detected: true, matched_files: ['.github/copilot-instructions.md'] },
          'claude-code': { detected: true, matched_files: ['CLAUDE.md'] },
        },
      },
      {
        name: 'Agent Hooks',
        category: 'hooks',
        assistant_results: {
          'github-copilot': { detected: true, matched_files: ['.github/hooks/pre-commit.sh'] },
          'claude-code': { detected: false, matched_files: [] },
        },
      },
      {
        name: 'Custom Agent Definitions',
        category: 'agents',
        assistant_results: {
          'github-copilot': { detected: false, matched_files: [] },
        },
      },
    ];
    const assistantDefs = [
      { id: 'github-copilot', name: 'GitHub Copilot' },
      { id: 'claude-code', name: 'Claude Code' },
      { id: 'openai-codex', name: 'OpenAI Codex CLI' },
    ];

    expect(calculatePerAssistantScores(primitiveResults, assistantDefs)).toEqual([
      {
        id: 'github-copilot',
        name: 'GitHub Copilot',
        score: 67,
        primitives: [
          {
            name: 'Instruction Files',
            category: 'instructions',
            detected: true,
            matched_files: ['.github/copilot-instructions.md'],
          },
          {
            name: 'Agent Hooks',
            category: 'hooks',
            detected: true,
            matched_files: ['.github/hooks/pre-commit.sh'],
          },
          {
            name: 'Custom Agent Definitions',
            category: 'agents',
            detected: false,
            matched_files: [],
          },
        ],
      },
      {
        id: 'claude-code',
        name: 'Claude Code',
        score: 50,
        primitives: [
          {
            name: 'Instruction Files',
            category: 'instructions',
            detected: true,
            matched_files: ['CLAUDE.md'],
          },
          {
            name: 'Agent Hooks',
            category: 'hooks',
            detected: false,
            matched_files: [],
          },
        ],
      },
    ]);
  });

  it('keeps existing verdict thresholds', () => {
    expect(getVerdict(60)).toBe('AI-Native');
    expect(getVerdict(30)).toBe('AI-Assisted');
    expect(getVerdict(29)).toBe('Traditional');
  });
});