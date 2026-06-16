import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { APP } from './constants.mjs';
import { CONFIG_DIR, CONFIG_FILE, loadConfig } from './config.mjs';
import { getMemoryInfo } from './memory.mjs';
import { getSslExpiryInfo } from './ssl.mjs';
import { fg, R, DIM } from './theme.mjs';
import { fetchLatestVersion } from './update.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, '..');
const MIN_NODE = 18;

function compareSemver(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da !== db) return da - db;
  }
  return 0;
}

function nodeMajor() {
  const m = /^v?(\d+)/.exec(process.version);
  return m ? Number(m[1]) : 0;
}

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', windowsHide: true, timeout: 5000 }).trim();
}

function check(name, ok, detail, { warn = false } = {}) {
  const icon = ok ? fg.green + '✓' : warn ? fg.yellow + '·' : fg.red + '✗';
  const status = ok ? 'ok' : warn ? 'warn' : 'fail';
  return { name, ok, warn, status, line: `  ${icon}${R} ${name.padEnd(14)} ${detail}` };
}

function configWritable() {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.accessSync(CONFIG_DIR, fs.constants.W_OK);
    const probe = path.join(CONFIG_DIR, '.doctor-probe');
    fs.writeFileSync(probe, '');
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

function installLabel() {
  const entry = path.resolve(process.argv[1] || '');
  if (entry.startsWith(PKG_ROOT)) {
    return { global: false, detail: `local dev (${PKG_ROOT})` };
  }
  return { global: true, detail: entry };
}

export async function runDoctor() {
  const checks = [];
  const major = nodeMajor();
  checks.push(check(
    'Node.js',
    major >= MIN_NODE,
    `${process.version} ${major >= MIN_NODE ? `(>= ${MIN_NODE})` : `(need >= ${MIN_NODE})`}`,
  ));

  let npmVersion = null;
  try {
    npmVersion = run('npm -v');
    checks.push(check('npm', true, `v${npmVersion}`));
  } catch {
    checks.push(check('npm', false, 'not found on PATH'));
  }

  const writable = configWritable();
  checks.push(check(
    'Config',
    writable,
    writable ? CONFIG_FILE : `${CONFIG_FILE} (not writable)`,
  ));

  try {
    loadConfig();
    checks.push(check('Config file', true, 'valid JSON'));
  } catch (err) {
    checks.push(check('Config file', false, err.message));
  }

  const mem = getMemoryInfo();
  const memOk = mem.current >= mem.minGb && mem.current <= mem.maxGb;
  checks.push(check(
    'Memory',
    memOk,
    `${mem.current} GB heap (${mem.isCustom ? 'custom' : 'auto'})`,
  ));

  try {
    getSslExpiryInfo();
    checks.push(check('SSL defaults', true, 'loaded'));
  } catch (err) {
    checks.push(check('SSL defaults', false, err.message));
  }

  const install = installLabel();
  checks.push(check(
    'Install',
    true,
    install.detail,
    { warn: !install.global },
  ));

  const tty = process.stdin.isTTY && process.stdout.isTTY;
  checks.push(check(
    'Terminal',
    tty,
    tty ? 'interactive UI available' : 'non-interactive (use subcommands)',
    { warn: !tty },
  ));

  let latest = null;
  if (npmVersion) {
    latest = await fetchLatestVersion();
    if (latest) {
      const upToDate = compareSemver(APP.version, latest) >= 0;
      checks.push(check(
        'Version',
        upToDate,
        upToDate ? `${APP.version} (latest)` : `${APP.version} (latest: ${latest})`,
        { warn: !upToDate },
      ));
    } else {
      checks.push(check('Registry', false, 'could not reach npm', { warn: true }));
    }
  }

  console.log(`\n  ${DIM}${APP.bin} doctor — environment health${R}\n`);
  for (const c of checks) console.log(c.line);

  const failures = checks.filter((c) => !c.ok && !c.warn);
  const warnings = checks.filter((c) => c.warn);

  console.log('');
  if (failures.length === 0) {
    const suffix = warnings.length ? ` (${warnings.length} note${warnings.length === 1 ? '' : 's'})` : '';
    console.log(`  ${fg.green}All checks passed${suffix}.${R}\n`);
    return 0;
  }

  console.log(`  ${fg.red}${failures.length} check${failures.length === 1 ? '' : 's'} failed.${R}\n`);
  return 1;
}
