import fs from 'fs';
import path from 'path';
import { exists } from './utils.mjs';

export const REINIT_DIRS = [
  'node_modules',
  'build',
  'dist',
  '.next',
  'out',
  '.nuxt',
  '.svelte-kit',
  'coverage',
  '.turbo',
  '.cache',
  '.parcel-cache',
  'storybook-static',
  '.nx',
  '.vite',
  '.eslintcache',
];

export function removeReinitArtifacts(dir) {
  const removed = [];

  for (const name of REINIT_DIRS) {
    const target = path.join(dir, name);
    if (!exists(target)) continue;

    try {
      fs.rmSync(target, { recursive: true, force: true });
      removed.push(name);
    } catch (err) {
      throw new Error(`failed to remove ${name}: ${err.message}`);
    }
  }

  return removed;
}

export function getReinitLabel(pkgMgr) {
  return `clean + ${pkgMgr} install`;
}
