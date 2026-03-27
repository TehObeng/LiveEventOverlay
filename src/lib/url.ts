function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

export function isLocalhostUrl(value: string) {
  try {
    const url = new URL(value);
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname);
  } catch {
    return false;
  }
}

export function resolveAppBaseUrl(configuredUrl: string | undefined, runtimeOrigin: string | undefined) {
  const safeConfiguredUrl = configuredUrl?.trim() || '';
  const safeRuntimeOrigin = runtimeOrigin?.trim() || '';

  if (safeConfiguredUrl && !isLocalhostUrl(safeConfiguredUrl)) {
    return trimTrailingSlash(safeConfiguredUrl);
  }

  if (safeRuntimeOrigin) {
    return trimTrailingSlash(safeRuntimeOrigin);
  }

  return trimTrailingSlash(safeConfiguredUrl);
}
