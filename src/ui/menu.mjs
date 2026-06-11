import readline from 'readline';
import { cursor, DIM, fg, R } from '../theme.mjs';

const write = (s) => process.stdout.write(s);

export function arrowMenu(items, renderItem, hint = '') {
  return new Promise((resolve) => {
    let sel = 0;
    const count = items.length;

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    cursor.hide();

    const draw = () => {
      for (let i = 0; i < count; i++) {
        cursor.clearLine();
        cursor.col(0);
        write(renderItem(items[i], i === sel) + '\n');
      }
      if (hint) {
        cursor.clearLine();
        cursor.col(0);
        write(`  ${DIM}${fg.gray}${hint}${R}\n`);
      }
    };

    const redraw = (newSel) => {
      cursor.up(count + (hint ? 1 : 0));
      sel = newSel;
      draw();
    };

    draw();

    const onKey = (_, key) => {
      if (!key) return;
      if (key.name === 'up' && sel > 0) redraw(sel - 1);
      else if (key.name === 'down' && sel < count - 1) redraw(sel + 1);
      else if (key.name === 'return') {
        cleanup();
        resolve(sel);
      } else if (key.name === 'escape' || (key.ctrl && key.name === 'c') || key.name === 'q') {
        cleanup();
        resolve(-1);
      }
    };

    const cleanup = () => {
      process.stdin.removeListener('keypress', onKey);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      cursor.show();
    };

    process.stdin.on('keypress', onKey);
  });
}
