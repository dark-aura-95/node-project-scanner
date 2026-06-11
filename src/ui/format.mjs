import { APP, COLS, SHORTCUTS, plural } from '../constants.mjs';
import { builderInfo, pmColors, B, R, DIM, fg, bg, W } from '../theme.mjs';
import { padEnd } from '../utils.mjs';
import {
  scriptFlagsAnsi,
  scriptFlagsBlessed,
  scriptStatusAnsi,
  scriptStatusBlessed,
  installStatusAnsi,
  installStatusBlessed,
  installFlagAnsi,
  installFlagBlessed,
  buildActions,
} from '../project.mjs';

const DIVIDER = '─────────────────────────────────';
const BOX_WIDTH = 41;

export function formatAnsiHeader(rootDir, projectCount) {
  const line = '═'.repeat(Math.min(W() - 4, 60));

  return [
    '',
    `  ${fg.cyan}${line}${R}`,
    `  ${B}${fg.bcyan}  ⚡ ${APP.displayName}${R}  ${DIM}${APP.bin} v${APP.version}${R}`,
    `  ${DIM}${APP.tagline}${R}`,
    `  ${fg.cyan}${line}${R}`,
    `  ${DIM}📁 ${rootDir}${R}`,
    projectCount != null ? `  ${DIM}Found ${fg.bcyan}${projectCount}${R}${DIM} project${projectCount === 1 ? '' : 's'}${R}` : '',
    '',
  ].filter(Boolean).join('\n');
}

export function formatBlessedHeader(rootDir, count, { total, searchQuery = '' } = {}) {
  const filterNote = searchQuery ? `  {yellow-fg}🔍 "${searchQuery}"{/}` : '';
  const countNote = searchQuery && total != null ? `${count}/${total}` : `${count}`;
  const suffix = searchQuery ? 'shown' : 'found';

  return (
    `{bold}{cyan-fg}⚡ ${APP.displayName}{/}{/}  {gray-fg}${APP.bin} v${APP.version}{/}\n` +
    `{gray-fg}${APP.tagline}{/}\n` +
    `{gray-fg}📁 ${rootDir}{/}${filterNote}\n` +
    `{green-fg}${countNote}{/} project${count === 1 ? '' : 's'} ${suffix}`
  );
}

export function formatAnsiColumnHeaders() {
  const { name, path } = COLS;
  return [
    `  ${DIM}${fg.gray}     ${'NAME'.padEnd(name)} ${'PATH'.padEnd(path)} BUILDER      PKG   PORT  DEP DSB${R}`,
    `  ${DIM}${fg.gray}     ${'─'.repeat(name)} ${'─'.repeat(path)} ${'─'.repeat(12)} ${'─'.repeat(5)} ${'─'.repeat(6)} ${'─'.repeat(3)} ${'─'.repeat(3)}${R}`,
    `  ${DIM}${fg.gray}     ${SHORTCUTS.scriptLegend}${R}`,
  ].join('\n') + '\n';
}

export function renderAnsiProjectRow(proj, selected) {
  const info = builderInfo(proj.builder);
  const { name: nameCol, path: pathCol } = COLS;
  const badgeStr = `${B}${info.badge} ${proj.builder} ${R}`;
  const pmColor = pmColors[proj.pkgMgr] || fg.gray;
  const pmStr = `${DIM}${pmColor}${proj.pkgMgr}${R}`;
  const folder = proj.folderName || proj.relDir;
  const nameLabel = folder !== proj.name ? `${proj.name} (${folder})` : proj.name;
  const nameStr = `${B}${info.color}${nameLabel}${R}`;
  const dirStr = `${DIM}${fg.gray}${proj.relDir}${R}`;
  const portStr = `${fg.cyan}:${proj.port}${R}`;
  const dep = installFlagAnsi(proj);
  const flags = scriptFlagsAnsi(proj);

  if (selected) {
    const line =
      `  ${bg.bblue}${fg.bwhite}${B} ❯ ${padEnd(nameStr, nameCol)} ${padEnd(dirStr, pathCol)} ${badgeStr}  ${pmStr}  ${portStr}  ${dep}  ${flags} ${R}`;
    return padEnd(line, W());
  }
  return `  ${fg.gray}   ${R}${padEnd(nameStr, nameCol)} ${padEnd(dirStr, pathCol)} ${badgeStr}  ${pmStr}  ${portStr}  ${dep}  ${flags}`;
}

export function renderAnsiActionRow(action, selected) {
  const color = action.direct ? fg.byellow : action.script === 'build' ? fg.bblue : fg.bgreen;
  const label = `${action.icon}  ${action.label}`;

  if (selected) {
    return `  ${bg.gray}${fg.bwhite}${B} ❯  ${label}  ${DIM}${action.cmd}${R} ${R}`;
  }
  return `  ${fg.gray}     ${R}${color}${label}${R}  ${DIM}${fg.gray}${action.cmd}${R}`;
}

export function formatAnsiDetails(proj, customPort) {
  const info = builderInfo(proj.builder);
  const port = customPort ?? proj.port;
  const pmColor = pmColors[proj.pkgMgr] || fg.gray;
  const box = '─'.repeat(BOX_WIDTH);

  return [
    '',
    `  ${fg.gray}┌${box}┐${R}`,
    `  ${fg.gray}│${R} ${B}${info.icon} ${proj.name}${R}`,
    `  ${fg.gray}│${R} ${DIM}Version${R}    ${proj.version}`,
    `  ${fg.gray}│${R} ${DIM}Framework${R}  ${proj.builder}`,
    `  ${fg.gray}│${R} ${DIM}Manager${R}    ${pmColor}${proj.pkgMgr}${R}`,
    `  ${fg.gray}│${R} ${DIM}Deps${R}       ${installStatusAnsi(proj.installStatus)}`,
    `  ${fg.gray}│${R} ${DIM}Path${R}       ${proj.relDir}`,
    `  ${fg.gray}│${R} ${DIM}Port${R}       ${fg.cyan}${port}${R}${customPort ? ` ${fg.yellow}(custom)${R}` : ''}`,
    `  ${fg.gray}│${R} ${DIM}URL${R}        ${fg.cyan}http://localhost:${port}${R}`,
    `  ${fg.gray}│${R} ${DIM}Scripts${R}    ${scriptStatusAnsi(proj)}`,
    `  ${fg.gray}└${box}┘${R}`,
    '',
  ].join('\n');
}

export function formatBlessedDetails(proj, customPort) {
  const info = builderInfo(proj.builder);
  const port = customPort ?? proj.port;
  const actions = buildActions(proj).slice(0, 8);

  return [
    `{center}{bold}{cyan-fg}${info.icon} ${proj.name}{/}{/bold}{/center}`,
    `{center}{gray-fg}v${proj.version}{/}{/center}`,
    '',
    `{gray-fg}${DIVIDER}{/}`,
    '',
    `  {gray-fg}Framework{/}  {bold}${proj.builder}{/}`,
    `  {gray-fg}Manager{/}    ${proj.pkgMgr}`,
    `  {gray-fg}Deps{/}       ${installStatusBlessed(proj.installStatus)}`,
    `  {gray-fg}Location{/}   ${proj.relDir}`,
    `  {gray-fg}Port{/}       {cyan-fg}${port}{/}${customPort ? ' {yellow-fg}(custom){/}' : ''}`,
    `  {gray-fg}URL{/}        {cyan-fg}{underline}http://localhost:${port}{/}{/}`,
    '',
    `  {gray-fg}Scripts{/}   ${scriptStatusBlessed(proj)}`,
    '',
    `{gray-fg}${DIVIDER}{/}`,
    '',
    '{bold}Quick Actions{/}',
    '',
    ...(actions.length === 0
      ? ['  {yellow-fg}No actions available{/}']
      : actions.map((a) => `  ${a.icon} {bold}${a.label}{/}  {gray-fg}${a.cmd}{/}`)),
    '',
    `{gray-fg}${DIVIDER}{/}`,
    '',
    '  {bold}I{/} Install  {bold}C{/} CI  {bold}O{/} More  {bold}D{/} Dev  {bold}B{/} Build',
    '  {bold}Enter{/} Actions  {bold}P{/} Port preset  {bold}?{/} Help   {bold}Q{/} Quit',
  ].join('\n');
}

export function formatBlessedHelp() {
  return [
    `{center}{bold}{cyan-fg}Keyboard Shortcuts{/}{/center}`,
    '',
    '{bold}Navigation{/}',
    '  ↑ ↓        Move through projects',
    '  Enter      Open actions menu',
    '  /          Search / filter projects',
    '  Esc        Clear search filter',
    '',
    '{bold}Actions{/}',
    '  I          Install dependencies',
    '  C          CI install (frozen lockfile)',
    '  D          Run dev server',
    '  S          Run start script',
    '  B          Run build',
    '  T          Run test',
    '  L          Run lint',
    '  O          More actions menu',
    '  P          Set custom port',
    '  K          Kill process on project port',
    '  M          Set Node memory (GB)',
    '  R          Rescan directory',
    '',
    '{bold}Other{/}',
    '  ?          Show this help',
    '  Q / Ctrl+C Quit',
    '',
    '{gray-fg}Press any key to close{/}',
  ].join('\n');
}

export function formatBlessedProjectItem(proj) {
  const info = builderInfo(proj.builder);
  const dep = installFlagBlessed(proj);
  const flags = scriptFlagsBlessed(proj);
  return `${dep} ${info.icon} {bold}${proj.name}{/}  {gray-fg}v${proj.version}{/}  {gray-fg}${proj.relDir}{/}  {cyan-fg}:${proj.port}{/}  ${proj.builder}  ${flags}`;
}

export function formatBlessedEmpty(searchQuery) {
  if (searchQuery) {
    return [
      '{center}{yellow-fg}No projects match your filter{/}{/center}',
      '',
      '{center}{gray-fg}Try a different search — press {bold}Esc{/} to clear{/}{/center}',
    ].join('\n');
  }
  return [
    '{center}{yellow-fg}No projects found{/}{/center}',
    '',
    '{center}{gray-fg}No package.json projects in this directory{/}{/center}',
    '{center}{gray-fg}Press {bold}R{/} to rescan{/}{/center}',
  ].join('\n');
}

export function printProjectTable(projects, rootDir = '.') {
  process.stdout.write(formatAnsiHeader(rootDir, projects.length));
  process.stdout.write(formatAnsiColumnHeaders());
  for (const proj of projects) {
    process.stdout.write(renderAnsiProjectRow(proj, false) + '\n');
  }
  process.stdout.write('\n');
}

export function formatStepLabel(step, total, text) {
  return `  ${DIM}${fg.gray}Step ${step}/${total}${R}  ${B}${text}${R}\n\n`;
}

export function formatFoundToast(count) {
  return `✓ ${plural(count, 'project')} found`;
}
