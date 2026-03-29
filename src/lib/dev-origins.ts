const DEFAULT_ALLOWED_DEV_ORIGINS = ['*.lhr.life', '*.localhost.run'] as const;

type DevOriginEnv = {
  NEXT_PUBLIC_APP_URL?: string;
  ALLOWED_DEV_ORIGINS?: string;
};

function parseHostname(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).hostname || null;
  } catch {
    return null;
  }
}

function parseConfiguredOrigins(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function buildAllowedDevOrigins(env: DevOriginEnv) {
  return Array.from(
    new Set([
      ...DEFAULT_ALLOWED_DEV_ORIGINS,
      parseHostname(env.NEXT_PUBLIC_APP_URL),
      ...parseConfiguredOrigins(env.ALLOWED_DEV_ORIGINS),
    ].filter((value): value is string => Boolean(value))),
  );
}
