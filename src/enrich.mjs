import { detectGitInfo } from './git.mjs';
import { fetchOutdated } from './package-stats.mjs';

export function enrichProjectGit(proj) {
  return { git: detectGitInfo(proj.dir) };
}

export function enrichProjectOutdated(proj) {
  if (proj.installStatus !== 'installed') {
    return { stats: { ...proj.stats, outdated: [], outdatedCount: 0 } };
  }

  const out = fetchOutdated(proj.dir, proj.pkgMgr);
  return {
    stats: {
      ...proj.stats,
      outdated: out.outdated,
      outdatedCount: out.outdatedCount,
    },
  };
}

export function enrichProjectMeta(proj) {
  return {
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
  };
}
