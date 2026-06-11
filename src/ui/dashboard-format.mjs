import { APP } from '../constants.mjs';
import { summarizeGit } from '../git.mjs';
import { formatTime } from '../system.mjs';
import { buildActions } from '../project.mjs';

const SCRIPTS = ['dev', 'build', 'start', 'test', 'lint', 'ci'];

function kv(label, value, valueTag = '') {
  return `{gray-fg}${label}:{/} ${valueTag || ''}${value}{/}`;
}

function miniBar(count, total, width = 10) {
  if (total === 0) return '░'.repeat(width);
  const filled = Math.max(1, Math.round((count / total) * width));
  return '{green-fg}' + '█'.repeat(filled) + '{/}' + '░'.repeat(width - filled);
}

export function formatTopHeader(projectCount, lastScanSec) {
  const time = formatTime();
  return (
    `{bold}{green-fg}⚡ ${APP.displayName}{/}{/}  {gray-fg}v${APP.version}{/}  {gray-fg}${APP.tagline}{/}\n` +
    `{cyan-fg}│{/} {gray-fg}Projects:{/} {bold}${projectCount}{/}  ` +
    `{cyan-fg}│{/} {green-fg}●{/} {gray-fg}System:{/} {green-fg}OK{/}  ` +
    `{cyan-fg}│{/} {gray-fg}🕐 ${time}{/}  ` +
    `{cyan-fg}│{/} {gray-fg}↻ Last scan: ${lastScanSec}s ago{/}  ` +
    `{cyan-fg}│{/} {gray-fg}[?] Help{/}  {cyan-fg}│{/} {gray-fg}[q] Quit{/}`
  );
}

export function formatLoadingPanel(label = 'Loading…') {
  return `{center}{gray-fg}⏳ ${label}{/}{/center}`;
}

function formatListTitle(proj) {
  const name = proj.name.length > 18 ? proj.name.slice(0, 17) + '…' : proj.name;
  const folder = (proj.folderName || proj.relDir).length > 14
    ? (proj.folderName || proj.relDir).slice(0, 13) + '…'
    : (proj.folderName || proj.relDir);

  if (folder === proj.name) {
    return `{bold}${name}{/}`;
  }

  return `{bold}${name}{/} {gray-fg}· ${folder}{/}`;
}

export function formatProjectListItem(proj, selected = false) {
  const icon = proj.installStatus === 'installed'
    ? '{green-fg}✓{/}'
    : proj.installStatus === 'unknown'
      ? '{gray-fg}·{/}'
      : '{yellow-fg}○{/}';
  const title = formatListTitle(proj);
  const sel = selected ? '{cyan-fg}▸ {/}' : '  ';

  if (proj._gitLoaded && proj.git) {
    const g = proj.git;
    const sc = g.statusColor || 'gray';
    return (
      `${sel}${icon} ${title} {gray-fg}v${proj.version}{/}\n` +
      `   {gray-fg}${proj.builder} • :${proj.port}{/}  {${sc}-fg}${g.statusLabel}{/}\n` +
      `   {gray-fg}${proj.relDir}{/}`
    );
  }

  return (
    `${sel}${icon} ${title} {gray-fg}v${proj.version}{/}\n` +
    `   {gray-fg}${proj.builder} • :${proj.port} • ${proj.pkgMgr}{/}\n` +
    `   {gray-fg}${proj.relDir}{/}`
  );
}

export function formatProjectSummary(projects, { scanning = false } = {}) {
  if (scanning) {
    return ['{bold}{cyan-fg}PROJECT SUMMARY{/}', '', `{gray-fg}Scanning… ${projects.length} found{/}`].join('\n');
  }

  const installed = projects.filter((p) => p.installStatus === 'installed').length;
  const missing = projects.filter((p) => p.installStatus === 'missing').length;
  const unknown = projects.filter((p) => p.installStatus === 'unknown').length;
  const loaded = projects.filter((p) => p._gitLoaded);

  if (loaded.length === 0) {
    return [
      '{bold}{cyan-fg}PROJECT SUMMARY{/}',
      '',
      `{gray-fg}Projects:{/} {bold}${projects.length}{/}`,
      `{gray-fg}Deps installed:{/} {green-fg}${installed}{/}  {gray-fg}missing:{/} {yellow-fg}${missing}{/}` +
      (unknown ? `  {gray-fg}unchecked:{/} {gray-fg}${unknown}{/}` : ''),
      '',
      '{gray-fg}Select a project for git summary{/}',
    ].join('\n');
  }

  const s = summarizeGit(loaded);
  const total = loaded.length;
  const rows = [
    ['{green-fg}✓ Clean{/}', s.clean],
    ['{yellow-fg}⚠ Modified{/}', s.modified],
    ['{red-fg}● Uncommitted{/}', s.uncommitted],
    ['{cyan-fg}↑ Ahead{/}', s.ahead],
    ['{magenta-fg}↓ Behind{/}', s.behind],
  ];

  const lines = rows.map(([label, n]) =>
    `  ${label}  ${miniBar(n, total)}  {bold}${n}{/}`
  );

  return [
    '{bold}{cyan-fg}PROJECT SUMMARY{/}',
    '',
    ...lines,
    '',
    `{gray-fg}Total Projects: {/}{bold}${total}{/}`,
  ].join('\n');
}

export function formatBasicInfo(proj, customPort) {
  const port = customPort ?? proj.port;
  const loc = proj.relDir === '.' ? proj.dir : proj.relDir;

  return [
    '{bold}{cyan-fg}BASIC INFO{/}',
    '',
    kv('Name', proj.name),
    kv('Folder', proj.folderName || proj.relDir),
    kv('Framework', proj.builder),
    kv('Package Mgr', proj.pkgMgr),
    kv('Version', `v${proj.version}`),
    kv('Location', loc.length > 28 ? '…' + loc.slice(-27) : loc),
    kv('Port', `:${port}`, '{cyan-fg}'),
    kv('URL', `http://localhost:${port}`, '{cyan-fg}'),
    kv('Node Version', proj.nodeVersion || process.version),
    kv('Environment', proj.environment || 'development'),
    kv(
      'Deps',
      proj.installStatus === 'installed'
        ? '{green-fg}installed{/}'
        : proj.installStatus === 'unknown'
          ? '{gray-fg}checking…{/}'
          : '{yellow-fg}missing{/}'
    ),
  ].join('\n');
}

export function formatPackageStatus(proj) {
  const s = proj.stats || {};
  return [
    `{bold}{cyan-fg}PACKAGE STATUS{/} {gray-fg}(${proj.pkgMgr}){/}`,
    '',
    kv('Dependencies', String(s.dependencies ?? 0)),
    kv('Dev Dependencies', String(s.devDependencies ?? 0)),
    kv('Outdated', String(s.outdatedCount ?? 0), s.outdatedCount > 0 ? '{yellow-fg}' : '{green-fg}'),
    kv('Vulnerabilities', String(s.vulnerabilities ?? 0), '{green-fg}'),
    kv('Total Packages', String(s.total ?? 0)),
  ].join('\n');
}

export function formatPackageOutdated(proj) {
  const outdated = proj.stats?.outdated || [];
  const lines = [
    '{bold}{cyan-fg}PACKAGE OUTDATED{/}',
    '',
    `{gray-fg}${'Package'.padEnd(14)} Current   Latest{/}`,
    `{gray-fg}${'─'.repeat(32)}{/}`,
  ];

  if (outdated.length === 0) {
    lines.push('', '{green-fg}All packages up to date{/}');
  } else {
    for (const p of outdated) {
      lines.push(
        `${p.name.padEnd(14)} {gray-fg}${p.current}{/}  {yellow-fg}${p.latest}{/}`
      );
    }
  }

  lines.push('', `{cyan-fg}Run: ${proj.pkgMgr} outdated{/}`);
  return lines.join('\n');
}

export function formatGitStatus(proj) {
  const g = proj.git || {};
  const clean = g.status === 'clean';

  return [
    '{bold}{cyan-fg}GIT STATUS{/}',
    '',
    kv('Branch', g.branch || '—', '{green-fg}'),
    kv('Status', clean ? '{green-fg}● Clean working tree{/}' : `{${g.statusColor}-fg}● ${g.statusLabel}{/}`),
    kv('Modified', String(g.modified ?? 0)),
    kv('Staged', String(g.staged ?? 0)),
    kv('Untracked', String(g.untracked ?? 0)),
    kv('Ahead / Behind', `${g.ahead ?? 0} / ${g.behind ?? 0}`),
    '',
    `{gray-fg}Last Commit:{/}`,
    `  {green-fg}${g.lastHash}{/} ${g.lastMessage}`,
    `  {gray-fg}${g.lastWhen}{/}`,
    kv('Remote', g.remote || '—'),
  ].join('\n');
}

export function formatGitFileStatus(proj) {
  const g = proj.git || {};
  const total = (g.modified || 0) + (g.staged || 0) + (g.untracked || 0);

  if (!g.isRepo) {
    return [
      '{bold}{cyan-fg}GIT FILE STATUS{/}',
      '',
      '{center}{gray-fg}Not a git repository{/}{/center}',
    ].join('\n');
  }

  if (total === 0) {
    return [
      '{bold}{cyan-fg}GIT FILE STATUS{/}',
      '',
      '{center}{green-fg}✓{/}{/center}',
      '{center}{green-fg}Working tree clean{/}{/center}',
      '{center}{gray-fg}No changes to commit{/}{/center}',
    ].join('\n');
  }

  return [
    '{bold}{cyan-fg}GIT FILE STATUS{/}',
    '',
    `{center}{${g.statusColor}-fg}● ${total} file${total > 1 ? 's' : ''} changed{/}{/center}`,
    `{center}{gray-fg}Modified: ${g.modified}  Staged: ${g.staged}{/}{/center}`,
    `{center}{gray-fg}Untracked: ${g.untracked}{/}{/center}`,
  ].join('\n');
}

export function formatRecentCommits(proj) {
  const commits = proj.git?.commits || [];
  const lines = [
    '{bold}{cyan-fg}RECENT COMMITS{/}',
    '',
  ];

  if (commits.length === 0) {
    lines.push('{gray-fg}No commits found{/}');
  } else {
    for (const c of commits) {
      lines.push(`{green-fg}${c.hash}{/} ${c.message}`);
      lines.push(`  {gray-fg}${c.when}{/}`);
    }
  }

  return lines.join('\n');
}

export function formatScriptsPanel(proj) {
  const lines = [
    '{bold}{cyan-fg}SCRIPTS{/}',
    '',
  ];

  for (const name of SCRIPTS) {
    const has = name in (proj.scripts || {});
    const icon = has ? '{green-fg}✓{/}' : '{red-fg}✗{/}';
    const cmd = (proj.scripts?.[name] || '—').slice(0, 22);
    lines.push(`  ${icon} {bold}${name.padEnd(7)}{/} {gray-fg}${cmd}{/}`);
  }

  return lines.join('\n');
}

export function formatSystemStatus(sys) {
  const heapTag = sys.heapCustom ? '{yellow-fg}custom{/}' : '{green-fg}auto{/}';
  return [
    '{bold}{cyan-fg}SYSTEM STATUS{/}',
    '',
    `{gray-fg}CPU Usage{/}     ${sys.cpuBar}  {green-fg}${sys.cpuPct}%{/}`,
    `{gray-fg}RAM (device){/}  ${sys.memBar}  {green-fg}${sys.memUsed}/${sys.memTotal} GB{/}`,
    `{gray-fg}Disk{/}          ${sys.diskBar}  {green-fg}${sys.diskUsed}/${sys.diskTotal} GB{/}`,
    '',
    '{bold}{cyan-fg}NODE HEAP{/}',
    kv('Current', `${sys.heapGb} GB (${sys.heapMb} MB)`, '{cyan-fg}'),
    kv('Device default', `${sys.heapDefault} GB`, '{green-fg}'),
    kv('Safe max', `${sys.heapMax} GB`, '{yellow-fg}'),
    kv('Mode', heapTag),
  ].join('\n');
}

export function formatQuickActionsFooter() {
  return (
    '{bold}{cyan-fg}QUICK ACTIONS{/}  ' +
    '{blue-fg}[I]{/} Install  ' +
    '{green-fg}[D]{/} Dev  ' +
    '{yellow-fg}[B]{/} Build  ' +
    '{magenta-fg}[G]{/} Git  ' +
    '{cyan-fg}[P]{/} Port  ' +
    '{red-fg}[K]{/} Kill Port  ' +
    '{yellow-fg}[M]{/} Memory  {gray-fg}[U]{/} Refresh  ' +
    '{blue-fg}[O]{/} Scripts  ' +
    '{gray-fg}[R]{/} Rescan  ' +
    '{gray-fg}[/]{/} Search  ' +
    '{gray-fg}[T]{/} Terminal  ' +
    '{gray-fg}[E]{/} Explore  ' +
    '{gray-fg}[?]{/} Help  ' +
    '{red-fg}[Q]{/} Quit'
  );
}

export function formatNavFooter() {
  return (
    '{gray-fg}↑/↓ Navigate{/}  ' +
    '{gray-fg}←/→ Move Between Panels{/}  ' +
    '{gray-fg}Enter Select{/}  ' +
    '{gray-fg}Space Expand/Collapse{/}  ' +
    '{gray-fg}R Rescan{/}  ' +
    '{gray-fg}Q Quit{/}  ' +
    '{right}{green-fg}⚡ Ready{/}  {cyan-fg}{/}{/right}'
  );
}

export function formatDetailTitle(proj) {
  return ` PROJECT DETAIL: ${proj.name} `;
}

export function formatProjectsLabel(count) {
  return ` PROJECTS [${count}] `;
}

export function formatActionMenuItems(proj) {
  return buildActions(proj).map((a) => `${a.icon} ${a.label}  {gray-fg}${a.cmd}{/}`);
}
