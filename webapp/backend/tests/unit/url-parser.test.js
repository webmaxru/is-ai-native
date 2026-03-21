import { parseRepoUrl } from '../../src/utils/url-parser.js';

describe('parseRepoUrl', () => {
  it('parses short form owner/repo', () => {
    const result = parseRepoUrl('microsoft/vscode');
    expect(result.owner).toBe('microsoft');
    expect(result.repo).toBe('vscode');
    expect(result.url).toBe('https://github.com/microsoft/vscode');
  });

  it('parses full HTTPS URL', () => {
    const result = parseRepoUrl('https://github.com/HemitSystemutvikling/eFORSK');
    expect(result.owner).toBe('HemitSystemutvikling');
    expect(result.repo).toBe('eFORSK');
    expect(result.url).toBe('https://github.com/HemitSystemutvikling/eFORSK');
  });

  it('parses full HTTP URL', () => {
    const result = parseRepoUrl('http://github.com/facebook/react');
    expect(result.owner).toBe('facebook');
    expect(result.repo).toBe('react');
    expect(result.url).toBe('https://github.com/facebook/react');
  });

  it('strips trailing slash from URL', () => {
    const result = parseRepoUrl('https://github.com/microsoft/vscode/');
    expect(result.owner).toBe('microsoft');
    expect(result.repo).toBe('vscode');
    expect(result.url).toBe('https://github.com/microsoft/vscode');
  });

  it('strips .git suffix from URL', () => {
    const result = parseRepoUrl('https://github.com/microsoft/vscode.git');
    expect(result.owner).toBe('microsoft');
    expect(result.repo).toBe('vscode');
    expect(result.url).toBe('https://github.com/microsoft/vscode');
  });

  it('strips .git suffix and trailing slash', () => {
    const result = parseRepoUrl('https://github.com/microsoft/vscode.git/');
    expect(result.owner).toBe('microsoft');
    expect(result.repo).toBe('vscode');
    expect(result.url).toBe('https://github.com/microsoft/vscode');
  });

  it('handles repos with hyphens in name', () => {
    const result = parseRepoUrl('owner/my-awesome-repo');
    expect(result.owner).toBe('owner');
    expect(result.repo).toBe('my-awesome-repo');
  });

  it('handles repos with dots in name', () => {
    const result = parseRepoUrl('owner/my.awesome.repo');
    expect(result.owner).toBe('owner');
    expect(result.repo).toBe('my.awesome.repo');
  });

  it('handles repos with underscores in name', () => {
    const result = parseRepoUrl('owner/my_awesome_repo');
    expect(result.owner).toBe('owner');
    expect(result.repo).toBe('my_awesome_repo');
  });

  it('throws error for empty string', () => {
    expect(() => parseRepoUrl('')).toThrow('Repository URL is required');
  });

  it('throws error for null', () => {
    expect(() => parseRepoUrl(null)).toThrow('Repository URL is required');
  });

  it('throws error for undefined', () => {
    expect(() => parseRepoUrl(undefined)).toThrow('Repository URL is required');
  });

  it('throws error for non-string input', () => {
    expect(() => parseRepoUrl(123)).toThrow('Repository URL is required');
  });

  it('throws error for whitespace-only string', () => {
    expect(() => parseRepoUrl('   ')).toThrow('Repository URL is required');
  });

  it('throws error for invalid URL format', () => {
    expect(() => parseRepoUrl('not a valid url at all')).toThrow('Invalid repository format');
  });

  it('throws error for non-GitHub URL', () => {
    expect(() => parseRepoUrl('https://gitlab.com/owner/repo')).toThrow('Only github.com repositories are supported');
  });

  it('throws error for FTP protocol', () => {
    expect(() => parseRepoUrl('ftp://github.com/owner/repo')).toThrow();
  });

  it('throws error for GitHub URL without repo path', () => {
    expect(() => parseRepoUrl('https://github.com/')).toThrow('Invalid GitHub repository URL format');
  });

  it('throws error for GitHub URL with only owner', () => {
    expect(() => parseRepoUrl('https://github.com/owner')).toThrow('Invalid GitHub repository URL format');
  });

  it('throws error for invalid owner/repo format with trailing slash', () => {
    expect(() => parseRepoUrl('owner/')).toThrow('Invalid repository format');
  });

  it('normalizes URLs with query parameters in pathname', () => {
    expect(() => parseRepoUrl('https://github.com/owner/repo?tab=readme')).toThrow('URL query parameters are not allowed');
  });

  it('rejects URLs with fragments', () => {
    expect(() => parseRepoUrl('https://github.com/owner/repo#readme')).toThrow('URL fragments are not allowed');
  });

  it('rejects URLs with query params and fragments', () => {
    expect(() => parseRepoUrl('https://github.com/owner/repo?tab=readme#readme')).toThrow();
  });

  it('rejects short form with query parameters', () => {
    expect(() => parseRepoUrl('owner/repo?tab=readme')).toThrow('Invalid repository format');
  });

  it('rejects short form with fragments', () => {
    expect(() => parseRepoUrl('owner/repo#readme')).toThrow('Invalid repository format');
  });

  it('rejects URLs with trailing path segments', () => {
    expect(() => parseRepoUrl('https://github.com/owner/repo/issues')).toThrow('Invalid GitHub repository URL format');
  });

  it('rejects URLs with query params containing special characters', () => {
    expect(() => parseRepoUrl('https://github.com/owner/repo?ref=main&tab=readme')).toThrow('URL query parameters are not allowed');
  });

  it('accepts URL with .git suffix', () => {
    const result = parseRepoUrl('https://github.com/owner/repo.git');
    expect(result.owner).toBe('owner');
    expect(result.repo).toBe('repo');
    expect(result.url).toBe('https://github.com/owner/repo');
  });

  it('accepts short form with .git-like names (dots in name)', () => {
    const result = parseRepoUrl('owner/my.js.repo');
    expect(result.owner).toBe('owner');
    expect(result.repo).toBe('my.js.repo');
  });
});
