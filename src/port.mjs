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
  const hosts = ['0.0.0.0', '127.0.0.1', '::1', '::'];

  return new Promise((resolve) => {
    let index = 0;

    const tryNext = () => {
      if (index >= hosts.length) return resolve(true);

      const host = hosts[index++];
      const srv = net.createServer();
      srv.once('error', (err) => {
        if (err.code === 'EADDRINUSE') return resolve(false);
        if (host === '::1' || host === '::') return tryNext();
        return resolve(false);
      });
      srv.once('listening', () => srv.close(tryNext));
      srv.listen(port, host);
    };

    tryNext();
  });
}

export function validatePort(port) {
  if (typeof port === 'number') {
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
    return port;
  }

  const raw = String(port).trim();
  if (!/^\d+$/.test(raw)) return null;

  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 65535) return null;
  return n;
}

function parseWindowsNetstat(stdout, port) {
  const pids = new Set();

  for (const line of stdout.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5 || parts[0] !== 'TCP') continue;

    const state = parts[3]?.toUpperCase() ?? '';
    if (state.includes('WAIT')) continue;

    const localPort = parsePortFromAddress(parts[1]);
    if (localPort !== port) continue;

    const pid = parseInt(parts[parts.length - 1], 10);
    if (Number.isFinite(pid) && pid > 0) pids.add(pid);
  }

  return [...pids];
}

function parsePortFromAddress(address = '') {
  if (!address) return null;

  if (address.startsWith('[')) {
    const end = address.indexOf(']');
    if (end === -1) return null;
    const port = parseInt(address.slice(end + 2), 10);
    return Number.isFinite(port) ? port : null;
  }

  const colon = address.lastIndexOf(':');
  if (colon === -1) return null;
  const port = parseInt(address.slice(colon + 1), 10);
  return Number.isFinite(port) ? port : null;
}

async function findPidsOnPortWindows(port) {
  try {
    const { stdout } = await execFileAsync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false); ` +
          `(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | ` +
          `Select-Object -ExpandProperty OwningProcess -Unique) -join ' '`,
      ],
      { encoding: 'utf8', windowsHide: true }
    );
    const pids = stdout
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((s) => parseInt(s, 10))
      .filter((n) => n > 0);
    if (pids.length) return [...new Set(pids)];
  } catch {
    // fall back to netstat
  }

  try {
    const { stdout } = await execFileAsync('netstat', ['-ano'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    return parseWindowsNetstat(stdout, port);
  } catch {
    return [];
  }
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
    return findPidsOnPortWindows(valid);
  }

  return findPidsOnPortUnix(valid);
}

export async function killPort(port, { force = true } = {}) {
  const valid = validatePort(port);
  if (valid == null) throw new Error(`Invalid port: ${port}`);

  const pids = await findPidsOnPort(valid);
  if (!pids.length && (await isPortFree(valid))) {
    return { port: valid, wasFree: true, killed: [], nowFree: true };
  }

  const killed = [];

  for (const pid of pids) {
    if (pid === process.pid) continue;
    try {
      if (process.platform === 'win32') {
        await execFileAsync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
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

export async function getPortStatus(port) {
  const valid = validatePort(port);
  if (valid == null) return { valid: false, port: null, isFree: false, freePort: null };

  const isFree = await isPortFree(valid);
  const freePort = isFree ? valid : await findFreePort(valid);
  return { valid: true, port: valid, isFree, freePort };
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

export async function restoreStdinForPrompt() {
  if (!process.stdin.isTTY) return;

  process.stdin.setRawMode(false);
  process.stdin.removeAllListeners('keypress');
  if (process.stdin.isPaused()) process.stdin.resume();

  process.stdin.setEncoding('utf8');
  let chunk;
  while ((chunk = process.stdin.read()) !== null) {
    // discard buffered keystrokes left from the TUI
  }

  cursor.show();
  await new Promise((resolve) => setTimeout(resolve, 50));
}

function readPortAnswer(currentPort, freePort, invalidMsg = '') {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    const prompt =
      `\n  ${B}${fg.bcyan}⚙ Port Setup${R}\n` +
      `  ${DIM}Detected:${R} ${currentPort}  ${DIM}Status:${R} ${msgPortStatus(currentPort, freePort)}\n` +
      (invalidMsg ? `  ${fg.yellow}${invalidMsg}${R}\n` : '') +
      `  ${DIM}Press Enter for auto (${freePort}), or type a port:${R} `;

    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function askPort(currentPort, freePort) {
  await restoreStdinForPrompt();

  let invalidMsg = '';
  while (true) {
    const trimmed = await readPortAnswer(currentPort, freePort, invalidMsg);
    if (!trimmed) return freePort;

    const port = validatePort(trimmed);
    if (port != null) return port;

    invalidMsg = `Invalid port "${trimmed}" (use 1–65535)`;
  }
}
