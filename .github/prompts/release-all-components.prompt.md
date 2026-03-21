---
description: Prepare or publish a coordinated release for the VS Code extension, standalone CLI, and GitHub CLI extension
---

Prepare a coordinated release for this repository.

Use the root release automation entrypoint: `npm run release:all -- <version> [flags]`.

Requirements:

1. Keep `packages/cli/package.json`, `packages/vscode-extension/package.json`, and `packages/gh-extension/package.json` on the same version.
2. Validate builds and tests before any publish step.
3. If the request is only to verify the flow, run `npm run release:all -- <version> --dry-run`.
4. If the request is for a real release, confirm these prerequisites before publishing:
   - `vsce` publish access is available for the VS Code extension
   - `GH_EXTENSION_REPOSITORY` is set
   - `GH_EXTENSION_SYNC_TOKEN` is set
   - the git worktree is clean
   - npm trusted publishing is configured for package `is-ai-native` with workflow filename `publish-cli.yml`
5. For a full coordinated release, run `npm run release:all -- <version> --publish --push`.
6. Summarize what changed, what was published, and any manual follow-up that remains.