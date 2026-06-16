import { spawn } from 'child_process';

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

export function getOpenFolderPlan(dir) {
  if (process.platform === 'win32') {
    return [{ cmd: 'explorer', args: [dir] }];
  }
  if (process.platform === 'darwin') {
    return [{ cmd: 'open', args: [dir] }];
  }
  return [{ cmd: 'xdg-open', args: [dir] }];
}

export function getOpenTerminalPlans(dir) {
  if (process.platform === 'win32') {
    const winDir = String(dir).replace(/"/g, '""');
    return [{ cmd: 'cmd', args: ['/c', 'start', 'cmd', '/k', `cd /d "${winDir}"`], shell: true }];
  }

  if (process.platform === 'darwin') {
    const escaped = String(dir).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return [{
      cmd: 'osascript',
      args: ['-e', `tell application "Terminal" to do script "cd \\"${escaped}\\" && clear"`],
    }];
  }

  const cwd = String(dir);
  const bashSession = {
    cmd: 'bash',
    args: ['-lc', `cd ${shellQuote(cwd)} && exec bash`],
  };

  return [
    { cmd: 'gnome-terminal', args: [`--working-directory=${cwd}`] },
    { cmd: 'konsole', args: ['--workdir', cwd] },
    { cmd: 'xfce4-terminal', args: ['--working-directory', cwd] },
    { cmd: 'kgx', args: [`--working-directory=${cwd}`] },
    { cmd: 'wt', args: ['-d', cwd] },
    { cmd: 'x-terminal-emulator', args: ['-e', bashSession.args[0], ...bashSession.args.slice(1)] },
    { cmd: 'xterm', args: ['-e', bashSession.args[0], ...bashSession.args.slice(1)] },
    bashSession,
  ];
}

function spawnDetached(plans, index = 0) {
  if (index >= plans.length) return false;

  const { cmd, args, shell = false } = plans[index];
  const child = spawn(cmd, args, { detached: true, stdio: 'ignore', shell });

  child.on('error', () => {
    spawnDetached(plans, index + 1);
  });

  child.unref();
  return true;
}

export function openFolder(dir) {
  spawnDetached(getOpenFolderPlan(dir));
}

export function openTerminal(dir) {
  spawnDetached(getOpenTerminalPlans(dir));
}
