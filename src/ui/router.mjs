import { buildProjects } from '../scanner.mjs';
import { runBlessedInteractive } from './blessed.mjs';
import { runAnsiInteractive } from './ansi.mjs';
import { printProjectTable } from './format.mjs';
import { msgEmpty, msgNonInteractiveTip } from '../messages.mjs';

export async function runInteractive(rootDir, excludeSet, { noTui = false } = {}) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    const projects = buildProjects(rootDir, excludeSet);
    if (projects.length === 0) {
      process.stdout.write(msgEmpty());
      return 0;
    }
    process.stdout.write(msgNonInteractiveTip());
    printProjectTable(projects, rootDir);
    return 0;
  }

  if (noTui) {
    return runAnsiInteractive(rootDir, excludeSet);
  }

  try {
    return await runBlessedInteractive(rootDir, excludeSet);
  } catch (err) {
    if (process.env.DEBUG) {
      console.error('Blessed TUI failed, falling back to ANSI:', err);
    }
    return runAnsiInteractive(rootDir, excludeSet);
  }
}
