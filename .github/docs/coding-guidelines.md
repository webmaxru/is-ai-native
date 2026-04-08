# Coding Guidelines — "Is it AI-Native?"

## General

- **Language**: TypeScript (strict mode) across all packages.
- **Module system**: ESM (`"type": "module"` in every `package.json`).
- **Package manager**: npm workspaces — run `npm install` from the repo root.

## Project Structure

```
packages/
  core/          # Shared analysis logic
  cli/           # Standalone CLI
  gh-cli/        # GitHub CLI extension
  vscode/        # VS Code extension
webapp/          # Web application
```

## Code Style

- Follow the ESLint and Prettier configs defined at the repo root.
- Prefer `const` over `let`; never use `var`.
- Use named exports; avoid default exports.
- Keep functions small and single-purpose.

## Naming Conventions

| Element | Convention | Example |
| ------- | ---------- | ------- |
| Files & folders | kebab-case | `repo-scanner.ts` |
| Variables & functions | camelCase | `analyzeRepo()` |
| Classes & types | PascalCase | `ScanResult` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| Environment variables | UPPER_SNAKE_CASE | `GITHUB_TOKEN` |

## Error Handling

- Throw typed errors (extend `Error` with a `code` property).
- Never swallow errors silently; log at minimum.
- Use `try/catch` at boundaries (API handlers, CLI entry points); let errors propagate inside business logic.

## Testing

- Co-locate test files next to source: `analyzer.ts` → `analyzer.test.ts`.
- Use descriptive test names: `it("returns zero score when no AI files are found")`.
- Aim for unit tests on core logic; integration tests at surface boundaries.

## Commits & PRs

- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `chore:`, etc.
- One logical change per commit.
- Reference task IDs in PR titles when applicable.

## Dependencies

- Keep dependencies minimal; prefer built-in Node.js APIs.
- Pin exact versions in `package.json` for reproducible builds.
- Run `npm audit` before merging dependency updates.
