import { findFreePort, isPortFree, askPort } from '../port.mjs';
import { launchProject } from '../runner.mjs';
import { needsPort, actionLabel } from '../project.mjs';
import { msgPortStatus, msgPortBusy } from '../messages.mjs';
import { fg, R, B, DIM } from '../theme.mjs';

const write = (s) => process.stdout.write(s);

export async function promptPort(proj, currentPort) {
  const detected = currentPort ?? proj.port;
  const free = await findFreePort(detected);

  write(`\n  ${B}${fg.bcyan}⚙ Port Setup${R}  ${DIM}(${actionLabel('dev')} / start)${R}\n`);
  write(`  ${DIM}Project:${R} ${proj.name}  ${DIM}URL:${R} ${fg.cyan}http://localhost:${detected}${R}\n`);
  write(`  ${msgPortStatus(detected, free)}\n`);

  let port = await askPort(detected, free);

  if (!(await isPortFree(port))) {
    const bumped = await findFreePort(port);
    write(`  ${msgPortBusy(port, bumped)}\n`);
    port = bumped;
  }

  return port;
}

export async function executeAction(proj, script, { customPort, memoryGb, onBeforeLaunch, fromTui = false } = {}) {
  if (onBeforeLaunch) await onBeforeLaunch();

  return launchProject(proj, script, {
    port: customPort,
    memoryGb,
    interactive: !fromTui && customPort == null && needsPort(script),
  });
}
