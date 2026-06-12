import { spawn } from 'child_process';
import { findFreePort, isPortFree, killPort } from './port.mjs';
import { getCiArgs } from './install.mjs';
import { ACTION, needsPort, isDirectAction } from './project.mjs';
import { B, fg, R, DIM, W } from './theme.mjs';
import { msgPortStatus, msgPortBusy, msgPortKilled, msgPortKillFailed } from './messages.mjs';
import { buildNodeOptions, getMemoryGb, memoryMb } from './memory.mjs';

const PORT_ARGS = {
  'Next.js': ['--port'],
  'Vite': ['--port'],
  'Nuxt': ['--port'],
  'SvelteKit': ['--port'],
  'Astro': ['--port'],
  'Webpack': ['--port'],
  'Angular': ['--port'],
  'Remix': ['--port'],
  'Gatsby': ['-p'],
  'Parcel': ['--port'],
};

function buildSpawnArgs(proj, script, port) {
  if (script === ACTION.INSTALL) {
    return ['install'];
  }
  if (script === ACTION.CI) {
    return proj.hasLock ? getCiArgs(proj.pkgMgr) : ['run', 'ci'];
  }
  if (needsPort(script)) {
    const flag = PORT_ARGS[proj.builder] || ['-p'];
    return ['run', script, '--', ...flag, String(port)];
  }
  return ['run', script];
}

function commandLabel(proj, script) {
  const args = buildSpawnArgs(proj, script, proj.port);
  return `${proj.pkgMgr} ${args.join(' ')}`;
}

export async function preparePort(proj, requestedPort, interactive = false, { killPort: shouldKill = false } = {}) {
  const detectedPort = proj.port;
  const freePort = await findFreePort(requestedPort ?? detectedPort);
  let port = requestedPort ?? freePort;

  if (interactive && requestedPort == null) {
    const { askPort, restoreStdinForPrompt } = await import('./port.mjs');
    await restoreStdinForPrompt();
    port = await askPort(detectedPort, freePort);
  }

  if (!(await isPortFree(port))) {
    if (shouldKill) {
      const result = await killPort(port);
      if (result.nowFree) {
        if (interactive && result.killed.length > 0) {
          process.stdout.write(`  ${msgPortKilled(port, result.killed)}\n`);
        }
        return port;
      }
      if (interactive) {
        process.stdout.write(`  ${msgPortKillFailed(port)}\n`);
      }
    }

    const bumped = await findFreePort(port);
    if (interactive) {
      process.stdout.write(`  ${msgPortBusy(port, bumped)}\n`);
    }
    port = bumped;
  }

  return port;
}

export function printLaunch(proj, script, port, memoryGb) {
  const w = W();
  const cmd = commandLabel(proj, script);
  const mem = memoryGb ?? getMemoryGb();
  process.stdout.write('\n');
  process.stdout.write(`  ${fg.gray}${'─'.repeat(w - 4)}${R}\n`);
  process.stdout.write(`  ${B}${fg.bcyan}🚀 Launching${R}  ${B}${cmd}${R}  ${DIM}(${proj.name}@${proj.version})${R}\n`);
  if (needsPort(script)) {
    process.stdout.write(`  ${DIM}${fg.gray}url  ${R}${fg.cyan}http://localhost:${port}${R}\n`);
  }
  process.stdout.write(`  ${DIM}${fg.gray}mem  ${R}${fg.cyan}${mem} GB${R} ${DIM}(${memoryMb(mem)} MB heap)${R}\n`);
  process.stdout.write(`  ${DIM}${fg.gray}cwd  ${R}${fg.gray}${proj.relDir}${R}\n`);
  process.stdout.write(`  ${fg.gray}${'─'.repeat(w - 4)}${R}\n\n`);
}

export function runProject(proj, script, port, memoryGb) {
  const mem = memoryGb ?? getMemoryGb();
  process.env.NODE_OPTIONS = buildNodeOptions(mem);
  if (needsPort(script)) {
    process.env.PORT = String(port);
  }

  const spawnArgs = buildSpawnArgs(proj, script, port);

  const child = spawn(proj.pkgMgr, spawnArgs, {
    cwd: proj.dir,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env },
  });

  return new Promise((resolve) => {
    child.on('exit', (code) => resolve(code ?? 0));
  });
}

export async function launchProject(proj, script, {
  port: requestedPort,
  memoryGb,
  interactive = false,
  killPort: shouldKill = false,
} = {}) {
  let port = proj.port;
  const mem = memoryGb ?? getMemoryGb();

  if (needsPort(script)) {
    port = await preparePort(proj, requestedPort, interactive, { killPort: shouldKill });
    proj.port = port;
  }

  printLaunch(proj, script, port, mem);
  return runProject(proj, script, port, mem);
}
