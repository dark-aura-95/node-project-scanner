import { spawnSync } from 'child_process';
import { APP } from './constants.mjs';
import { fg, R, DIM } from './theme.mjs';

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

export async function fetchLatestVersion() {
  try {
    const result = spawnSync('npm', ['view', APP.name, 'version', '--json'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 15000,
      shell: process.platform === 'win32',
    });
    if (result.status !== 0) return null;
    const raw = (result.stdout || '').trim();
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'string' ? parsed : String(parsed);
    } catch {
      return raw.replace(/^"|"$/g, '');
    }
  } catch {
    return null;
  }
}

export async function runUpdate() {
  console.log(`\n  ${DIM}Checking for ${APP.name} updates…${R}\n`);

  const latest = await fetchLatestVersion();
  if (!latest) {
    console.error(`  ${fg.red}Could not reach npm registry. Check your network and npm login.${R}\n`);
    return 1;
  }

  console.log(`  ${DIM}Current:${R}  ${APP.version}`);
  console.log(`  ${DIM}Latest:${R}   ${latest}\n`);

  if (compareSemver(APP.version, latest) >= 0) {
    console.log(`  ${fg.green}${APP.bin} is up to date (${APP.version}).${R}\n`);
    return 0;
  }

  console.log(`  ${DIM}Installing ${APP.name}@${latest} globally…${R}\n`);

  const install = spawnSync(
    'npm',
    ['install', '-g', `${APP.name}@${latest}`],
    { stdio: 'inherit', shell: process.platform === 'win32' },
  );

  if (install.status === 0) {
    console.log(`\n  ${fg.green}Updated to ${latest}. Run ${APP.bin} --version to verify.${R}\n`);
    return 0;
  }

  console.error(`\n  ${fg.red}Update failed (exit ${install.status ?? 1}). Try: npm install -g ${APP.name}@latest${R}\n`);
  return install.status ?? 1;
}
