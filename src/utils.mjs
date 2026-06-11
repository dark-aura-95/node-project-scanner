import fs from 'fs';

export const ALWAYS_EXCLUDE = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'out',
  '.nuxt', '.svelte-kit', 'coverage', '__pycache__', '.venv', 'venv',
  '.turbo', '.cache', 'tmp', '.idea', '.vscode',
  // Windows system / heavy trees
  '$Recycle.Bin', 'System Volume Information', 'Recovery', 'Windows',
  'Program Files', 'Program Files (x86)', 'ProgramData', 'PerfLogs',
  '$WinREAgent', 'MSOCache', 'AppData', 'Users',
  // Package caches / artifacts
  '.gradle', '.pnpm-store', 'vendor', 'target', 'Pods', '.yarn',
  'bower_components', '.parcel-cache', '.nx', 'storybook-static',
  '.npm', '.electron', '.electron-gyp', '.husky', '.local',
  // Other VCS / tooling
  '.hg', '.svn', '.terraform', '.serverless',
]);

export const exists = (p) => {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
};

export function shouldSkipDir(name, excludeSet) {
  if (excludeSet.has(name)) return true;
  if (name.startsWith('$')) return true;
  return false;
}

export function padEnd(str, len) {
  const plain = str.replace(/\x1b\[[0-9;]*m/g, '');
  const pad = Math.max(0, len - plain.length);
  return str + ' '.repeat(pad);
}

export function parseExcludeList(value) {
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

export function buildExcludeSet(extra = []) {
  return new Set([...ALWAYS_EXCLUDE, ...extra]);
}
