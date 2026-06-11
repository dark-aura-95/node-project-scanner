const ESC = '\x1b';

export const R = `${ESC}[0m`;
export const B = `${ESC}[1m`;
export const DIM = `${ESC}[2m`;

export const fg = {
  black: `${ESC}[30m`,
  red: `${ESC}[31m`,
  green: `${ESC}[32m`,
  yellow: `${ESC}[33m`,
  blue: `${ESC}[34m`,
  magenta: `${ESC}[35m`,
  cyan: `${ESC}[36m`,
  white: `${ESC}[37m`,
  gray: `${ESC}[90m`,
  bred: `${ESC}[91m`,
  bgreen: `${ESC}[92m`,
  byellow: `${ESC}[93m`,
  bblue: `${ESC}[94m`,
  bmagenta: `${ESC}[95m`,
  bcyan: `${ESC}[96m`,
  bwhite: `${ESC}[97m`,
};

export const bg = {
  black: `${ESC}[40m`,
  red: `${ESC}[41m`,
  green: `${ESC}[42m`,
  blue: `${ESC}[44m`,
  magenta: `${ESC}[45m`,
  cyan: `${ESC}[46m`,
  white: `${ESC}[47m`,
  gray: `${ESC}[100m`,
  bblue: `${ESC}[104m`,
};

export const cursor = {
  hide: () => process.stdout.write(`${ESC}[?25l`),
  show: () => process.stdout.write(`${ESC}[?25h`),
  up: (n = 1) => process.stdout.write(`${ESC}[${n}A`),
  col: (n = 0) => process.stdout.write(`${ESC}[${n}G`),
  clearLine: () => process.stdout.write(`${ESC}[2K`),
};

export const W = () => process.stdout.columns || 80;

export const BUILDERS = {
  'Next.js': { icon: '▲', color: fg.bwhite, badge: bg.black + fg.bwhite },
  'Vite': { icon: '⚡', color: fg.bmagenta, badge: bg.magenta + fg.bwhite },
  'Nuxt': { icon: '💚', color: fg.bgreen, badge: bg.green + fg.black },
  'SvelteKit': { icon: '🔥', color: fg.bred, badge: bg.red + fg.bwhite },
  'Astro': { icon: '🚀', color: fg.bcyan, badge: bg.cyan + fg.black },
  'Remix': { icon: '💿', color: fg.bblue, badge: bg.blue + fg.bwhite },
  'Gatsby': { icon: '◈', color: fg.bmagenta, badge: bg.magenta + fg.bwhite },
  'Angular': { icon: '🅰', color: fg.bred, badge: bg.red + fg.bwhite },
  'Webpack': { icon: '■', color: fg.bblue, badge: bg.blue + fg.bwhite },
  'Rollup': { icon: '⬤', color: fg.byellow, badge: bg.gray + fg.byellow },
  'Parcel': { icon: '📦', color: fg.byellow, badge: bg.gray + fg.byellow },
  'esbuild': { icon: '⚙', color: fg.bgreen, badge: bg.green + fg.black },
  'tsc': { icon: '◆', color: fg.bblue, badge: bg.bblue + fg.black },
  'Unknown': { icon: '○', color: fg.gray, badge: bg.gray + fg.white },
};

export function builderInfo(name) {
  return BUILDERS[name] || BUILDERS.Unknown;
}

export const pmColors = {
  npm: fg.bred,
  yarn: fg.bblue,
  pnpm: fg.byellow,
  bun: fg.byellow,
};
