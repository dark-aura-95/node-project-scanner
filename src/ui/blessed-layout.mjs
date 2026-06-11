import blessed from 'neo-blessed';
import { APP } from '../constants.mjs';

const PANEL_STYLE = {
  border: { type: 'line' },
  tags: true,
  padding: { left: 1, right: 1, top: 0, bottom: 0 },
  style: { border: { fg: 'cyan' }, fg: 'white' },
  scrollable: true,
  alwaysScroll: true,
};

export function createBlessedScreen() {
  return blessed.screen({
    smartCSR: true,
    title: `${APP.displayName} v${APP.version}`,
    fullUnicode: true,
    terminal: process.env.TERM || 'xterm-256color',
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

  const projectList = blessed.list({
    top: 3,
    left: 0,
    width: '32%',
    height: '48%',
    label: ' PROJECTS ',
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    scrollbar: { ch: '▓', style: { bg: 'cyan' } },
    style: {
      border: { fg: 'cyan' },
      selected: { bg: 'blue', fg: 'white', bold: true },
      item: { fg: 'white' },
    },
    padding: { left: 1, top: 0 },
  });

  const summaryBox = blessed.box({
    top: '51%',
    left: 0,
    width: '32%',
    height: '100%-51%-4',
    ...PANEL_STYLE,
    label: ' SUMMARY ',
  });

  const detailGrid = blessed.box({
    top: 3,
    left: '32%',
    width: '68%',
    height: '100%-6',
    label: ' DETAILS ',
    tags: true,
    style: { border: { fg: 'cyan' } },
  });

  const panels = {
    basic: blessed.box({ parent: detailGrid, top: 0, left: 0, width: '33%', height: '34%', ...PANEL_STYLE, label: ' BASIC INFO ' }),
    pkg: blessed.box({ parent: detailGrid, top: 0, left: '33%', width: '34%', height: '34%', ...PANEL_STYLE, label: ' PACKAGE STATUS ' }),
    outdated: blessed.box({ parent: detailGrid, top: 0, left: '67%', width: '33%', height: '34%', ...PANEL_STYLE, label: ' OUTDATED ' }),
    git: blessed.box({ parent: detailGrid, top: '34%', left: 0, width: '33%', height: '33%', ...PANEL_STYLE, label: ' GIT STATUS ' }),
    gitFiles: blessed.box({ parent: detailGrid, top: '34%', left: '33%', width: '34%', height: '33%', ...PANEL_STYLE, label: ' GIT FILES ' }),
    commits: blessed.box({ parent: detailGrid, top: '34%', left: '67%', width: '33%', height: '33%', ...PANEL_STYLE, label: ' RECENT COMMITS ' }),
    scripts: blessed.box({ parent: detailGrid, top: '67%', left: 0, width: '50%', height: '33%', ...PANEL_STYLE, label: ' SCRIPTS ' }),
    system: blessed.box({ parent: detailGrid, top: '67%', left: '50%', width: '50%', height: '33%', ...PANEL_STYLE, label: ' SYSTEM STATUS ' }),
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
    padding: { left: 1 },
    style: { fg: 'gray', bg: 'black' },
  });

  for (const widget of [header, projectList, summaryBox, detailGrid, quickFooter, navFooter]) {
    screen.append(widget);
  }

  return { header, projectList, summaryBox, detailGrid, panels, quickFooter, navFooter };
}
