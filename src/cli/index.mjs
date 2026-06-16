import path from 'path';
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { buildProjects, findProject } from '../scanner.mjs';
import { launchProject } from '../runner.mjs';
import { hasScript, canRunAction, ACTION, actionLabel } from '../project.mjs';
import { APP } from '../constants.mjs';
import { buildExcludeSet, parseExcludeList } from '../utils.mjs';
import { runInteractive } from '../ui/router.mjs';
import { printProjectTable, formatAnsiDetails } from '../ui/format.mjs';
import { MSG, msgEmpty, msgNonInteractiveTip } from '../messages.mjs';
import { R, fg, DIM } from '../theme.mjs';
import { getMemoryInfo, getMemoryGb, setMemoryGb, resetMemoryGb, clampMemoryGb } from '../memory.mjs';
import {
  createSslCertificate,
  formatExpiry,
  formatSslResult,
  getSslExpiryInfo,
  parseExpiry,
  resetSslExpiry,
  setSslExpiry,
} from '../ssl.mjs';
import { killPort, validatePort } from '../port.mjs';
import {
  msgPortAlreadyFree,
  msgPortKilled,
  msgPortKillFailed,
  msgPortKillNotFound,
} from '../messages.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));

function getProjects(dir, exclude) {
  const rootDir = path.resolve(dir || '.');
  const excludeSet = buildExcludeSet(exclude);
  const projects = buildProjects(rootDir, excludeSet);
  return { rootDir, excludeSet, projects };
}

export async function runCli(argv) {
  const program = new Command();

  program
    .name(APP.bin)
    .description(`${APP.name} — ${APP.tagline}`)
    .version(pkg.version)
    .option('-e, --exclude <dirs>', 'comma-separated directories to exclude')
    .option('--no-tui', 'force ANSI menu instead of blessed TUI')
    .option('--json', 'output machine-readable JSON')
    .option('-m, --memory <gb>', 'Node.js heap memory in GB (safe limits apply)', parseFloat);

  program
    .command('memory [gb]')
    .description('Show or set Node.js heap memory limit (GB)')
    .option('--reset', 'reset to device default')
    .action((gb, opts) => {
      const info = getMemoryInfo();

      if (opts.reset) {
        const val = resetMemoryGb();
        console.log(`\n  ${fg.green}Memory reset to device default: ${val} GB${R}\n`);
        return;
      }

      if (gb != null) {
        const val = setMemoryGb(clampMemoryGb(parseFloat(gb)));
        console.log(`\n  ${fg.green}Memory set to ${val} GB (${Math.round(val * 1024)} MB)${R}\n`);
        return;
      }

      console.log(`
  ${DIM}Device RAM:${R}      ${info.deviceGb} GB
  ${DIM}Safe range:${R}      ${info.minGb} – ${info.maxGb} GB
  ${DIM}Recommended:${R}     ${info.deviceDefault} GB
  ${DIM}Current heap:${R}    ${fg.cyan}${info.current} GB${R} (${info.currentMb} MB)
  ${DIM}Mode:${R}            ${info.isCustom ? 'custom' : 'auto (device default)'}
  ${DIM}Config:${R}          ${info.configPath}
`);
    });

  program
    .command('ssl-expiry [duration]')
    .description('Show or set default SSL certificate expiry (min 7 days; units: day, week, month, year)')
    .option('--reset', 'reset to built-in default (1 year)')
    .action((duration, opts) => {
      const info = getSslExpiryInfo();

      if (opts.reset) {
        const val = resetSslExpiry();
        console.log(`\n  ${fg.green}SSL expiry reset to default: ${formatExpiry(val)} (${val.days} days)${R}\n`);
        return;
      }

      if (duration != null) {
        const parsed = parseExpiry(duration);
        if (!parsed) {
          console.error(`\n  ${fg.red}Invalid expiry: ${duration}${R}`);
          console.error(`  ${DIM}Use units: day, week, month, year (min ${info.minDays} days)${R}\n`);
          process.exit(1);
        }
        const val = setSslExpiry(parsed);
        console.log(`\n  ${fg.green}Default SSL expiry set to ${formatExpiry(val)} (${val.days} days)${R}\n`);
        return;
      }

      console.log(`
  ${DIM}Built-in default:{R}  ${formatExpiry(info.defaultExpiry)}
  ${DIM}Current default:{R}  ${fg.cyan}${formatExpiry(info.current)}${R} (${info.current.days} days)
  ${DIM}Minimum:{R}          ${info.minDays} days
  ${DIM}Units:{R}            ${info.units.join(', ')}
  ${DIM}Mode:{R}             ${info.isCustom ? 'custom' : 'built-in default'}
  ${DIM}Config:{R}           ${info.configPath}
`);
    });

  program
    .command('ssl <project> [dir]')
    .description('Create a local HTTPS certificate in <project>/certs/')
    .option('-e, --expiry <duration>', 'certificate lifetime, e.g. "30 day", "2 week", "1 year"')
    .option('-f, --force', 'replace existing certificate files')
    .action(async (project, dir, opts, cmd) => {
      const global = cmd.parent.opts();
      const { projects } = getProjects(dir, parseExcludeList(global.exclude));
      const proj = findProject(projects, project);

      if (!proj) {
        console.error(`\n  ${MSG.projectNotFound(project)}${R}\n`);
        process.exit(1);
      }

      let expiry = null;
      if (opts.expiry != null) {
        expiry = parseExpiry(opts.expiry);
        if (!expiry) {
          const info = getSslExpiryInfo();
          console.error(`\n  ${fg.red}Invalid expiry: ${opts.expiry}${R}`);
          console.error(`  ${DIM}Use units: day, week, month, year (min ${info.minDays} days)${R}\n`);
          process.exit(1);
        }
      }

      const result = await createSslCertificate(proj.dir, { expiry, force: opts.force });
      if (!result.ok) {
        console.error(`\n  ${fg.red}${result.error}${R}\n`);
        process.exit(1);
      }

      console.log(`\n  ${fg.green}${formatSslResult(result)}${R}\n`);
      process.exit(0);
    });

  program
    .command('scan [dir]')
    .description('Scan directory — interactive picker in terminal, or table with --list-only')
    .option('--list-only', 'print table only, do not open interactive picker')
    .action(async (dir, opts, cmd) => {
      const global = cmd.parent.opts();
      const exclude = parseExcludeList(global.exclude);
      const rootDir = path.resolve(dir || '.');
      const excludeSet = buildExcludeSet(exclude);
      const isInteractiveTerminal = process.stdin.isTTY && process.stdout.isTTY;
      const wantsPicker = isInteractiveTerminal && !opts.listOnly && !global.json;

      if (wantsPicker) {
        const code = await runInteractive(rootDir, excludeSet, { noTui: global.noTui });
        if (code != null) process.exit(code);
        return;
      }

      const { projects } = getProjects(dir, exclude);

      if (global.json) {
        console.log(JSON.stringify(projects, null, 2));
        return;
      }

      if (projects.length === 0) {
        console.log(msgEmpty());
        return;
      }

      printProjectTable(projects, rootDir);

      if (!isInteractiveTerminal) {
        console.log(msgNonInteractiveTip());
      }
    });

  program
    .command('list [dir]')
    .description('List projects as JSON')
    .action((dir, opts, cmd) => {
      const global = cmd.parent.opts();
      const { projects } = getProjects(dir, parseExcludeList(global.exclude));
      console.log(JSON.stringify(projects, null, 2));
    });

  program
    .command('info <project> [dir]')
    .description('Show metadata for a project')
    .action((project, dir, opts, cmd) => {
      const global = cmd.parent.opts();
      const { projects } = getProjects(dir, parseExcludeList(global.exclude));
      const proj = findProject(projects, project);

      if (!proj) {
        console.error(`\n  ${MSG.projectNotFound(project)}${R}\n`);
        process.exit(1);
      }

      if (global.json) {
        console.log(JSON.stringify(proj, null, 2));
        return;
      }

      console.log(formatAnsiDetails(proj));
    });

  program
    .command('kill-port <port>')
    .description('Free a port by terminating the process listening on it')
    .action(async (portArg) => {
      const port = validatePort(portArg);
      if (port == null) {
        console.error(`\n  ${fg.red}Invalid port: ${portArg}${R}\n`);
        process.exit(1);
      }

      const result = await killPort(port);

      if (result.wasFree) {
        console.log(`\n  ${msgPortAlreadyFree(port)}\n`);
        process.exit(0);
      }

      if (result.killed.length === 0) {
        console.error(`\n  ${msgPortKillNotFound(port)}\n`);
        process.exit(1);
      }

      console.log(`\n  ${msgPortKilled(port, result.killed)}`);
      if (!result.nowFree) {
        console.log(`  ${msgPortKillFailed(port)}`);
      }
      console.log('');
      process.exit(result.nowFree ? 0 : 1);
    });

  program
    .command('run <project> [dir]')
    .description('Run a script for a project (dev, start, test, lint, ci, …)')
    .option('-s, --script <name>', 'script to run', 'dev')
    .option('-p, --port <number>', 'port override (dev/start only)', parseInt)
    .option('--kill-port', 'kill any process using the target port before launch')
    .action(async (project, dir, opts, cmd) => {
      const global = cmd.parent.opts();
      const { projects } = getProjects(dir, parseExcludeList(global.exclude));
      const proj = findProject(projects, project);

      if (!proj) {
        console.error(`\n  ${MSG.projectNotFound(project)}${R}\n`);
        process.exit(1);
      }

      const script = opts.script === 'install' ? ACTION.INSTALL
        : opts.script === 'reinit' ? ACTION.REINIT
        : opts.script === 'ci' ? ACTION.CI
        : opts.script;

      if (!canRunAction(proj, script)) {
        console.error(`\n  ${MSG.noScript(actionLabel(script))}${R}\n`);
        process.exit(1);
      }

      const memoryGb = global.memory ?? getMemoryGb();
      const code = await launchProject(proj, script, {
        port: opts.port,
        memoryGb,
        killPort: opts.killPort,
      });
      process.exit(code);
    });

  program
    .command('install <project> [dir]')
    .description('Install dependencies for a project')
    .action(async (project, dir, opts, cmd) => {
      const global = cmd.parent.opts();
      const { projects } = getProjects(dir, parseExcludeList(global.exclude));
      const proj = findProject(projects, project);

      if (!proj) {
        console.error(`\n  ${MSG.projectNotFound(project)}${R}\n`);
        process.exit(1);
      }

      const memoryGb = global.memory ?? getMemoryGb();
      const code = await launchProject(proj, ACTION.INSTALL, { memoryGb });
      process.exit(code);
    });

  program
    .command('reinit <project> [dir]')
    .description('Remove node_modules, build artifacts, and reinstall dependencies')
    .action(async (project, dir, opts, cmd) => {
      const global = cmd.parent.opts();
      const { projects } = getProjects(dir, parseExcludeList(global.exclude));
      const proj = findProject(projects, project);

      if (!proj) {
        console.error(`\n  ${MSG.projectNotFound(project)}${R}\n`);
        process.exit(1);
      }

      const memoryGb = global.memory ?? getMemoryGb();
      const code = await launchProject(proj, ACTION.REINIT, { memoryGb });
      process.exit(code);
    });

  program
    .command('build <project> [dir]')
    .description('Run build script for a project')
    .action(async (project, dir, opts, cmd) => {
      const global = cmd.parent.opts();
      const { projects } = getProjects(dir, parseExcludeList(global.exclude));
      const proj = findProject(projects, project);

      if (!proj) {
        console.error(`\n  ${MSG.projectNotFound(project)}${R}\n`);
        process.exit(1);
      }

      if (!hasScript(proj, 'build')) {
        console.error(`\n  ${MSG.noScript('build')}${R}\n`);
        process.exit(1);
      }

      const memoryGb = global.memory ?? getMemoryGb();
      const code = await launchProject(proj, 'build', { memoryGb });
      process.exit(code);
    });

  program
    .command('interactive [dir]', { isDefault: true })
    .alias('ui')
    .description('Launch interactive project scanner (default)')
    .action(async (dir, opts, cmd) => {
      const global = cmd.parent.opts();
      const rootDir = path.resolve(dir || '.');
      const excludeSet = buildExcludeSet(parseExcludeList(global.exclude));
      const code = await runInteractive(rootDir, excludeSet, { noTui: global.noTui });
      if (code != null) process.exit(code);
    });

  await program.parseAsync(argv);
}
