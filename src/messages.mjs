import { APP } from './constants.mjs';
import { fg, R, DIM, B } from './theme.mjs';

export const MSG = {
  empty: `⚠ No projects found`,
  emptyTips: [
    'Point nps at a folder with package.json files',
    'Use --exclude to skip unwanted directories',
  ],
  noScripts: '⚠ No runnable scripts found',
  goodbye: 'Goodbye!',
  cancelled: 'Cancelled',
  scanning: 'Scanning...',
  projectNotFound: (name) => `Project not found: ${name}`,
  noScript: (script) => `Project has no "${script}" script`,
  selectFirst: 'Select a project first',
  noScriptFor: (script, name) => `✗ No "${script}" script in ${name}`,
};

export function msgFound(count) {
  return `Found ${count} project${count === 1 ? '' : 's'}`;
}

export function msgFoundAnsi(count) {
  return `  ${DIM}Found ${fg.bcyan}${count}${R}${DIM} project${count === 1 ? '' : 's'}${R}`;
}

export function msgFoundHighlight(count) {
  return `\n  ${fg.bcyan}${msgFound(count)}${R}\n`;
}

export function msgEmpty() {
  return `\n  ${fg.yellow}${MSG.empty}${R}\n`;
}

export function msgEmptyWithTips() {
  const lines = [msgEmpty()];
  lines.push(`  ${DIM}${fg.gray}Tips:${R}\n`);
  for (const tip of MSG.emptyTips) {
    lines.push(`  ${DIM}  • ${tip}${R}\n`);
  }
  lines.push('\n');
  return lines.join('');
}

export function msgNonInteractiveTip() {
  return [
    `  ${fg.gray}Run in a terminal for interactive picker, or use:${R}`,
    `  ${fg.gray}  ${APP.bin} run <project>   ${APP.bin} build <project>${R}\n`,
  ].join('\n');
}

export function msgPortStatus(detected, free) {
  if (free === detected) {
    return `${fg.bgreen}✓ port ${detected} is available${R}`;
  }
  return `${fg.yellow}⚠ port ${detected} is in use${R}  ${fg.bgreen}→ next free: ${free}${R}`;
}

export function msgPortStatusBlessed(port, { isFree, freePort }) {
  if (isFree) {
    return `{green-fg}✓ port ${port} is available{/}`;
  }
  return `{yellow-fg}⚠ port ${port} is in use{/}  {green-fg}→ use :${freePort}{/}`;
}

export function msgPortBusy(port, bumped) {
  return `${fg.yellow}Port ${port} is in use — using ${bumped}${R}`;
}

export function msgPortAlreadyFree(port) {
  return `${fg.green}✓ port ${port} is already free${R}`;
}

export function msgPortKilled(port, pids) {
  return `${fg.green}✓ killed PID ${pids.join(', ')} on port ${port}${R}`;
}

export function msgPortKillFailed(port) {
  return `${fg.yellow}⚠ could not free port ${port}${R}`;
}

export function msgPortKillNotFound(port) {
  return `${fg.yellow}⚠ no listening process found on port ${port}${R}`;
}
