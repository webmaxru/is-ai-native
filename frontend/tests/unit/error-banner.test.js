import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GH_CLI_EXTENSION_COMMAND,
  VSCODE_EXTENSION_URL,
  getRepoAccessInstallOptions,
} from '../../src/error-banner.js';

test('getRepoAccessInstallOptions returns install guidance for inaccessible repository errors', () => {
  assert.deepEqual(
    getRepoAccessInstallOptions(
      'Repository was not found or is not accessible with the current GitHub credentials. Check the URL, or try a local or authenticated scan.'
    ),
    {
      vscodeUrl: VSCODE_EXTENSION_URL,
      ghCliCommand: GH_CLI_EXTENSION_COMMAND,
    }
  );
});

test('getRepoAccessInstallOptions ignores unrelated errors', () => {
  assert.equal(getRepoAccessInstallOptions('Invalid repo parameter. Expected format: owner/repository'), null);
  assert.equal(getRepoAccessInstallOptions('Could not load shared report: Report not found'), null);
});