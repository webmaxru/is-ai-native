import { describe, it, expect } from 'vitest';
import { isValidGitHubUrl, parseGitHubUrl } from '../../src/utils/url-parser.js';

describe('url-parser', () => {
  describe('isValidGitHubUrl', () => {
    it('should accept standard HTTPS GitHub URL', () => {
      expect(isValidGitHubUrl('https://github.com/owner/repo')).toBe(true);
    });

    it('should accept HTTP GitHub URL', () => {
      expect(isValidGitHubUrl('http://github.com/owner/repo')).toBe(true);
    });

    it('should accept GitHub URL without protocol', () => {
      expect(isValidGitHubUrl('github.com/owner/repo')).toBe(true);
    });

    it('should accept GitHub URL with www', () => {
      expect(isValidGitHubUrl('https://www.github.com/owner/repo')).toBe(true);
    });

    it('should accept GitHub URL with trailing slash', () => {
      expect(isValidGitHubUrl('https://github.com/owner/repo/')).toBe(true);
    });

    it('should accept GitHub URL with .git suffix', () => {
      expect(isValidGitHubUrl('https://github.com/owner/repo.git')).toBe(true);
    });

    it('should accept GitHub URL with hyphens and underscores in owner/repo', () => {
      expect(isValidGitHubUrl('https://github.com/my-org/my_repo')).toBe(true);
    });

    it('should accept GitHub URL with dots in repo name', () => {
      expect(isValidGitHubUrl('https://github.com/owner/repo.js')).toBe(true);
    });

    it('should reject empty string', () => {
      expect(isValidGitHubUrl('')).toBe(false);
    });

    it('should reject null', () => {
      expect(isValidGitHubUrl(null)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(isValidGitHubUrl(undefined)).toBe(false);
    });

    it('should reject non-string input', () => {
      expect(isValidGitHubUrl(123)).toBe(false);
    });

    it('should reject non-GitHub URL', () => {
      expect(isValidGitHubUrl('https://gitlab.com/owner/repo')).toBe(false);
    });

    it('should reject GitHub URL with extra path segments', () => {
      expect(isValidGitHubUrl('https://github.com/owner/repo/tree/main')).toBe(false);
    });

    it('should reject GitHub URL with only owner', () => {
      expect(isValidGitHubUrl('https://github.com/owner')).toBe(false);
    });

    it('should reject plain text', () => {
      expect(isValidGitHubUrl('not a url')).toBe(false);
    });

    it('should reject GitHub Enterprise URLs', () => {
      expect(isValidGitHubUrl('https://github.mycompany.com/owner/repo')).toBe(false);
    });

    it('should handle URL with whitespace by trimming', () => {
      expect(isValidGitHubUrl('  https://github.com/owner/repo  ')).toBe(true);
    });
  });

  describe('parseGitHubUrl', () => {
    it('should extract owner and repo from standard URL', () => {
      const result = parseGitHubUrl('https://github.com/facebook/react');
      expect(result).toEqual({ owner: 'facebook', repo: 'react' });
    });

    it('should extract owner and repo from URL with .git suffix', () => {
      const result = parseGitHubUrl('https://github.com/owner/repo.git');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should extract owner and repo from URL with trailing slash', () => {
      const result = parseGitHubUrl('https://github.com/owner/repo/');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should trim whitespace from URL', () => {
      const result = parseGitHubUrl('  https://github.com/owner/repo  ');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should throw for empty string', () => {
      expect(() => parseGitHubUrl('')).toThrow('URL must be a non-empty string');
    });

    it('should throw for null', () => {
      expect(() => parseGitHubUrl(null)).toThrow('URL must be a non-empty string');
    });

    it('should throw for non-GitHub URL with descriptive message', () => {
      expect(() => parseGitHubUrl('https://gitlab.com/owner/repo')).toThrow(
        'Only GitHub repository URLs are supported',
      );
    });

    it('should throw for invalid GitHub URL format with descriptive message', () => {
      expect(() => parseGitHubUrl('https://github.com/owner')).toThrow(
        'Invalid GitHub repository URL format',
      );
    });
  });
});
