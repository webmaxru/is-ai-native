const GITHUB_API = 'https://api.github.com';

const ASSISTANTS = [
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    files: ['.github/copilot-instructions.md', '.copilotignore'],
  },
  {
    id: 'cursor',
    name: 'Cursor',
    files: ['.cursorrules', '.cursorignore', '.cursor/rules'],
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    files: ['.windsurfrules'],
  },
];

const PRIMITIVES = [
  {
    id: 'agent-instructions',
    name: 'AI Agent Instructions',
    files: ['AGENTS.md', '.github/agents', 'CLAUDE.md', '.cline'],
  },
  {
    id: 'spec-framework',
    name: 'Spec / Plan Framework',
    files: ['.specify', 'specs', 'SPEC.md'],
  },
  {
    id: 'issue-templates',
    name: 'Issue Templates',
    files: ['.github/ISSUE_TEMPLATE', '.github/ISSUE_TEMPLATE.md'],
  },
  {
    id: 'pr-template',
    name: 'PR Template',
    files: ['.github/PULL_REQUEST_TEMPLATE.md', '.github/pull_request_template.md'],
  },
  {
    id: 'ci-pipelines',
    name: 'CI / CD Pipelines',
    dirs: ['.github/workflows'],
  },
  {
    id: 'dependabot',
    name: 'Dependabot',
    files: ['.github/dependabot.yml', '.github/dependabot.yaml'],
  },
  {
    id: 'code-owners',
    name: 'Code Owners',
    files: ['CODEOWNERS', '.github/CODEOWNERS'],
  },
  {
    id: 'pre-commit',
    name: 'Pre-commit Hooks',
    files: ['.pre-commit-config.yaml', '.husky', '.lefthook.yml'],
  },
  {
    id: 'changelog',
    name: 'Changelog',
    files: ['CHANGELOG.md', 'CHANGELOG', 'HISTORY.md'],
  },
  {
    id: 'contributing',
    name: 'Contributing Guide',
    files: ['CONTRIBUTING.md', '.github/CONTRIBUTING.md'],
  },
  {
    id: 'devcontainer',
    name: 'Dev Container',
    files: ['.devcontainer', '.devcontainer.json'],
  },
  {
    id: 'aider',
    name: 'Aider',
    files: ['.aider.conf.yml', '.aider.model.settings.yml', 'CONVENTIONS.md'],
  },
];

function headers(token) {
  const h = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'is-ai-native/1.0',
  };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

function parseRepoUrl(repoUrl) {
  const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/\s.]+)/);
  if (!match) throw new Error('Invalid GitHub repository URL');
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

async function fetchFileTree(owner, repo, token) {
  const repoResp = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
    headers: headers(token),
  });
  if (!repoResp.ok) {
    const err = await repoResp.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API error: ${repoResp.status}`);
  }
  const repoData = await repoResp.json();
  const branch = repoData.default_branch;

  const treeResp = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    { headers: headers(token) }
  );
  if (!treeResp.ok) throw new Error(`Failed to fetch file tree: ${treeResp.status}`);
  const treeData = await treeResp.json();
  return { paths: (treeData.tree || []).map((f) => f.path), repoData };
}

function detectIndicators(paths, indicators) {
  return indicators.map((indicator) => {
    const checkPaths = [...(indicator.files || []), ...(indicator.dirs || [])];
    const detected = checkPaths.some((p) =>
      paths.some((fp) => fp === p || fp.startsWith(p + '/'))
    );
    return { id: indicator.id, name: indicator.name, detected };
  });
}

function calculateScore(assistants, primitives) {
  const all = [...assistants, ...primitives];
  const detected = all.filter((i) => i.detected).length;
  return Math.round((detected / all.length) * 100);
}

export async function scanRepository(repoUrl, token) {
  const { owner, repo } = parseRepoUrl(repoUrl);
  const { paths, repoData } = await fetchFileTree(owner, repo, token);

  const assistants = detectIndicators(paths, ASSISTANTS);
  const primitives = detectIndicators(paths, PRIMITIVES);
  const score = calculateScore(assistants, primitives);

  return {
    repo_url: repoUrl,
    repo_name: `${owner}/${repo}`,
    description: repoData.description || null,
    stars: repoData.stargazers_count,
    score,
    verdict: score >= 60 ? 'AI-Native' : score >= 30 ? 'AI-Assisted' : 'Traditional',
    scanned_at: new Date().toISOString(),
    assistants,
    primitives,
  };
}
