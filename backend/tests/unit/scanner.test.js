import { describe, it, expect } from 'vitest';
import { scanRepository } from '../../src/services/scanner.js';

describe('scanner', () => {
  const mockFileTree = [
    { path: '.github/copilot-instructions.md', type: 'blob' },
    { path: '.github/prompts/review.prompt.md', type: 'blob' },
    { path: '.github/prompts/test.prompt.md', type: 'blob' },
    { path: 'CLAUDE.md', type: 'blob' },
    { path: '.claude/commands/deploy.md', type: 'blob' },
    { path: '.vscode/mcp.json', type: 'blob' },
    { path: '.mcp.json', type: 'blob' },
    { path: 'src/index.js', type: 'blob' },
    { path: 'package.json', type: 'blob' },
    { path: 'README.md', type: 'blob' },
  ];

  it('should detect primitives present in the file tree', () => {
    const results = scanRepository(mockFileTree);
    const copilotInstructions = results.find((r) => r.name === 'Copilot Instructions');
    expect(copilotInstructions).toBeDefined();
    expect(copilotInstructions.detected).toBe(true);
    expect(copilotInstructions.matchedFiles).toContain('.github/copilot-instructions.md');
  });

  it('should detect Claude instructions via CLAUDE.md', () => {
    const results = scanRepository(mockFileTree);
    const claudeInstructions = results.find((r) => r.name === 'Claude Code Instructions');
    expect(claudeInstructions).toBeDefined();
    expect(claudeInstructions.detected).toBe(true);
    expect(claudeInstructions.matchedFiles).toContain('CLAUDE.md');
  });

  it('should detect MCP configurations', () => {
    const results = scanRepository(mockFileTree);
    const copilotMcp = results.find((r) => r.name === 'Copilot MCP Server Configuration');
    expect(copilotMcp).toBeDefined();
    expect(copilotMcp.detected).toBe(true);

    const claudeMcp = results.find((r) => r.name === 'Claude Code MCP Server Configuration');
    expect(claudeMcp).toBeDefined();
    expect(claudeMcp.detected).toBe(true);
  });

  it('should mark undetected primitives as not detected', () => {
    const results = scanRepository(mockFileTree);
    const codexInstructions = results.find((r) => r.name === 'OpenAI Codex Instructions');
    expect(codexInstructions).toBeDefined();
    expect(codexInstructions.detected).toBe(false);
    expect(codexInstructions.matchedFiles).toEqual([]);
  });

  it('should return results for all configured primitives', () => {
    const results = scanRepository(mockFileTree);
    expect(results.length).toBeGreaterThan(0);
    results.forEach((result) => {
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('detected');
      expect(result).toHaveProperty('matchedFiles');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('docLinks');
    });
  });

  it('should return no matches for empty file tree', () => {
    const results = scanRepository([]);
    results.forEach((result) => {
      expect(result.detected).toBe(false);
      expect(result.matchedFiles).toEqual([]);
    });
  });

  it('should count multiple file matches for the same primitive once (detected is boolean)', () => {
    const treeWithMultiplePrompts = [
      { path: '.github/prompts/one.prompt.md', type: 'blob' },
      { path: '.github/prompts/two.prompt.md', type: 'blob' },
      { path: '.github/prompts/three.prompt.md', type: 'blob' },
    ];
    const results = scanRepository(treeWithMultiplePrompts);
    const savedPrompts = results.find((r) => r.name === 'Copilot Saved Prompts');
    expect(savedPrompts.detected).toBe(true);
    expect(savedPrompts.matchedFiles).toHaveLength(3);
  });

  it('should only match blob entries, not tree (directory) entries', () => {
    const treeWithDirs = [
      { path: '.github/copilot-instructions.md', type: 'tree' },
    ];
    const results = scanRepository(treeWithDirs);
    const copilotInstructions = results.find((r) => r.name === 'Copilot Instructions');
    expect(copilotInstructions.detected).toBe(false);
  });

  it('should include assistant information in results', () => {
    const results = scanRepository(mockFileTree);
    const copilotInstructions = results.find((r) => r.name === 'Copilot Instructions');
    expect(copilotInstructions.assistants).toContain('github-copilot');
  });
});
