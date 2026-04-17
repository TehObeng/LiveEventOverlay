function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

export function resolveBasePath(value: string | undefined) {
  if (value === undefined) {
    return '/liveeventoverlay';
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === '/') {
    return '';
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
}

function ensureBasePathOnPathname(pathname: string, basePath: string) {
  const normalizedPathname = pathname && pathname !== '/' ? trimTrailingSlash(pathname) : '';

  if (!basePath) {
    return normalizedPathname || '/';
  }

  if (!normalizedPathname) {
    return basePath;
  }

  if (normalizedPathname === basePath || normalizedPathname.startsWith(`${basePath}/`)) {
    return normalizedPathname;
  }

  return `${basePath}${normalizedPathname.startsWith('/') ? normalizedPathname : `/${normalizedPathname}`}`;
}

export function withBasePath(path: string, basePath = resolveBasePath(process.env.NEXT_PUBLIC_BASE_PATH)) {
  if (!path.startsWith('/')) {
    return path;
  }

  if (!basePath || path === basePath || path.startsWith(`${basePath}/`)) {
    return path;
  }

  return `${basePath}${path}`;
}

export function isLocalhostUrl(value: string) {
  try {
    const url = new URL(value);
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname);
  } catch {
    return false;
  }
}

function resolveBaseUrlWithPath(value: string, basePath: string) {
  const url = new URL(value);
  url.pathname = ensureBasePathOnPathname(url.pathname, basePath);
  return trimTrailingSlash(url.toString());
}

export function resolveAppBaseUrl(
  configuredUrl: string | undefined,
  runtimeOrigin: string | undefined,
  basePath = resolveBasePath(process.env.NEXT_PUBLIC_BASE_PATH),
) {
  const safeConfiguredUrl = configuredUrl?.trim() || '';
  const safeRuntimeOrigin = runtimeOrigin?.trim() || '';

  if (safeRuntimeOrigin) {
    return resolveBaseUrlWithPath(safeRuntimeOrigin, basePath);
  }

  if (safeConfiguredUrl && !isLocalhostUrl(safeConfiguredUrl)) {
    return resolveBaseUrlWithPath(safeConfiguredUrl, basePath);
  }

  if (safeConfiguredUrl) {
    return resolveBaseUrlWithPath(safeConfiguredUrl, basePath);
  }

  return basePath;
}
