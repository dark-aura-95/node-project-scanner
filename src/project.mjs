import { fg, R } from './theme.mjs';
import { getCiLabel, getInstallLabel } from './install.mjs';
import { getReinitLabel } from './reinit.mjs';

export const ACTION = {
  INSTALL: '__install__',
  CI: '__ci__',
  REINIT: '__reinit__',
};

export const PORT_SCRIPTS = new Set(['dev', 'start']);

const SCRIPT_KEYS = ['dev', 'start', 'build', 'test', 'lint', 'ci'];

export function parseScriptMeta(scripts = {}) {
  const meta = { scripts };

  for (const key of SCRIPT_KEYS) {
    const hasKey = `has${key.charAt(0).toUpperCase()}${key.slice(1)}`;
    const cmdKey = `${key}Cmd`;
    meta[hasKey] = key in scripts;
    meta[cmdKey] = scripts[key] || '';
  }

  return meta;
}

export function isRunnableProject({ hasDev, hasStart, hasBuild, builder }) {
  return hasDev || hasStart || hasBuild || builder !== 'Unknown';
}

const RUN_PRIORITY = ['dev', 'start', 'build'];
const EXTRA_PRIORITY = ['ci', 'test', 'lint', 'preview', 'format', 'typecheck', 'check'];

export const ACTION_GROUP_LABELS = {
  run: 'Run',
  deps: 'Package',
  tooling: 'Tooling',
  other: 'Scripts',
};

export function hasScript(proj, script) {
  if (script === ACTION.INSTALL) return true;
  if (script === ACTION.REINIT) return true;
  if (script === ACTION.CI) return proj.hasLock || proj.hasCiScript;
  const key = `has${script.charAt(0).toUpperCase()}${script.slice(1)}`;
  return Boolean(proj[key]) || script in (proj.scripts || {});
}

export function canRunAction(proj, script) {
  return hasScript(proj, script);
}

export function getDefaultScript(proj) {
  if (proj.hasDev) return 'dev';
  if (proj.hasStart) return 'start';
  if (proj.hasBuild) return 'build';
  if (proj.installStatus === 'missing') return ACTION.INSTALL;
  return null;
}

export function needsPort(script) {
  return PORT_SCRIPTS.has(script);
}

export function isDirectAction(script) {
  return script === ACTION.INSTALL || script === ACTION.CI || script === ACTION.REINIT;
}

export function actionLabel(script) {
  if (script === ACTION.INSTALL) return 'install';
  if (script === ACTION.REINIT) return 'reinit';
  if (script === ACTION.CI) return 'ci';
  return script;
}

export function actionIcon(script) {
  if (script === ACTION.INSTALL) return '📦';
  if (script === ACTION.REINIT) return '🔄';
  if (script === ACTION.CI) return '🔒';
  if (script === 'build') return '■';
  if (script === 'test' || script === 'lint') return '◆';
  return '▶';
}

export function actionCmd(proj, script) {
  if (script === ACTION.INSTALL) return getInstallLabel(proj.pkgMgr);
  if (script === ACTION.REINIT) return getReinitLabel(proj.pkgMgr);
  if (script === ACTION.CI) {
    return proj.hasLock ? getCiLabel(proj.pkgMgr) : proj.ciCmd;
  }
  return proj.scripts?.[script] || proj[`${script}Cmd`] || '';
}

export function buildActions(proj) {
  const actions = [];
  const seen = new Set();

  const add = (script, group) => {
    if (seen.has(script) || !canRunAction(proj, script)) return;
    seen.add(script);
    actions.push({
      script,
      group,
      label: actionLabel(script),
      icon: actionIcon(script),
      cmd: actionCmd(proj, script),
      needsPort: needsPort(script),
      direct: isDirectAction(script),
    });
  };

  for (const s of RUN_PRIORITY) add(s, 'run');

  add(ACTION.INSTALL, 'deps');
  add(ACTION.REINIT, 'deps');
  if (proj.hasLock) add(ACTION.CI, 'deps');

  for (const s of EXTRA_PRIORITY) add(s, 'tooling');

  for (const name of Object.keys(proj.scripts || {})) {
    if (!seen.has(name)) add(name, 'other');
  }

  return actions;
}

export function buildActionMenuRows(proj) {
  const actions = buildActions(proj);
  const rows = [];
  let lastGroup = null;

  for (const action of actions) {
    if (action.group !== lastGroup) {
      lastGroup = action.group;
      rows.push({
        type: 'header',
        label: ACTION_GROUP_LABELS[action.group] || action.group,
      });
    }
    rows.push({ type: 'action', action });
  }

  return rows;
}

export function installStatusAnsi(status) {
  if (status === 'installed') return `${fg.bgreen}✓ installed${R}`;
  return `${fg.yellow}✗ missing${R}`;
}

export function installStatusBlessed(status) {
  if (status === 'installed') return '{green-fg}✓ installed{/}';
  return '{yellow-fg}✗ not installed{/}';
}

export function installFlagAnsi(proj) {
  return proj.installStatus === 'installed' ? `${fg.bgreen}✓${R}` : `${fg.yellow}○${R}`;
}

export function installFlagBlessed(proj) {
  return proj.installStatus === 'installed' ? '{green-fg}✓{/}' : '{yellow-fg}○{/}';
}

export function scriptFlagsAnsi(proj) {
  const dot = (ok, label) => (ok ? `${fg.bgreen}${label}${R}` : `${fg.gray}·${R}`);
  return [dot(proj.hasDev, 'D'), dot(proj.hasStart, 'S'), dot(proj.hasBuild, 'B')].join('');
}

export function scriptFlagsBlessed(proj) {
  const flag = (ok, label, color) => (ok ? `{${color}-fg}${label}{/}` : '');
  return [
    flag(proj.hasDev, 'D', 'green'),
    flag(proj.hasStart, 'S', 'green'),
    flag(proj.hasBuild, 'B', 'blue'),
  ].filter(Boolean).join('');
}

export function scriptStatusBlessed(proj) {
  const chip = (ok, label) => (ok ? `{green-fg}✓ ${label}{/}` : `{gray-fg}○ ${label}{/}`);
  return [
    chip(proj.hasDev, 'dev'),
    chip(proj.hasStart, 'start'),
    chip(proj.hasBuild, 'build'),
    chip(proj.hasTest, 'test'),
    chip(proj.hasLint, 'lint'),
    chip(proj.hasCiScript, 'ci'),
  ].join('  ');
}

export function scriptStatusAnsi(proj) {
  const chip = (ok, label) => (ok ? `${fg.bgreen}✓ ${label}${R}` : `${fg.gray}○ ${label}${R}`);
  return [
    chip(proj.hasDev, 'dev'),
    chip(proj.hasStart, 'start'),
    chip(proj.hasBuild, 'build'),
    chip(proj.hasTest, 'test'),
    chip(proj.hasLint, 'lint'),
    chip(proj.hasCiScript, 'ci'),
  ].join('  ');
}
