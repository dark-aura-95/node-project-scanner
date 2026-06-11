import path from 'path';
import { exists } from './utils.mjs';

const BUILDER_FROM_DEPS = [
  { match: (deps) => deps.includes('next'), value: 'Next.js' },
  { match: (deps) => deps.some((d) => d.startsWith('nuxt')), value: 'Nuxt' },
  { match: (deps) => deps.some((d) => d.startsWith('@sveltejs')) || deps.includes('svelte'), value: 'SvelteKit' },
  { match: (deps) => deps.includes('astro'), value: 'Astro' },
  { match: (deps) => deps.some((d) => d.startsWith('@remix-run')), value: 'Remix' },
  { match: (deps) => deps.includes('gatsby'), value: 'Gatsby' },
  { match: (deps) => deps.some((d) => d.startsWith('@angular')), value: 'Angular' },
  { match: (deps) => deps.includes('vite') || deps.includes('@vitejs/plugin-react'), value: 'Vite' },
  { match: (deps) => deps.includes('webpack'), value: 'Webpack' },
  { match: (deps) => deps.includes('parcel'), value: 'Parcel' },
  { match: (deps) => deps.includes('rollup'), value: 'Rollup' },
  { match: (deps) => deps.includes('esbuild'), value: 'esbuild' },
  { match: (deps) => deps.includes('typescript'), value: 'tsc' },
];

const BUILDER_FROM_FILES = [
  { files: ['next.config.js', 'next.config.ts', 'next.config.mjs'], value: 'Next.js' },
  { files: ['vite.config.js', 'vite.config.ts', 'vite.config.mjs'], value: 'Vite' },
  { files: ['nuxt.config.js', 'nuxt.config.ts', 'nuxt.config.mjs'], value: 'Nuxt' },
  { files: ['svelte.config.js', 'svelte.config.ts'], value: 'SvelteKit' },
  { files: ['astro.config.mjs', 'astro.config.ts'], value: 'Astro' },
  { files: ['remix.config.js', 'remix.config.ts'], value: 'Remix' },
  { files: ['gatsby-config.js', 'gatsby-config.ts'], value: 'Gatsby' },
  { files: ['angular.json'], value: 'Angular' },
  { files: ['webpack.config.js', 'webpack.config.ts'], value: 'Webpack' },
  { files: ['rollup.config.js', 'rollup.config.mjs'], value: 'Rollup' },
];

function depNames(json) {
  return Object.keys({
    ...json.dependencies,
    ...json.devDependencies,
    ...json.peerDependencies,
  });
}

function detectBuilderFromDeps(json) {
  const deps = depNames(json);
  for (const rule of BUILDER_FROM_DEPS) {
    if (rule.match(deps)) return rule.value;
  }
  return 'Unknown';
}

export function detectBuilderFast(json) {
  return detectBuilderFromDeps(json);
}

export function detectBuilder(dir, json) {
  const c = (file) => exists(path.join(dir, file));

  for (const rule of BUILDER_FROM_FILES) {
    if (rule.files.some(c)) return rule.value;
  }

  return detectBuilderFromDeps(json);
}

export function detectPkgManagerFromJson(json) {
  const pm = json.packageManager?.split('@')[0];
  if (pm === 'pnpm' || pm === 'yarn' || pm === 'bun' || pm === 'npm') return pm;
  return 'npm';
}

export function detectPkgManagerAndLock(dir) {
  if (exists(path.join(dir, 'pnpm-lock.yaml'))) return { pkgMgr: 'pnpm', hasLock: true };
  if (exists(path.join(dir, 'yarn.lock'))) return { pkgMgr: 'yarn', hasLock: true };
  if (exists(path.join(dir, 'bun.lockb')) || exists(path.join(dir, 'bun.lock'))) {
    return { pkgMgr: 'bun', hasLock: true };
  }
  if (exists(path.join(dir, 'package-lock.json'))) return { pkgMgr: 'npm', hasLock: true };
  return { pkgMgr: 'npm', hasLock: false };
}

export function detectPkgManager(dir) {
  return detectPkgManagerAndLock(dir).pkgMgr;
}
