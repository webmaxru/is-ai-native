export const VSCODE_EXTENSION_URL = 'https://marketplace.visualstudio.com/items?itemName=salnikov.is-ai-native';
export const GH_CLI_EXTENSION_COMMAND = 'gh extension install webmaxru/gh-is-ai-native';

const REPO_ACCESS_ERROR_PATTERNS = [
  /resource not accessible/i,
  /repository.*not accessible/i,
  /repository.*private/i,
  /repository.*forbidden/i,
  /repository was not found or is not accessible/i,
  /github credentials/i,
];

export function getRepoAccessInstallOptions(message) {
  if (typeof message !== 'string') {
    return null;
  }

  const normalizedMessage = message.trim();
  if (!normalizedMessage) {
    return null;
  }

  const shouldOfferOptions = REPO_ACCESS_ERROR_PATTERNS.some((pattern) => pattern.test(normalizedMessage));
  if (!shouldOfferOptions) {
    return null;
  }

  return {
    vscodeUrl: VSCODE_EXTENSION_URL,
    ghCliCommand: GH_CLI_EXTENSION_COMMAND,
  };
}