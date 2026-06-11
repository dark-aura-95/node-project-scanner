import fs from 'fs';
import path from 'path';
import { exists } from './utils.mjs';
import { detectPkgManagerAndLock } from './detect.mjs';

export function detectInstallStatusLight(dir) {
  return exists(path.join(dir, 'node_modules')) ? 'installed' : 'missing';
}

export function detectInstallStatus(dir) {
  const nm = path.join(dir, 'node_modules');
  if (!exists(nm)) return 'missing';

  try {
    if (!fs.statSync(nm).isDirectory()) return 'missing';
  } catch {
    return 'missing';
  }

  return 'installed';
}

export function hasLockFile(dir) {
  return detectPkgManagerAndLock(dir).hasLock;
}

export function getCiArgs(pkgMgr) {
  switch (pkgMgr) {
    case 'pnpm':
      return ['install', '--frozen-lockfile'];
    case 'yarn':
      return ['install', '--frozen-lockfile'];
    case 'bun':
      return ['install', '--frozen-lockfile'];
    default:
      return ['ci'];
  }
}

export function getInstallLabel(pkgMgr) {
  return `${pkgMgr} install`;
}

export function getCiLabel(pkgMgr) {
  switch (pkgMgr) {
    case 'pnpm':
      return `${pkgMgr} install --frozen-lockfile`;
    case 'yarn':
      return `${pkgMgr} install --frozen-lockfile`;
    case 'bun':
      return `${pkgMgr} install --frozen-lockfile`;
    default:
      return `${pkgMgr} ci`;
  }
}
