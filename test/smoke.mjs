import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'bin', 'nps.mjs');

let passed = 0;
let failed = 0;

function ok(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

async function okAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

function runCli(args, { timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bin, ...args], {
      cwd: root,
      env: { ...process.env, FORCE_COLOR: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`timeout: nps ${args.join(' ')}`));
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

console.log('\nModule tests');

const { buildProjects, buildProjectsAsync, findProject, refineProject } = await import('../src/scanner.mjs');
const { buildExcludeSet } = await import('../src/utils.mjs');
const { filterProjects, matchesProjectQuery } = await import('../src/project-filter.mjs');
const { parseScriptMeta, buildActions, hasScript, ACTION } = await import('../src/project.mjs');
const { detectBuilderFast, detectPkgManagerFromJson, detectPkgManagerAndLock } = await import('../src/detect.mjs');
const { detectPortFromScripts, validatePort, killPort } = await import('../src/port.mjs');
const { detectInstallStatusLight } = await import('../src/install.mjs');
const {
  loadProjectFsMeta,
  loadProjectGit,
  loadProjectOutdated,
  loadProjectInstallStatus,
  loadProjectDetails,
  applyProjectMetaFast,
} = await import('../src/ui/lazy-load.mjs');
const { createGenerationToken } = await import('../src/async.mjs');

const exclude = buildExcludeSet();
const projects = buildProjects(root, exclude);

ok('buildProjects finds current package', () => {
  assert.ok(projects.length >= 1);
  assert.equal(projects.some((p) => p.name === 'node-project-scanner'), true);
});

ok('project has folderName and script meta', () => {
  const p = projects[0];
  assert.ok(p.folderName);
  assert.equal(typeof p.hasDev, 'boolean');
  assert.ok(p.scripts);
});

ok('findProject exact match', () => {
  const p = findProject(projects, 'node-project-scanner');
  assert.ok(p);
});

ok('findProject partial unique', () => {
  const p = findProject(projects, 'scanner');
  assert.ok(p);
});

ok('filterProjects search', () => {
  const hits = filterProjects(projects, 'node');
  assert.ok(hits.length >= 1);
  assert.ok(matchesProjectQuery(projects[0], 'node'));
});

ok('parseScriptMeta', () => {
  const m = parseScriptMeta({ dev: 'vite', build: 'vite build' });
  assert.equal(m.hasDev, true);
  assert.equal(m.hasBuild, true);
  assert.equal(m.devCmd, 'vite');
});

ok('detectBuilderFast', () => {
  assert.equal(detectBuilderFast({ devDependencies: { commander: '1' } }), 'Unknown');
});

ok('validatePort', () => {
  assert.equal(validatePort(3000), 3000);
  assert.equal(validatePort('8080'), 8080);
  assert.equal(validatePort(0), null);
  assert.equal(validatePort(70000), null);
  assert.equal(validatePort('abc'), null);
});

ok('detectPortFromScripts', () => {
  assert.equal(detectPortFromScripts({ dev: 'vite --port 5173' }), 5173);
  assert.equal(detectPortFromScripts({}), 3000);
});

ok('detectPkgManagerFromJson', () => {
  assert.equal(detectPkgManagerFromJson({ packageManager: 'pnpm@9.0.0' }), 'pnpm');
});

ok('detectInstallStatusLight', () => {
  const status = detectInstallStatusLight(root);
  assert.ok(['installed', 'missing'].includes(status));
});

ok('detectPkgManagerAndLock on repo', () => {
  const info = detectPkgManagerAndLock(root);
  assert.ok(['npm', 'pnpm', 'yarn', 'bun'].includes(info.pkgMgr));
  assert.equal(typeof info.hasLock, 'boolean');
});

ok('refineProject marks builder full', () => {
  const p = { ...projects[0], _builderFull: false, _json: projects[0]._json };
  refineProject(p);
  assert.equal(p._builderFull, true);
});

await okAsync('buildProjectsAsync incremental', async () => {
  let batches = 0;
  const asyncProjects = await buildProjectsAsync(root, exclude, {
    onBatch: () => { batches += 1; },
  });
  assert.ok(asyncProjects.length >= 1);
  assert.ok(batches >= 1);
});

await okAsync('lazy-load pipeline on project', async () => {
  const proj = structuredClone(projects[0]);
  const stages = [];

  await new Promise((resolve) => {
    loadProjectDetails(proj, {
      onFs: () => stages.push('fs'),
      onGit: () => stages.push('git'),
      onOutdated: () => stages.push('outdated'),
      onDone: resolve,
    });
  });

  assert.deepEqual(stages, ['fs', 'git', 'outdated']);
  assert.equal(proj._fsMetaLoaded, true);
  assert.equal(proj._gitLoaded, true);
  assert.equal(proj._outdatedLoaded, true);
  assert.ok(proj.git);
});

ok('loadProjectInstallStatus', () => {
  const proj = structuredClone(projects[0]);
  proj._installLoaded = false;
  proj.installStatus = 'unknown';
  loadProjectInstallStatus(proj);
  assert.notEqual(proj.installStatus, 'unknown');
});

ok('applyProjectMetaFast', () => {
  const proj = structuredClone(projects[0]);
  applyProjectMetaFast(proj);
  assert.ok(proj.nodeVersion);
});

ok('createGenerationToken', () => {
  const t = createGenerationToken();
  const a = t.next();
  assert.equal(t.isCurrent(a), true);
  t.next();
  assert.equal(t.isCurrent(a), false);
});

ok('buildActions includes start script', () => {
  const p = projects[0];
  const actions = buildActions(p);
  assert.ok(actions.some((a) => a.script === 'start' || a.script === ACTION.INSTALL));
});

ok('hasScript install always true', () => {
  assert.equal(hasScript(projects[0], ACTION.INSTALL), true);
});

console.log('\nCLI tests (non-interactive)');

await okAsync('--version', async () => {
  const { code, stdout } = await runCli(['--version']);
  assert.equal(code, 0);
  assert.match(stdout, /1\.1\.0/);
});

await okAsync('scan --list-only', async () => {
  const { code, stdout } = await runCli(['scan', '.', '--list-only']);
  assert.equal(code, 0);
  assert.match(stdout, /node-project-scanner/);
});

await okAsync('scan --json', async () => {
  const { code, stdout } = await runCli(['scan', '.', '--json']);
  assert.equal(code, 0);
  const data = JSON.parse(stdout);
  assert.ok(Array.isArray(data));
  assert.ok(data.length >= 1);
});

await okAsync('list', async () => {
  const { code, stdout } = await runCli(['list', '.']);
  assert.equal(code, 0);
  const data = JSON.parse(stdout);
  assert.ok(data[0].folderName);
});

await okAsync('info project', async () => {
  const { code, stdout } = await runCli(['info', 'node-project-scanner', '.']);
  assert.equal(code, 0);
  assert.match(stdout, /node-project-scanner/);
});

await okAsync('info --json', async () => {
  const { code, stdout } = await runCli(['info', 'node-project-scanner', '.', '--json']);
  assert.equal(code, 0);
  const data = JSON.parse(stdout);
  assert.equal(data.name, 'node-project-scanner');
});

await okAsync('memory show', async () => {
  const { code, stdout } = await runCli(['memory']);
  assert.equal(code, 0);
  assert.match(stdout, /Device RAM/);
});

await okAsync('kill-port already free', async () => {
  const { code, stdout } = await runCli(['kill-port', '45678']);
  assert.equal(code, 0);
  assert.match(stdout, /already free/i);
});

await okAsync('kill-port invalid exits 1', async () => {
  const { code, stdout, stderr } = await runCli(['kill-port', '99999']);
  assert.equal(code, 1);
  assert.match(stdout + stderr, /invalid port/i);
});

await okAsync('killPort on free port', async () => {
  const result = await killPort(45679);
  assert.equal(result.wasFree, true);
  assert.equal(result.nowFree, true);
  assert.deepEqual(result.killed, []);
});

await okAsync('info missing project exits 1', async () => {
  const { code, stderr } = await runCli(['info', 'nonexistent-xyz-404', '.']);
  assert.equal(code, 1);
  assert.match(stderr + '', /not found|Not found|match/i);
});

await okAsync('run missing script exits 1', async () => {
  const { code, stderr } = await runCli(['run', 'node-project-scanner', '.', '-s', 'nonexistent-script-xyz']);
  assert.equal(code, 1);
});

await okAsync('build without script exits 1', async () => {
  const { code, stdout, stderr } = await runCli(['build', 'node-project-scanner', '.']);
  assert.equal(code, 1);
  assert.match(stdout + stderr, /build/i);
});

await okAsync('default scan non-tty prints table', async () => {
  const { code, stdout } = await runCli(['scan', '.', '--list-only']);
  assert.equal(code, 0);
  assert.match(stdout, /PROJECT|node-project-scanner|Found/i);
});

console.log('\nFormatter tests');

const { formatProjectListItem, formatBasicInfo, formatGitStatus, formatRecentCommits } =
  await import('../src/ui/dashboard-format.mjs');
const { renderAnsiProjectRow } = await import('../src/ui/format.mjs');
const { runInteractive } = await import('../src/ui/router.mjs');

ok('formatProjectListItem renders', () => {
  const p = projects[0];
  const line = formatProjectListItem(p, true);
  assert.match(line, /node-project-scan/);
  assert.match(line, new RegExp(`v${p.version.replace(/\./g, '\\.')}`));
});

ok('formatBasicInfo renders', () => {
  const text = formatBasicInfo(projects[0]);
  assert.match(text, /BASIC INFO/);
  assert.match(text, /Folder/);
});

ok('renderAnsiProjectRow renders', () => {
  const row = renderAnsiProjectRow(projects[0], false);
  assert.match(row, /node-project-scanner/);
});

await okAsync('git + commits format after load', async () => {
  const proj = structuredClone(projects[0]);
  loadProjectFsMeta(proj);
  loadProjectGit(proj);
  const gitPanel = formatGitStatus(proj);
  const commitsPanel = formatRecentCommits(proj);
  assert.match(gitPanel, /GIT STATUS/);
  assert.match(commitsPanel, /RECENT COMMITS|No commits|commit/i);
});

await okAsync('router non-tty fallback', async () => {
  const stdinTty = process.stdin.isTTY;
  const stdoutTty = process.stdout.isTTY;
  process.stdin.isTTY = false;
  process.stdout.isTTY = false;
  try {
    const code = await runInteractive(root, exclude);
    assert.equal(code, 0);
  } finally {
    process.stdin.isTTY = stdinTty;
    process.stdout.isTTY = stdoutTty;
  }
});

console.log(`\n${'─'.repeat(40)}`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
