import { APP } from '../constants.mjs';
import { formatTime } from '../system.mjs';
import { buildActionMenuRows } from '../project.mjs';
import { msgPortStatusBlessed } from '../messages.mjs';

const SCRIPTS = ['dev', 'build', 'start', 'test', 'lint', 'ci'];

function kv(label, value, valueTag = '') {
  return `{gray-fg}${label.padEnd(14)}{/} ${valueTag || ''}${value}{/}`;
}

function splitBar(deps, devDeps, total, width = 18) {
  if (total <= 0) return `{blue-fg}${'░'.repeat(width)}{/}`;
  const depW = Math.max(1, Math.round((deps / total) * width));
  const devW = Math.max(0, Math.min(width - depW, Math.round((devDeps / total) * width)));
  const rest = width - depW - devW;
  return `{blue-fg}${'█'.repeat(depW)}{/}{magenta-fg}${'█'.repeat(devW)}{/}${'░'.repeat(rest)}`;
}

export function formatTopHeader(_projectCount, lastScanSec) {
  const time = formatTime();
  return (
    `{bold}{green-fg}⚡ ${APP.displayName}{/}{/}  {gray-fg}v${APP.version}{/}` +
    `  {cyan-fg}│{/} {gray-fg}System:{/} {green-fg}OK{/}` +
    `  {cyan-fg}│{/} {gray-fg}🕐 ${time}{/}` +
    `  {cyan-fg}│{/} {gray-fg}Last scan: ${lastScanSec}s ago{/}` +
    `  {cyan-fg}│{/} {gray-fg}[?] Help{/}` +
    `  {cyan-fg}│{/} {gray-fg}[Q] Quit{/}`
  );
}

export function formatLoadingPanel(label = 'Loading…') {
  return `{center}{gray-fg}⏳ ${label}{/}{/center}`;
}

export function formatProjectsListHeader() {
  return '{green-fg}[N] New Project{/}';
}

export function formatProjectListItem(proj, selected = false) {
  const dot = proj.installStatus === 'installed'
    ? '{green-fg}●{/}'
    : proj.installStatus === 'unknown'
      ? '{gray-fg}○{/}'
      : '{yellow-fg}○{/}';

  const name = proj.name.length > 22 ? proj.name.slice(0, 21) + '…' : proj.name;
  const folder = proj.folderName || proj.relDir;
  const sub = `${folder} · v${proj.version}`.slice(0, 28);
  const prefix = selected ? '{cyan-fg}▸ {/}' : '  ';

  return `${prefix}${dot} {bold}${name}{/}\n     {gray-fg}${sub}{/}`;
}

export function formatBasicInfo(proj, _customPort, portStatus) {
  const port = proj.port;
  const loc = proj.relDir === '.' ? proj.dir : proj.relDir;
  const locShort = loc.length > 32 ? '…' + loc.slice(-31) : loc;

  const lines = [
    kv('Name', proj.name),
    kv('Folder', proj.folderName || proj.relDir),
    kv('Framework', proj.builder),
    kv('Package Mgr', proj.pkgMgr),
    kv('Version', `v${proj.version}`),
    kv('Location', locShort),
    kv('Port', `:${port}`, '{cyan-fg}'),
    `{gray-fg}URL:{/}             {cyan-fg}{underline}http://localhost:${port}{/}{/}`,
  ];

  if (portStatus) {
    lines.push(kv('Port Status', msgPortStatusBlessed(portStatus.port, portStatus), ''));
    if (!portStatus.isFree) {
      lines.push(kv('Use Port', `:${portStatus.freePort}`, '{green-fg}'));
      lines.push(
        `{gray-fg}Use URL:{/}         {green-fg}{underline}http://localhost:${portStatus.freePort}{/}{/}`
      );
    }
  }

  lines.push(
    kv('Node Version', proj.nodeVersion || process.version),
    kv('Environment', proj.environment || 'development', '{yellow-fg}'),
    kv(
      'Deps',
      proj.installStatus === 'installed'
        ? 'installed'
        : proj.installStatus === 'unknown'
          ? 'checking…'
          : 'missing',
      proj.installStatus === 'installed' ? '{green-fg}' : '{yellow-fg}'
    ),
  );

  return lines.join('\n');
}

export function formatPackageStatus(proj) {
  const s = proj.stats || {};
  const deps = s.dependencies ?? 0;
  const devDeps = s.devDependencies ?? 0;
  const vuln = s.vulnerabilities ?? 0;
  const total = s.total ?? deps + devDeps;

  return [
    kv('Dependencies', String(deps), '{blue-fg}'),
    kv('Dev Deps', String(devDeps), '{magenta-fg}'),
    kv('Vulnerabilities', String(vuln), vuln > 0 ? '{yellow-fg}' : '{green-fg}'),
    '',
    `{gray-fg}Total Packages:{/} {bold}${total}{/}`,
    splitBar(deps, devDeps, total),
  ].join('\n');
}

export function formatScriptsPanel(proj) {
  const lines = [
    `{gray-fg}${'Status'.padEnd(8)}${'Script'.padEnd(9)}Command{/}`,
    `{gray-fg}${'─'.repeat(36)}{/}`,
  ];

  for (const name of SCRIPTS) {
    const has = name in (proj.scripts || {});
    const icon = has ? '{green-fg}✓{/}' : '{red-fg}✗{/}';
    const cmd = (proj.scripts?.[name] || '—').slice(0, 20);
    lines.push(`${icon}       {bold}${name.padEnd(7)}{/} {gray-fg}${cmd}{/}`);
  }

  return lines.join('\n');
}

export function formatSystemStatus(sys) {
  const heapTag = sys.heapCustom ? '{yellow-fg}custom{/}' : '{green-fg}auto{/}';
  const bracket = (pct) => {
    const w = 10;
    const filled = Math.max(0, Math.min(w, Math.round((pct / 100) * w)));
    return `[${'█'.repeat(filled)}${'─'.repeat(w - filled)}]`;
  };

  return [
    `{gray-fg}CPU Usage{/}     ${bracket(sys.cpuPct)}  {green-fg}${sys.cpuPct}%{/}`,
    `{gray-fg}RAM (device){/}  ${bracket(sys.memPct)}  {green-fg}${sys.memUsed}/${sys.memTotal} GB{/}`,
    `{gray-fg}Disk{/}          ${bracket(sys.diskPct)}  {green-fg}${sys.diskUsed}/${sys.diskTotal} GB{/}`,
    '',
    '{bold}{cyan-fg}NODE HEAP{/}',
    kv('Current', `${sys.heapGb} GB (${sys.heapMb} MB)`, '{green-fg}'),
    kv('Device default', `${sys.heapDefault} GB`, '{gray-fg}'),
    kv('Safe max', `${sys.heapMax} GB`, '{yellow-fg}'),
    kv('Mode', heapTag, ''),
    '',
    `{green-fg}🌿{/} {gray-fg}Env:{/} {green-fg}${sys.environment}{/}  ` +
    `{blue-fg}🕐{/} {gray-fg}Up:{/} {blue-fg}${sys.uptime}{/}  ` +
    `{blue-fg}⊞{/} {gray-fg}${sys.platformArch}{/}  ` +
    `{green-fg}⬢{/} {gray-fg}${sys.node}{/}`,
  ].join('\n');
}

export function formatQuickActionsFooter() {
  return (
    '{bold}{cyan-fg}QUICK ACTIONS{/}  ' +
    '{blue-fg}[I]{/} Install  ' +
    '{magenta-fg}[U]{/} Reinit  ' +
    '{green-fg}[D]{/} Dev  ' +
    '{yellow-fg}[B]{/} Build  ' +
    '{red-fg}[K]{/} Kill Port  ' +
    '{yellow-fg}[M]{/} Memory  ' +
    '{magenta-fg}[S]{/} Scripts  ' +
    '{gray-fg}[R]{/} Rescan  ' +
    '{gray-fg}[/]{/} Search  ' +
    '{gray-fg}[T]{/} Terminal  ' +
    '{gray-fg}[E]{/} Explore  ' +
    '{gray-fg}[?]{/} Help  ' +
    '{red-fg}[Q]{/} Quit'
  );
}

export function formatQuickActionsPanel() {
  return formatQuickActionsFooter();
}

export function formatNavFooter(projectCount) {
  return (
    '{gray-fg}Navigate: ↑/↓  Switch Panel: Tab  Select: Enter  Back: Esc  Expand/Collapse: Space{/}  ' +
    `{right}{green-fg}● Ready{/}  {cyan-fg}${projectCount} projects{/}{/right}`
  );
}

export function formatProjectsLabel(count) {
  return ` PROJECTS [${count}] `;
}

export function formatActionMenuItems(proj) {
  return buildActionMenuRows(proj).map((row) =>
    row.type === 'header'
      ? `{gray-fg}{bold}  ${row.label}{/}{/}`
      : `${row.action.icon} ${row.action.label}  {gray-fg}${row.action.cmd}{/}`
  );
}
