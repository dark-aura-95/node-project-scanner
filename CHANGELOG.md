# Changelog

All notable changes to **node-project-scanner** (`nps`) are documented here.

## [1.1.0] - 2026-06-11

### Added

- **Dashboard TUI** — split layout: project list, summary, and detail panels (basic info, package status, outdated, git, commits, scripts, system)
- **Incremental async scan** — projects appear while scanning; non-blocking directory walk
- **Lazy project enrichment** — filesystem meta, git, and outdated packages load on demand for the selected project
- **Auto deps status** — install icons (`✓` / `○` / `·`) update in the project list after scan
- **Auto git & commits** — load when a project is selected
- **Auto outdated check** — runs after git loads for projects with `node_modules`
- **Folder name in list** — shows package name and folder (e.g. `@org/app · my-folder`)
- **Node memory limit** — `M` key in TUI and `nps memory` CLI command
- **Search** — filter by name, folder, path, builder, or git branch (`/`)
- **Quick actions** — install, CI, dev, start, build, terminal, explorer, port, kill port, rescan
- **Kill port** — `nps kill-port <port>`, `--kill-port` on `run`, and `K` in TUI
- **Smoke test suite** — `npm test`

### Performance

- Fast scan path reads only `package.json` (defers port/env/lock/`node_modules` checks)
- Skips heavy Windows system and cache directories during scan
- TUI paints immediately; scan runs on next event-loop tick
- Debounced list rendering during scan
- Git detection reduced to fewer subprocess calls

### Fixed

- **Crash on scan** — `TypeError` in `List.setItem` when install-status updates ran before the project list synced (now rebuilds list when out of sync)
- **Double scan** — `nps scan` no longer runs a full sync scan before opening the TUI
- **Blessed confirm dialog** — port/action prompts no longer crash on boolean callbacks

### Changed

- Refactored TUI into `blessed-layout.mjs`, `blessed-modals.mjs`, and slimmer `blessed.mjs`
- Shared modules: `async.mjs`, `project-filter.mjs`, unified lazy-load pipeline
- `scan --list-only` / `--json` still use synchronous scan for scripting

## [1.0.0] - 2026-06-11

### Added

- Initial release: `nps` CLI with scan, list, info, run, build, install
- Recursive `package.json` discovery
- Builder and package-manager detection
- Port detection and override
- Blessed TUI with ANSI fallback
- JSON output for automation
