# node-project-scanner

Professional CLI to **scan**, **run**, and **build** Node.js / JavaScript projects with smart port control.

Short command: **`nps`**

## Project layout

```
src/
├── constants.mjs   # App name, version, tagline, shortcuts
├── messages.mjs    # Shared user-facing messages
├── project.mjs     # Script helpers (dev/start/build)
├── ui/
│   ├── format.mjs  # All ANSI & blessed formatting
│   ├── menu.mjs    # Arrow-key menu
│   ├── blessed.mjs # TUI
│   └── ansi.mjs    # Fallback menus
```

## Features

- **Dashboard TUI** — projects list, summary, git/commits, package & outdated panels
- **Fast incremental scan** — projects stream in while directories are walked
- **Lazy enrichment** — git, outdated, and deps status load per project (not all at once)
- Recursive `package.json` discovery across monorepos
- Auto-detect builders: Next.js, Vite, Nuxt, SvelteKit, Astro, Remix, Gatsby, Angular, and more
- Detect package manager: npm, pnpm, yarn, bun
- Port detection from `.env` files and scripts
- Port override with free-port fallback
- Configurable Node heap memory (`M` / `nps memory`)
- Hybrid UI: blessed split-panel TUI with ANSI fallback
- Scriptable subcommands for CI and automation

See [CHANGELOG.md](./CHANGELOG.md) for release notes.

## Install

```bash
npm install -g node-project-scanner
```

Or run with npx (no install):

```bash
npx "C:\path\to\node-project-scanner" scan .
npx "C:\path\to\node-project-scanner" run my-app --port 3005
```

Or install locally:

```bash
git clone <repo>
cd node-project-scanner
npm install
npm link
```

## Usage

### Interactive (default)

```bash
nps
nps ~/projects
nps . --exclude legacy,archive
nps --no-tui
```

**TUI shortcuts**

| Key | Action |
|-----|--------|
| `Enter` | Action menu (dev, start, build, install, …) |
| `D` | Run dev |
| `S` | Run start |
| `B` | Run build |
| `I` | Install dependencies |
| `C` | CI install (frozen lockfile) |
| `P` | Change port |
| `K` | Kill process on project port |
| `M` | Node memory (GB) |
| `U` | Refresh outdated packages |
| `T` | Open terminal in project folder |
| `E` | Open folder in Explorer |
| `G` | Show git status toast |
| `O` | More actions (all scripts) |
| `R` | Rescan |
| `/` | Search / filter |
| `?` | Help |
| `Q` | Quit |

### Commands

```bash
# Scan + interactive picker (select, run, build) — in a real terminal
nps scan .
npx "C:\path\to\node-project-scanner" scan .

# Table only (no picker)
nps scan . --list-only

# JSON output
nps list . --json
nps scan . --json

# Project info
nps info my-app
nps info web-admin ~/projects

# Run with port override
nps run my-app
nps run my-app --port 3005
nps run my-app --script start -p 4000
nps run my-app --port 3000 --kill-port

# Free a busy port
nps kill-port 3000

# Build
nps build my-app

# Install & CI
nps install my-app
nps run my-app --script ci
nps run my-app --script test
```

**List icons:** `✓` deps installed · `○` missing · `·` checking · name shows `package · folder` when they differ.

**Memory:** `nps memory` or `M` in TUI — sets Node heap limit (saved in `~/.nps/config.json`).

**Current tool version:** `nps --version` (see [CHANGELOG.md](./CHANGELOG.md))

## Port handling

- Detects `PORT` from `.env`, `.env.local`, `.env.development`
- Parses `--port` / `-p` from npm scripts
- Sets `PORT` env var and forwards builder-specific CLI flags
- Auto-finds next free port when the chosen port is busy
- Kill stuck processes on a port (`nps kill-port`, `--kill-port`, or `K` in TUI)

## Local development

```bash
npm install
npm start              # launch interactive UI
node bin/nps.mjs scan  # scan current directory
npm link               # link globally as `nps`
```

## Test

```bash
npm test
```

## Publish to npm

```bash
npm test
npm login
npm publish
```

**1.1.0 highlights:** dashboard TUI, incremental scan, lazy git/outdated loading, auto deps status, scan crash fix. Full notes in [CHANGELOG.md](./CHANGELOG.md).

## Requirements

- Node.js 18+
- Works best in a real terminal (TTY) for interactive mode

## License

MIT
