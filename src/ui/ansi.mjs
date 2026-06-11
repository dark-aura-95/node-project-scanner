import { buildProjects } from '../scanner.mjs';
import { buildActions } from '../project.mjs';
import { SHORTCUTS } from '../constants.mjs';
import { MSG, msgEmptyWithTips } from '../messages.mjs';
import { fg, R, DIM, cursor } from '../theme.mjs';
import { arrowMenu } from './menu.mjs';
import {
  formatAnsiHeader,
  formatAnsiDetails,
  formatAnsiColumnHeaders,
  formatStepLabel,
  renderAnsiProjectRow,
  renderAnsiActionRow,
} from './format.mjs';

const write = (s) => process.stdout.write(s);

export { printProjectTable } from './format.mjs';

export async function runAnsiInteractive(rootDir, excludeSet) {
  write(`  ${fg.gray}${MSG.scanning}${R}\r`);
  const projects = buildProjects(rootDir, excludeSet);
  cursor.clearLine();

  write(formatAnsiHeader(rootDir, projects.length));

  if (projects.length === 0) {
    write(msgEmptyWithTips());
    return 0;
  }

  write(formatStepLabel(1, 3, 'Select a project'));
  write(formatAnsiColumnHeaders());

  const projIdx = await arrowMenu(
    projects,
    (proj, sel) => renderAnsiProjectRow(proj, sel),
    SHORTCUTS.navAnsi
  );

  if (projIdx < 0) {
    write(`\n  ${fg.gray}${MSG.goodbye}${R}\n\n`);
    return 0;
  }

  const proj = projects[projIdx];
  write(formatAnsiDetails(proj));

  const actions = buildActions(proj);
  if (actions.length === 0) {
    write(`  ${fg.yellow}${MSG.noScripts}${R}\n\n`);
    return 0;
  }

  write(formatStepLabel(2, 3, 'Choose an action'));

  const actionIdx = await arrowMenu(
    actions,
    (action, sel) => renderAnsiActionRow(action, sel),
    SHORTCUTS.actionAnsi
  );

  if (actionIdx < 0) {
    write(`\n  ${fg.gray}${MSG.goodbye}${R}\n\n`);
    return 0;
  }

  const chosen = actions[actionIdx];

  if (chosen.needsPort) {
    write(formatStepLabel(3, 3, 'Configure port (Enter = auto)'));
  }

  const { executeAction } = await import('./launch-flow.mjs');
  return executeAction(proj, chosen.script);
}
