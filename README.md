# node-project-scanner

Professional CLI to **scan**, **run**, and **build** Node.js / JavaScript projects with smart port control.

Short command: **`nps`**

## Project layout

```
src/
├── constants.mjs        # App name, version, tagline, shortcuts
├── messages.mjs         # Shared user-facing messages
├── project.mjs          # Script helpers (dev/start/build)
├── port.mjs             # Port detect, validate, kill, status
├── ui/
│   ├── blessed.mjs      # TUI controller
│   ├── blessed-layout.mjs
│   ├── blessed-modals.mjs   # Port confirm, prompts, action menu
│   ├── dashboard-format.mjs # Detail panel formatting
│   ├── format.mjs           # ANSI & blessed formatting
│   └── router.mjs           # TTY vs non-TTY entry
```

## Features

- **Dashboard TUI** — projects list, summary, and detail panels (basic info, package status, scripts, system)
- **Fast incremental scan** — projects stream in while directories are walked
- **Lazy enrichment** — filesystem meta, install status, and package stats load per project
- Recursive `package.json` discovery across monorepos
- Auto-detect builders: Next.js, Vite, Nuxt, SvelteKit, Astro, Remix, Gatsby, Angular, and more
- Detect package manager: npm, pnpm, yarn, bun
- Port detection from `.env` files and scripts
- Port confirm dialog before launch with kill-port support
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
| `K` | Kill process on project port |
| `M` | Node memory (GB) |
| `T` | Open terminal in project folder |
| `E` | Open folder in Explorer |
| `O` | More actions (all scripts) |
| `R` | Rescan |
| `/` | Search / filter |
| `?` | Help |
| `Q` | Quit |

**Port confirm dialog** (shown before launch when a script uses a port)

| Key | Action |
|-----|--------|
| `Enter` | Launch with the port shown in the field |
| `K` | Kill the process using the detected port, then auto-fill that port |
| `Esc` | Cancel |

The port field auto-fills:

- **Port free** → detected port (e.g. `3000`)
- **Port in use** → next free port (e.g. `3001`)
- **After kill** → original detected port (e.g. `3000`), then press Enter to launch

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
- Shows a confirm dialog before launch with port status and URL
- When the detected port is busy, suggests the **next free port** in basic info and the confirm dialog
- Auto-fills the port field: detected port when free, next free when busy, original port after kill
- Kill stuck processes on a port (`nps kill-port`, `--kill-port`, `K` in TUI, or `K` in the port confirm dialog)
- Basic info panel shows live port status and updates after kill (`available` / `in use` / `Use Port`)
- Reliable on Windows — finds listeners on `0.0.0.0` and kills the full process tree

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

**1.1.2 highlights:** Windows kill-port fix, next free port suggestions, auto-fill port in confirm dialog, status refresh after kill. Full notes in [CHANGELOG.md](./CHANGELOG.md).

## Requirements

- Node.js 18+
- Works best in a real terminal (TTY) for interactive mode

## License

MIT
