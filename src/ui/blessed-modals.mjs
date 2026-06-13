import blessed from 'neo-blessed';
import { buildActionMenuRows } from '../project.mjs';
import { getPortStatus, killPort } from '../port.mjs';
import { formatBlessedHelp } from './format.mjs';

showPrompt._active = false;
showActionMenu._active = false;

export function isModalActive() {
  return showPrompt._active || showActionMenu._active;
}

export function nextModalFrame(screen) {
  return new Promise((resolve) => {
    screen?.render();
    setImmediate(resolve);
  });
}

function createModalLayer(screen) {
  const backdrop = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    tags: true,
    style: { bg: 'black' },
  });

  backdrop.setFront?.();

  return {
    backdrop,
    dismiss() {
      backdrop.destroy();
    },
  };
}

function focusModal(screen, element) {
  element.setFront?.();
  element.focus();
  screen.render();
}

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
    if (isModalActive()) return resolve(null);

    const rows = buildActionMenuRows(proj);
    if (!rows.some((r) => r.type === 'action')) return resolve(null);

    const items = rows.map((row) =>
      row.type === 'header'
        ? `{gray-fg}{bold}  ${row.label}{/}{/}`
        : `${row.action.icon} ${row.action.label}  {gray-fg}${row.action.cmd}{/}`
    );
    const scripts = rows.map((row) => (row.type === 'action' ? row.action.script : null));

    let settled = false;
    showActionMenu._active = true;

    const layer = createModalLayer(screen);

    const menu = blessed.list({
      parent: layer.backdrop,
      top: 'center',
      left: 'center',
      width: '72%',
      height: Math.min(items.length + 2, 22),
      border: { type: 'line' },
      label: ' Select Action ',
      tags: true,
      keys: true,
      vi: true,
      mouse: true,
      items,
      style: { border: { fg: 'cyan' }, selected: { bg: 'blue', bold: true }, bg: 'black' },
    });

    const firstActionIdx = scripts.findIndex((s) => s != null);
    if (firstActionIdx > 0) menu.select(firstActionIdx);

    const finish = (script) => {
      if (settled) return;
      settled = true;
      showActionMenu._active = false;
      menu.destroy();
      layer.dismiss();
      screen.render();
      setImmediate(() => resolve(script));
    };

    menu.on('select', (_, i) => {
      const script = scripts[i];
      if (!script) {
        const next = scripts.findIndex((s, j) => j > i && s != null);
        if (next >= 0) menu.select(next);
        return;
      }
      finish(script);
    });
    menu.key(['escape', 'q'], () => finish(null));
    focusModal(screen, menu);
  });
}

export function showHelp(screen) {
  if (isModalActive()) return;

  const layer = createModalLayer(screen);

  const help = blessed.box({
    parent: layer.backdrop,
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

  focusModal(screen, help);

  const close = () => {
    help.destroy();
    layer.dismiss();
    screen.render();
  };

  screen.onceKey(['escape', 'enter', 'q', '?'], close);
}

export function showPortLaunchConfirm(screen, {
  projectName,
  detected,
  isFree,
  freePort,
  onPortFreed,
}) {
  return new Promise((resolve) => {
    if (isModalActive()) return resolve(null);

    let settled = false;
    let abandonInput = false;
    let onReplaceDefault = null;
    let statusNote = '';

    const state = {
      detected,
      isFree,
      freePort,
      suggested: isFree ? detected : freePort,
    };

    function syncSuggested() {
      state.suggested = state.isFree ? state.detected : state.freePort;
    }

    function populateInput() {
      syncSuggested();
      input.setValue(String(state.suggested));
      return String(state.suggested);
    }

    showPrompt._active = true;
    const layer = createModalLayer(screen);

    function buildBody() {
      if (state.isFree) {
        return `{green-fg}✓ Port :${state.detected} is available{/}\n\n` +
          `{gray-fg}Project:{/} {bold}${projectName}{/}\n` +
          `{gray-fg}URL:{/} {cyan-fg}http://localhost:${state.detected}{/}`;
      }

      return `{yellow-fg}⚠ Port :${state.detected} is in use{/}\n` +
        `{green-fg}→ Use next free port: :${state.freePort}{/}\n\n` +
        `{gray-fg}Project:{/} {bold}${projectName}{/}\n` +
        `{gray-fg}URL:{/} {cyan-fg}http://localhost:${state.freePort}{/}`;
    }

    function buildHint() {
      if (statusNote) {
        return `{yellow-fg}${statusNote}{/}`;
      }

      if (state.isFree) {
        return '{gray-fg}Enter to start · Esc to cancel{/}';
      }

      return `{gray-fg}Enter to use :${state.freePort}, edit port, {bold}[K]{/}{gray-fg} kill :${state.detected}, Esc cancel{/}`;
    }

    function renderModal() {
      const body = buildBody();
      const bodyLines = body.split('\n').length;
      const hint = buildHint();
      const portLabel = state.isFree
        ? '{gray-fg}Port:{/}'
        : `{gray-fg}Port:{/} {green-fg}(next free :${state.freePort}){/}`;

      container.setLabel(state.isFree ? ' ⚙ Confirm Port ' : ' ⚙ Port In Use ');
      container.style.border.fg = state.isFree ? 'cyan' : 'yellow';
      container.height = bodyLines + 5;
      container.setContent(` ${body}\n ${portLabel}`);
      input.top = bodyLines;
      hintBox.top = bodyLines + 2;
      hintBox.setContent(hint);
      populateInput();
      screen.render();
    }

    const container = blessed.box({
      parent: layer.backdrop,
      top: 'center',
      left: 'center',
      width: '60%',
      height: 10,
      border: { type: 'line' },
      label: state.isFree ? ' ⚙ Confirm Port ' : ' ⚙ Port In Use ',
      tags: true,
      style: { border: { fg: state.isFree ? 'cyan' : 'yellow' }, bg: 'black' },
    });

    const input = blessed.textbox({
      parent: container,
      top: 4,
      left: 7,
      right: 2,
      height: 1,
      bg: 'black',
    });

    const hintBox = blessed.box({
      parent: container,
      top: 6,
      left: 2,
      right: 2,
      height: 1,
      tags: true,
      content: buildHint(),
    });

    renderModal();

    const finish = (result) => {
      if (settled) return;
      settled = true;
      showPrompt._active = false;
      screen.unkey(['escape'], onEscape);
      cancelInput();
      container.destroy();
      layer.dismiss();
      screen.render();
      setImmediate(() => resolve(result));
    };

    const onEscape = () => {
      if (input._reading) {
        input.cancel();
        return;
      }
      finish(null);
    };

    function cancelInput() {
      abandonInput = true;
      if (onReplaceDefault) {
        input.removeListener('keypress', onReplaceDefault);
        onReplaceDefault = null;
      }
      if (!input._reading) {
        abandonInput = false;
        return;
      }
      if (input.__listener) {
        input.cancel();
        return;
      }
      input._reading = false;
      delete input._callback;
      delete input._done;
      delete input.__listener;
      input.screen.grabKeys = false;
      input.screen.program.hideCursor();
      abandonInput = false;
    }

    function beginInput() {
      if (settled || input._reading) return;

      input.focus();
      const initial = populateInput();

      onReplaceDefault = (ch, key) => {
        if (!state.isFree && (key.name === 'k' || ch === 'k' || ch === 'K')) {
          setImmediate(() => onKill());
          return;
        }
        if (input.value !== initial) return;
        if (key.name === 'escape' || key.name === 'enter') return;
        if (ch) {
          input.value = '';
          input._value = '';
        }
      };
      input.on('keypress', onReplaceDefault);

      input.readInput((err, answer) => {
        input.removeListener('keypress', onReplaceDefault);
        onReplaceDefault = null;
        if (abandonInput) {
          abandonInput = false;
          return;
        }
        finish(err || answer === null || answer === undefined ? null : answer);
      });
    }

    async function onKill() {
      if (settled || state.isFree) return;

      cancelInput();

      statusNote = `Killing processes on :${state.detected}…`;
      renderModal();

      const result = await killPort(state.detected);
      if (onPortFreed) await onPortFreed();

      if (result.wasFree || result.nowFree) {
        state.isFree = true;
        state.freePort = state.detected;
        statusNote = '';
        renderModal();
        setImmediate(() => beginInput());
        return;
      }

      if (result.killed.length === 0) {
        statusNote = `No process found on :${state.detected}`;
      } else {
        statusNote = `Port :${state.detected} still in use`;
      }

      const refreshed = await getPortStatus(state.detected);
      state.isFree = refreshed.isFree;
      state.freePort = refreshed.freePort;
      if (refreshed.isFree) {
        statusNote = '';
        renderModal();
        setImmediate(() => beginInput());
        return;
      }

      renderModal();
      setImmediate(() => beginInput());
    }

    screen.key(['escape'], onEscape);
    screen.render();
    setImmediate(() => beginInput());
  });
}

export function showPrompt(screen, { label, width = '55%', style = { border: { fg: 'cyan' } }, height = 'shrink' }, message, value) {
  return new Promise((resolve) => {
    if (isModalActive()) return resolve(null);

    let settled = false;

    showPrompt._active = true;
    const layer = createModalLayer(screen);

    const prompt = blessed.prompt({
      parent: layer.backdrop,
      border: 'line',
      height,
      width,
      top: 'center',
      left: 'center',
      label,
      tags: true,
      keys: true,
      style: { ...style, bg: 'black' },
    });

    const finish = (result) => {
      if (settled) return;
      settled = true;
      showPrompt._active = false;
      screen.unkey(['escape'], onEscape);
      prompt.hide();
      prompt.destroy();
      layer.dismiss();
      screen.render();
      setImmediate(() => resolve(result));
    };

    const onEscape = () => {
      if (prompt._.input?._reading) {
        prompt._.input.cancel();
        return;
      }
      finish(null);
    };

    screen.key(['escape'], onEscape);

    focusModal(screen, prompt);

    prompt.input(message, value, (err, answer) => {
      screen.unkey(['escape'], onEscape);
      finish(err || answer === null || answer === undefined ? null : answer);
    });
  });
}
