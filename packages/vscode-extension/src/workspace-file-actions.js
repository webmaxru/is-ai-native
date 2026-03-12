function isAbsoluteOrEscapingPath(relativePath) {
  return (
    !relativePath
    || relativePath.startsWith('/')
    || /^[a-zA-Z]:[\\/]/.test(relativePath)
    || relativePath.split(/[\\/]+/).some((segment) => segment === '..')
  );
}

export function resolveWorkspaceFileUri(vscodeApi, workspaceFolder, relativePath) {
  if (!workspaceFolder || isAbsoluteOrEscapingPath(relativePath)) {
    return null;
  }

  const segments = relativePath.split('/').filter(Boolean);
  if (segments.length === 0) {
    return null;
  }

  return vscodeApi.Uri.joinPath(workspaceFolder.uri, ...segments);
}