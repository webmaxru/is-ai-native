---
description: Prepare or publish a coordinated release for the VS Code extension, standalone CLI, and GitHub CLI extension
---

Prepare a coordinated release for this repository.

Use the root release automation entrypoint: `npm run release:all -- [<version>] [flags]`.

Requirements:

1. Keep `packages/cli/package.json`, `packages/vscode-extension/package.json`, and `packages/gh-extension/package.json` on the same version.
2. Treat `npm run release:all` as a version bump command. If the user does not specify a version, compute the next unified patch version automatically by reading those three manifests, taking the highest current version, and incrementing it once. If the manifests are already aligned, still increment that shared version once.
3. Before declaring GH extension sync credentials missing, load or inspect the repository root `.env` in addition to the live shell environment. If `.env` defines `GH_EXTENSION_REPOSITORY` and `GH_EXTENSION_SYNC_TOKEN`, treat the local prerequisite as satisfied.
4. Validate builds and tests before any publish step.
5. If the request is only to verify the flow, run `npm run release:all -- <version> --dry-run` when a version was provided, or `npm run release:all -- --dry-run` when it was not.
6. If the request is for a real release, confirm these prerequisites before publishing:
   - `vsce` publish access is available for the VS Code extension
   - `GH_EXTENSION_REPOSITORY` is available from the shell or root `.env`
   - `GH_EXTENSION_SYNC_TOKEN` is available from the shell or root `.env`
   - the git worktree is clean
   - npm trusted publishing is configured for package `is-ai-native` with workflow filename `publish-cli.yml`
7. For a full coordinated release, run `npm run release:all -- <version> --publish --push` when a version was provided, or `npm run release:all -- --publish --push` when the version should be auto-derived.
8. Summarize what changed, what was published, and any manual follow-up that remains.