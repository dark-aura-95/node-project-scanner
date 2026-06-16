# Changelog

All notable changes to **node-project-scanner** (`nps`) are documented here.

## [1.1.5] - 2026-06-16

### Added

- **SSL certificates** — `nps ssl <project>` creates local HTTPS certs in `<project>/certs/` (`localhost.pem`, `localhost-key.pem`); uses bundled Node crypto (no system OpenSSL required)
- **Configurable expiry** — `nps ssl-expiry` sets the default lifetime (units: day, week, month, year; minimum 7 days)
- **TUI shortcuts** — `H` create SSL cert, `G` set default SSL expiry; **ssl cert** action in the Tooling menu

## [1.1.4] - 2026-06-13

### Added

- **Grouped action menu** — pressing Enter on a project shows actions in sections: **Run** (dev, start, build), **Package** (install, reinit, ci), **Tooling**, then other scripts

### Changed

- Action menu order — run scripts appear before package-related actions in both TUI and ANSI picker

## [1.1.3] - 2026-06-13

### Added

- **Reinit** — `nps reinit <project>`, `--script reinit`, action menu, and `U` in TUI: removes `node_modules`, `build`, `dist`, `.next`, and similar artifact folders then reinstalls dependencies

## [1.1.2] - 2026-06-12

### Added

- **Next free port in UI** — when a port is busy, basic info and the confirm dialog show `Use Port`, `Use URL`, and pre-fill the next free port
- **Auto-populate port field** — confirm dialog fills the detected port when free, next free port when busy, and the original port after a successful kill

### Fixed

- **Kill port on Windows** — correctly detects and kills processes bound to `0.0.0.0` (dev servers); uses PowerShell `Get-NetTCPConnection` and `taskkill /T /F`
- **Port status after kill** — basic info refreshes after `K` and no longer stays stuck on “in use” from stale netstat entries
- **Kill then launch** — confirm dialog stays open after kill with the freed port filled in; press Enter to launch

## [1.1.1] - 2026-06-12

### Added

- **Kill port in launch confirm** — when a port is busy, press `K` in the port confirm dialog to free it before launching

### Fixed

- **Port confirm dialog layout** — message, port input, and hints no longer overlap (custom modal instead of `blessed.prompt` fixed positions)
- **Port confirm input** — first keystroke replaces the suggested port instead of appending to it
- **Basic info port status** — in-use ports now show `⚠ in use` instead of a misleading green checkmark
- **Port confirm crash** — fixed `TypeError` from invalid textbox listener API on neo-blessed

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
