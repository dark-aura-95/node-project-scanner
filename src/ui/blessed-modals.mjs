import blessed from 'neo-blessed';
import { buildActions } from '../project.mjs';
import { formatBlessedHelp } from './format.mjs';

export function showToast(screen, bar, message, color = 'yellow', ms = 2000) {
  bar.setContent(`{${color}-fg}${message}{/}`);
  screen.render();

  if (showToast._timer) clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    bar.setContent(bar._default || '');
    screen.render();
  }, ms);
}

export function showActionMenu(screen, proj) {
  return new Promise((resolve) => {
    const actions = buildActions(proj);
    if (!actions.length) return resolve(null);

    const menu = blessed.list({
      parent: screen,
      top: 'center',
      left: 'center',
      width: '72%',
      height: Math.min(actions.length + 2, 18),
      border: { type: 'line' },
      label: ' Select Action ',
      tags: true,
      keys: true,
      vi: true,
      mouse: true,
      items: actions.map((a) => `${a.icon} ${a.label}  {gray-fg}${a.cmd}{/}`),
      style: { border: { fg: 'cyan' }, selected: { bg: 'blue', bold: true } },
    });

    const close = (script) => {
      menu.destroy();
      screen.render();
      resolve(script);
    };

    menu.on('select', (_, i) => close(actions[i].script));
    menu.key(['escape', 'q'], () => close(null));
    menu.focus();
    screen.render();
  });
}

export function showHelp(screen) {
  const help = blessed.box({
    parent: screen,
    top: 'center',
    left: 'center',
    width: '72%',
    height: 'shrink',
    border: { type: 'line' },
    label: ' Help ',
    tags: true,
    padding: { top: 1, left: 2, right: 2, bottom: 1 },
    content: formatBlessedHelp(),
    style: { border: { fg: 'cyan' }, bg: 'black' },
  });

  screen.render();
  screen.onceKey(['escape', 'enter', 'q', '?'], () => {
    help.destroy();
    screen.render();
  });
}

export function showPrompt(screen, { label, width = '55%', style = { border: { fg: 'cyan' } } }, message, value) {
  return new Promise((resolve) => {
    const prompt = blessed.prompt({
      parent: screen,
      border: 'line',
      height: 'shrink',
      width,
      top: 'center',
      left: 'center',
      label,
      tags: true,
      keys: true,
      style,
    });

    prompt.input(message, value, (err, answer) => {
      resolve(err ? null : answer);
    });
  });
}
