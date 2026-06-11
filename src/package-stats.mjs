import { execSync } from 'child_process';

export function getPackageStats(json) {
  const deps = Object.keys(json.dependencies || {}).length;
  const devDeps = Object.keys(json.devDependencies || {}).length;
  const peer = Object.keys(json.peerDependencies || {}).length;
  const optional = Object.keys(json.optionalDependencies || {}).length;

  return {
    dependencies: deps,
    devDependencies: devDeps,
    peerDependencies: peer,
    optionalDependencies: optional,
    total: deps + devDeps + peer + optional,
    outdated: [],
    outdatedCount: 0,
    vulnerabilities: 0,
  };
}

export function fetchOutdated(dir, pkgMgr, timeout = 4000) {
  try {
    const raw = execSync(`${pkgMgr} outdated --json`, {
      cwd: dir,
      encoding: 'utf8',
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const data = JSON.parse(raw || '{}');
    const outdated = Object.entries(data).slice(0, 6).map(([name, info]) => ({
      name,
      current: info.current || '?',
      latest: info.latest || '?',
    }));
    return { outdated, outdatedCount: Object.keys(data).length };
  } catch (err) {
    if (err.stdout) {
      try {
        const data = JSON.parse(err.stdout);
        const outdated = Object.entries(data).slice(0, 6).map(([name, info]) => ({
          name,
          current: info.current || '?',
          latest: info.latest || '?',
        }));
        return { outdated, outdatedCount: Object.keys(data).length };
      } catch { /* fall through */ }
    }
    return { outdated: [], outdatedCount: 0 };
  }
}
