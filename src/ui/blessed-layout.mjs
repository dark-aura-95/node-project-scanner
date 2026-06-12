import blessed from 'neo-blessed';
import { APP } from '../constants.mjs';

const PANEL_STYLE = {
  border: { type: 'line' },
  tags: true,
  padding: { left: 1, right: 1, top: 0, bottom: 0 },
  style: { border: { fg: 'cyan' }, fg: 'white', bg: 'black' },
  scrollable: true,
  alwaysScroll: true,
};

export function createBlessedScreen() {
  return blessed.screen({
    smartCSR: true,
    title: `${APP.displayName} v${APP.version}`,
    fullUnicode: true,
    terminal: process.env.TERM || 'xterm-256color',
    style: { bg: 'black' },
  });
}

export function createDashboardLayout(screen) {
  const header = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: 3,
    tags: true,
    padding: { left: 1, right: 1 },
    style: { fg: 'white', bg: 'black' },
  });

  const projectHeader = blessed.box({
    top: 3,
    left: 0,
    width: '26%',
    height: 1,
    tags: true,
    content: '',
    style: { fg: 'white', bg: 'black' },
    padding: { left: 2 },
  });

  const projectList = blessed.list({
    top: 4,
    left: 0,
    width: '26%',
    height: '100%-6',
    label: ' PROJECTS ',
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    scrollbar: { ch: '▓', style: { bg: 'cyan' } },
    style: {
      border: { fg: 'cyan' },
      bg: 'black',
      selected: { bg: 'blue', fg: 'white', bold: true },
      item: { fg: 'white', bg: 'black' },
    },
    padding: { left: 1, top: 0 },
  });

  const panels = {
    basic: blessed.box({
      top: 3,
      left: '26%',
      width: '37%',
      height: '50%',
      ...PANEL_STYLE,
      label: ' BASIC INFO ',
    }),
    pkg: blessed.box({
      top: 3,
      left: '63%',
      width: '37%',
      height: '50%',
      ...PANEL_STYLE,
      label: ' PACKAGE STATUS ',
    }),
    scripts: blessed.box({
      top: '50%',
      left: '26%',
      width: '37%',
      height: '50%-3',
      ...PANEL_STYLE,
      label: ' SCRIPTS ',
    }),
    system: blessed.box({
      top: '50%',
      left: '63%',
      width: '37%',
      height: '50%-3',
      ...PANEL_STYLE,
      label: ' SYSTEM STATUS ',
    }),
  };

  const quickFooter = blessed.box({
    bottom: 2,
    left: 0,
    width: '100%',
    height: 2,
    tags: true,
    padding: { left: 1 },
    style: { fg: 'white', bg: 'black' },
  });

  const navFooter = blessed.box({
    bottom: 0,
    left: 0,
    width: '100%',
    height: 2,
    tags: true,
    padding: { left: 1, right: 1 },
    style: { fg: 'gray', bg: 'black' },
  });

  for (const widget of [header, projectHeader, projectList, ...Object.values(panels), quickFooter, navFooter]) {
    screen.append(widget);
  }

  return { header, projectHeader, projectList, panels, quickFooter, navFooter };
}
