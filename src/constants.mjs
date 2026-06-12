import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

export const APP = {
  name: pkg.name,
  displayName: 'Projects',
  bin: 'nps',
  version: pkg.version,
  tagline: 'Scan • Run • Build your projects',
  description: pkg.description,
};

export const COLS = {
  name: 26,
  path: 20,
};

export const SHORTCUTS = {
  footerBlessed:
    '{bold}Enter{/} Actions  {bold}I{/} Install  {bold}D{/} Dev  {bold}B{/} Build  ' +
    '{bold}O{/} More  {bold}K{/} Kill  {bold}R{/} Rescan  {bold}?{/} Help',
  navAnsi: '↑↓ navigate   Enter select   Q quit',
  actionAnsi: '↑↓ navigate   Enter select   Esc back   Q quit',
  scriptLegend: '✓=deps  D=dev  S=start  B=build',
};

export function plural(n, word, suffix = 's') {
  return `${n} ${word}${n === 1 ? '' : suffix}`;
}
