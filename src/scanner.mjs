import fs from 'fs';
import path from 'path';
import {
  detectBuilder,
  detectBuilderFast,
  detectPkgManager,
  detectPkgManagerFromJson,
  detectPkgManagerAndLock,
} from './detect.mjs';
import { detectPort, detectPortFromScripts } from './port.mjs';
import { detectInstallStatus } from './install.mjs';
import { getPackageStats } from './package-stats.mjs';
import { shouldSkipDir } from './utils.mjs';
import { yieldToEventLoop } from './async.mjs';
import { parseScriptMeta, isRunnableProject } from './project.mjs';

const YIELD_EVERY_DIRS = 12;

function visitEntries(dir, entries, excludeSet, visitor) {
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name, excludeSet)) continue;
      visitor.onDir(path.join(dir, entry.name));
      continue;
    }

    if (entry.name === 'package.json') {
      visitor.onPackageJson(path.join(dir, entry.name));
    }
  }
}

function readPackageJson(pkgPath) {
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    return null;
  }
}

function parseProject(pkgPath, rootDir, { fast = true } = {}) {
  const dir = path.dirname(pkgPath);
  const json = readPackageJson(pkgPath);
  if (!json) return null;

  const scripts = json.scripts || {};
  const scriptMeta = parseScriptMeta(scripts);
  const builder = fast ? detectBuilderFast(json) : detectBuilder(dir, json);

  if (!isRunnableProject({ ...scriptMeta, builder })) return null;

  const pkgMgr = fast ? detectPkgManagerFromJson(json) : detectPkgManager(dir);
  const lockInfo = fast ? null : detectPkgManagerAndLock(dir);

  return {
    name: json.name || path.basename(dir),
    version: json.version || '0.0.0',
    dir,
    relDir: path.relative(rootDir, dir) || '.',
    folderName: path.basename(dir),
    builder,
    pkgMgr,
    port: fast ? detectPortFromScripts(scripts) : detectPort(dir, scripts),
    installStatus: fast ? 'unknown' : detectInstallStatus(dir),
    hasLock: fast ? null : lockInfo?.hasLock ?? false,
    stats: getPackageStats(json),
    _fsMetaLoaded: false,
    _installLoaded: false,
    _builderFull: !fast,
    ...scriptMeta,
    _json: json,
  };
}

function collectPackageFilesSync(dir, excludeSet, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  visitEntries(dir, entries, excludeSet, {
    onDir: (child) => collectPackageFilesSync(child, excludeSet, out),
    onPackageJson: (pkgPath) => out.push(pkgPath),
  });
}

async function walkPackageFilesAsync(rootDir, excludeSet, onFound) {
  const queue = [rootDir];
  let dirsScanned = 0;
  let lastYield = Date.now();

  while (queue.length > 0) {
    const dir = queue.pop();
    let entries;

    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    visitEntries(dir, entries, excludeSet, {
      onDir: (child) => queue.push(child),
      onPackageJson: onFound,
    });

    dirsScanned += 1;
    const now = Date.now();
    if (dirsScanned % YIELD_EVERY_DIRS === 0 || now - lastYield > 16) {
      lastYield = now;
      await yieldToEventLoop();
    }
  }
}

export function buildProjects(rootDir, excludeSet) {
  const pkgFiles = [];
  collectPackageFilesSync(rootDir, excludeSet, pkgFiles);
  pkgFiles.sort();

  return pkgFiles
    .map((pkgPath) => parseProject(pkgPath, rootDir, { fast: true }))
    .filter(Boolean);
}

export async function buildProjectsAsync(rootDir, excludeSet, { onBatch, onProgress } = {}) {
  const projects = [];
  let found = 0;

  await walkPackageFilesAsync(rootDir, excludeSet, (pkgPath) => {
    found += 1;
    onProgress?.(found);

    const proj = parseProject(pkgPath, rootDir, { fast: true });
    if (!proj) return;

    projects.push(proj);
    onBatch?.(projects, proj);
  });

  projects.sort((a, b) => a.relDir.localeCompare(b.relDir));
  return projects;
}

export function refineProject(proj) {
  if (proj._builderFull) return proj;

  proj.builder = detectBuilder(proj.dir, proj._json || {});
  proj._builderFull = true;
  return proj;
}

export function findProject(projects, query) {
  if (!query) return null;

  const q = query.toLowerCase();
  const exact = projects.find(
    (p) => p.name.toLowerCase() === q || p.relDir.toLowerCase() === q
  );
  if (exact) return exact;

  const partial = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.relDir.toLowerCase().includes(q) ||
      path.basename(p.dir).toLowerCase().includes(q)
  );

  if (partial.length === 1) return partial[0];
  if (partial.length > 1) {
    const err = new Error(`Multiple projects match "${query}": ${partial.map((p) => p.name).join(', ')}`);
    err.matches = partial;
    throw err;
  }

  return null;
}
