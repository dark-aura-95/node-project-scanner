import fs from 'fs';
import path from 'path';
import net from 'net';
import readline from 'readline';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { exists } from './utils.mjs';
import { fg, R, DIM, B, cursor } from './theme.mjs';
import { msgPortStatus } from './messages.mjs';

const execFileAsync = promisify(execFile);

export function detectPortFromScripts(scripts = {}) {
  const allScripts = Object.values(scripts).join(' ');
  const m1 = allScripts.match(/--port[= ](\d+)/);
  if (m1) return parseInt(m1[1], 10);
  const m2 = allScripts.match(/-p (\d+)/);
  if (m2) return parseInt(m2[1], 10);
  return 3000;
}

export function detectPort(dir, scripts = {}) {
  for (const envFile of ['.env', '.env.local', '.env.development']) {
    const p = path.join(dir, envFile);
    if (exists(p)) {
      const m = fs.readFileSync(p, 'utf8').match(/^\s*PORT\s*=\s*["']?(\d+)["']?/m);
      if (m) return parseInt(m[1], 10);
    }
  }
  return detectPortFromScripts(scripts);
}

export function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}

export function validatePort(port) {
  const n = typeof port === 'number' ? port : parseInt(port, 10);
  if (!Number.isFinite(n) || n < 1 || n > 65535) return null;
  return n;
}

function parseWindowsNetstat(stdout, port) {
  const pids = new Set();
  const suffix = `:${port}`;

  for (const line of stdout.split(/\r?\n/)) {
    if (!/\sLISTENING\s/.test(line)) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;
    if (!parts[1].endsWith(suffix)) continue;
    const pid = parseInt(parts[parts.length - 1], 10);
    if (Number.isFinite(pid) && pid > 0) pids.add(pid);
  }

  return [...pids];
}

async function findPidsOnPortUnix(port) {
  try {
    const { stdout } = await execFileAsync(
      'lsof',
      ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'],
      { encoding: 'utf8' }
    );
    return stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((s) => parseInt(s, 10))
      .filter((n) => n > 0);
  } catch (err) {
    if (err.code === 1) return [];
    try {
      const { stderr } = await execFileAsync('fuser', [`${port}/tcp`], { encoding: 'utf8' });
      return [...new Set((stderr.match(/\d+/g) || []).map(Number).filter((n) => n > 0))];
    } catch {
      return [];
    }
  }
}

export async function findPidsOnPort(port) {
  const valid = validatePort(port);
  if (valid == null) return [];

  if (process.platform === 'win32') {
    try {
      const { stdout } = await execFileAsync('netstat', ['-ano'], {
        encoding: 'utf8',
        windowsHide: true,
      });
      return parseWindowsNetstat(stdout, valid);
    } catch {
      return [];
    }
  }

  return findPidsOnPortUnix(valid);
}

export async function killPort(port, { force = true } = {}) {
  const valid = validatePort(port);
  if (valid == null) throw new Error(`Invalid port: ${port}`);

  const wasFree = await isPortFree(valid);
  if (wasFree) {
    return { port: valid, wasFree: true, killed: [], nowFree: true };
  }

  const pids = await findPidsOnPort(valid);
  const killed = [];

  for (const pid of pids) {
    if (pid === process.pid) continue;
    try {
      if (process.platform === 'win32') {
        await execFileAsync('taskkill', ['/PID', String(pid), '/F'], { windowsHide: true });
      } else {
        try {
          process.kill(pid, force ? 'SIGKILL' : 'SIGTERM');
        } catch {
          await execFileAsync('kill', [force ? '-9' : '-15', String(pid)]);
        }
      }
      killed.push(pid);
    } catch {
      // process may already be gone
    }
  }

  for (let i = 0; i < 10; i++) {
    if (await isPortFree(valid)) break;
    await new Promise((r) => setTimeout(r, 100));
  }

  return { port: valid, wasFree: false, killed, nowFree: await isPortFree(valid) };
}

export async function findFreePort(start, maxTries = 50) {
  let port = start;
  for (let i = 0; i < maxTries; i++) {
    if (await isPortFree(port)) return port;
    port++;
  }
  return start;
}

export async function resolvePort(requestedPort, detectedPort) {
  const base = requestedPort ?? detectedPort;
  const freePort = await findFreePort(base);
  let port = requestedPort ?? freePort;

  if (!(await isPortFree(port))) {
    port = await findFreePort(port);
  }

  return port;
}

export function askPort(currentPort, freePort) {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    cursor.show();

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    rl.question(
      `\n  ${B}${fg.bcyan}⚙ Port Setup${R}\n` +
      `  ${DIM}Detected:${R} ${currentPort}  ${DIM}Status:${R} ${msgPortStatus(currentPort, freePort)}\n` +
      `  ${DIM}Press Enter for auto (${freePort}), or type a port:${R} `,
      (answer) => {
        rl.close();
        const trimmed = answer.trim();
        if (!trimmed) {
          resolve(freePort);
          return;
        }
        const num = parseInt(trimmed, 10);
        resolve((num >= 1 && num <= 65535) ? num : freePort);
      }
    );
  });
}
