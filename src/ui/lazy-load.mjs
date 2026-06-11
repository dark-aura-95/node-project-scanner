import { enrichProjectGit, enrichProjectOutdated, enrichProjectMeta } from '../enrich.mjs';
import { refineProject } from '../scanner.mjs';
import { detectPort } from '../port.mjs';
import { detectPkgManagerAndLock } from '../detect.mjs';
import { detectInstallStatus, detectInstallStatusLight } from '../install.mjs';
import { scheduleIdle } from '../async.mjs';

export { scheduleIdle };

export function loadProjectInstallStatus(proj, { full = false } = {}) {
  if (proj._installLoaded && !full) return proj;

  proj.installStatus = full
    ? detectInstallStatus(proj.dir)
    : detectInstallStatusLight(proj.dir);
  proj._installLoaded = true;
  return proj;
}

export function startInstallStatusEnrichment(getProjects, { onUpdate, shouldCancel } = {}) {
  const step = () => {
    if (shouldCancel?.()) return;

    const projects = typeof getProjects === 'function' ? getProjects() : getProjects;
    const proj = projects.find((p) => !p._installLoaded);
    if (!proj) {
      onUpdate?.(null);
      return;
    }

    loadProjectInstallStatus(proj);
    onUpdate?.(proj);
    scheduleIdle(step);
  };

  scheduleIdle(step);
}

export function loadProjectFsMeta(proj) {
  if (proj._fsMetaLoaded) return proj;

  const { pkgMgr, hasLock } = detectPkgManagerAndLock(proj.dir);
  proj.pkgMgr = pkgMgr;
  proj.hasLock = hasLock;
  proj.port = detectPort(proj.dir, proj.scripts);
  proj.installStatus = detectInstallStatus(proj.dir);
  proj._installLoaded = true;

  if (!proj._builderFull && proj.builder === 'Unknown') {
    refineProject(proj);
  }

  proj._fsMetaLoaded = true;
  return proj;
}

export function loadProjectGit(proj) {
  if (proj._gitLoaded) return proj;

  proj.git = enrichProjectGit(proj).git;
  proj._gitLoaded = true;
  return proj;
}

export function loadProjectOutdated(proj, { force = false } = {}) {
  if (proj._outdatedLoaded && !force) return proj;

  proj.stats = enrichProjectOutdated(proj).stats;
  proj._outdatedLoaded = true;
  return proj;
}

export function applyProjectMetaFast(proj) {
  Object.assign(proj, enrichProjectMeta(proj));
  return proj;
}

export function loadProjectDetails(proj, { isCancelled, onFs, onGit, onOutdated, onDone } = {}) {
  scheduleIdle(() => {
    if (isCancelled?.()) return;

    loadProjectFsMeta(proj);
    onFs?.(proj);

    scheduleIdle(() => {
      if (isCancelled?.()) return;

      loadProjectGit(proj);
      onGit?.(proj);

      scheduleIdle(() => {
        if (isCancelled?.()) return;

        loadProjectOutdated(proj);
        onOutdated?.(proj);
        onDone?.(proj);
      });
    });
  });
}
