import fs from 'node:fs';
import path from 'node:path';

const APP_ROOT = path.join(process.cwd(), 'src', 'app');
const BUILD_MANIFEST = path.join(process.cwd(), '.next', 'server', 'app-paths-manifest.json');

function normalizeSegment(segment: string) {
  if (segment.startsWith('(') && segment.endsWith(')')) {
    return '';
  }

  if (segment.startsWith('@')) {
    return '';
  }

  return segment;
}

function toRoutePath(relativeDir: string) {
  const normalized = relativeDir
    .split(path.sep)
    .filter(Boolean)
    .map(normalizeSegment)
    .filter(Boolean)
    .join('/');

  return normalized ? `/${normalized}` : '/';
}

function collectMatchingFiles(root: string, matcher: (fileName: string) => boolean) {
  const matches: string[] = [];

  function visit(current: string) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) {
        continue;
      }

      const nextPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(nextPath);
        continue;
      }

      if (matcher(entry.name)) {
        matches.push(nextPath);
      }
    }
  }

  visit(root);
  return matches;
}

function readBuildRoutes() {
  if (!fs.existsSync(BUILD_MANIFEST)) {
    return [];
  }

  const manifest = JSON.parse(fs.readFileSync(BUILD_MANIFEST, 'utf8')) as Record<
    string,
    string
  >;

  return Object.keys(manifest)
    .map((route) => route.replace(/\/page$/, '').replace(/^\/_not-found$/, '/_not-found'))
    .filter(Boolean);
}

export function discoverRoutes() {
  const pageFiles = collectMatchingFiles(APP_ROOT, (fileName) => /^page\.(t|j)sx?$/.test(fileName));
  const apiFiles = collectMatchingFiles(APP_ROOT, (fileName) => /^route\.(t|j)sx?$/.test(fileName));

  const pageRoutes = new Set(
    pageFiles.map((filePath) =>
      toRoutePath(path.relative(APP_ROOT, path.dirname(filePath))),
    ),
  );

  const apiRoutes = new Set(
    apiFiles.map((filePath) =>
      toRoutePath(path.relative(APP_ROOT, path.dirname(filePath))),
    ),
  );

  for (const route of readBuildRoutes()) {
    pageRoutes.add(route);
  }

  return {
    pages: [...pageRoutes].sort(),
    api: [...apiRoutes].sort(),
  };
}

export const REQUIRED_PAGE_ROUTES = ['/', '/chat', '/overlay', '/admin', '/admin/login'];
