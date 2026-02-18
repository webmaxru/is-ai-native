import { describe, it, expect } from 'vitest';
import { calculateOverallScore, calculatePerAssistantScores } from '../../src/services/scorer.js';

describe('scorer', () => {
  describe('calculateOverallScore', () => {
    it('should return 100 when all categories are detected', () => {
      const scanResults = [
        { name: 'P1', category: 'instructions', detected: true, matchedFiles: ['a.md'] },
        { name: 'P2', category: 'prompts', detected: true, matchedFiles: ['b.md'] },
        { name: 'P3', category: 'agents', detected: true, matchedFiles: ['c.md'] },
        { name: 'P4', category: 'skills', detected: true, matchedFiles: ['d.md'] },
        { name: 'P5', category: 'mcp-config', detected: true, matchedFiles: ['e.json'] },
      ];
      expect(calculateOverallScore(scanResults)).toBe(100);
    });

    it('should return 0 when no categories are detected', () => {
      const scanResults = [
        { name: 'P1', category: 'instructions', detected: false, matchedFiles: [] },
        { name: 'P2', category: 'prompts', detected: false, matchedFiles: [] },
        { name: 'P3', category: 'agents', detected: false, matchedFiles: [] },
        { name: 'P4', category: 'skills', detected: false, matchedFiles: [] },
        { name: 'P5', category: 'mcp-config', detected: false, matchedFiles: [] },
      ];
      expect(calculateOverallScore(scanResults)).toBe(0);
    });

    it('should calculate partial score based on category coverage', () => {
      const scanResults = [
        { name: 'P1', category: 'instructions', detected: true, matchedFiles: ['a.md'] },
        { name: 'P2', category: 'instructions', detected: false, matchedFiles: [] },
        { name: 'P3', category: 'prompts', detected: false, matchedFiles: [] },
        { name: 'P4', category: 'agents', detected: false, matchedFiles: [] },
        { name: 'P5', category: 'skills', detected: false, matchedFiles: [] },
        { name: 'P6', category: 'mcp-config', detected: false, matchedFiles: [] },
      ];
      // 1 category detected out of 5 = 20%
      expect(calculateOverallScore(scanResults)).toBe(20);
    });

    it('should count a category as detected if any primitive in it is detected', () => {
      const scanResults = [
        { name: 'P1', category: 'instructions', detected: false, matchedFiles: [] },
        { name: 'P2', category: 'instructions', detected: true, matchedFiles: ['a.md'] },
        { name: 'P3', category: 'prompts', detected: false, matchedFiles: [] },
      ];
      // instructions detected, prompts not → 1/2 = 50%
      const score = calculateOverallScore(scanResults);
      expect(score).toBe(50);
    });

    it('should return 0 for empty results', () => {
      expect(calculateOverallScore([])).toBe(0);
    });
  });

  describe('calculatePerAssistantScores', () => {
    it('should calculate score per assistant', () => {
      const scanResults = [
        {
          name: 'P1',
          category: 'instructions',
          detected: true,
          matchedFiles: ['a.md'],
          assistants: ['github-copilot'],
        },
        {
          name: 'P2',
          category: 'prompts',
          detected: false,
          matchedFiles: [],
          assistants: ['github-copilot'],
        },
        {
          name: 'P3',
          category: 'instructions',
          detected: true,
          matchedFiles: ['b.md'],
          assistants: ['claude-code'],
        },
      ];

      const scores = calculatePerAssistantScores(scanResults);
      expect(scores['github-copilot']).toEqual({
        score: 50,
        detected: 1,
        total: 2,
      });
      expect(scores['claude-code']).toEqual({
        score: 100,
        detected: 1,
        total: 1,
      });
    });

    it('should return 0 for assistant with no detected primitives', () => {
      const scanResults = [
        {
          name: 'P1',
          category: 'instructions',
          detected: false,
          matchedFiles: [],
          assistants: ['openai-codex'],
        },
      ];

      const scores = calculatePerAssistantScores(scanResults);
      expect(scores['openai-codex'].score).toBe(0);
    });

    it('should handle empty results', () => {
      const scores = calculatePerAssistantScores([]);
      expect(scores).toEqual({});
    });

    it('should handle primitives associated with multiple assistants', () => {
      const scanResults = [
        {
          name: 'P1',
          category: 'instructions',
          detected: true,
          matchedFiles: ['a.md'],
          assistants: ['github-copilot', 'claude-code'],
        },
      ];

      const scores = calculatePerAssistantScores(scanResults);
      expect(scores['github-copilot'].score).toBe(100);
      expect(scores['claude-code'].score).toBe(100);
    });
  });
});
