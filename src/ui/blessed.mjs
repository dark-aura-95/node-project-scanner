import { spawn } from 'child_process';
import { buildProjectsAsync } from '../scanner.mjs';
import { filterProjects } from '../project-filter.mjs';
import { createGenerationToken } from '../async.mjs';
import {
  scheduleIdle,
  loadProjectFsMeta,
  loadProjectOutdated,
  applyProjectMetaFast,
  startInstallStatusEnrichment,
  loadProjectDetails,
} from './lazy-load.mjs';
import { executeAction } from './launch-flow.mjs';
import { findFreePort, isPortFree, killPort } from '../port.mjs';
import { getSystemInfo, warmSystemInfoCache } from '../system.mjs';
import { getMemoryGb, getMemoryInfo, setMemoryGb, clampMemoryGb, resetMemoryGb } from '../memory.mjs';
import { ACTION, canRunAction, actionLabel } from '../project.mjs';
import { MSG } from '../messages.mjs';
import {
  formatTopHeader,
  formatProjectListItem,
  formatProjectSummary,
  formatBasicInfo,
  formatPackageStatus,
  formatPackageOutdated,
  formatGitStatus,
  formatGitFileStatus,
  formatRecentCommits,
  formatScriptsPanel,
  formatSystemStatus,
  formatQuickActionsFooter,
  formatNavFooter,
  formatDetailTitle,
  formatProjectsLabel,
  formatLoadingPanel,
} from './dashboard-format.mjs';
import { createBlessedScreen, createDashboardLayout } from './blessed-layout.mjs';
import { showToast, showActionMenu, showHelp, showPrompt } from './blessed-modals.mjs';

const SCAN_RENDER_MS = 250;

export async function runBlessedInteractive(rootDir, excludeSet) {
  const screen = createBlessedScreen();
  const ui = createDashboardLayout(screen);

  const state = {
    allProjects: [],
    filteredProjects: [],
    selectedIdx: 0,
    searchQuery: '',
    customPort: null,
    customMemoryGb: getMemoryGb(),
    lastScanAt: Date.now(),
    focusPanel: 'projects',
    scanning: false,
    cachedSystemInfo: null,
  };

  const scanToken = createGenerationToken();
  const detailToken = createGenerationToken();
  const installToken = createGenerationToken();
  let installEnrichmentActive = false;
  let renderPending = false;

  function scheduleRender() {
    if (renderPending) return;
    renderPending = true;
    setImmediate(() => {
      renderPending = false;
      screen.render();
    });
  }

  function selectedProject() {
    return state.filteredProjects[state.selectedIdx];
  }

  function scanAge() {
    return Math.max(1, Math.round((Date.now() - state.lastScanAt) / 1000));
  }

  function applyFilters() {
    state.filteredProjects = filterProjects(state.allProjects, state.searchQuery);
  }

  function updateHeader() {
    ui.header.setContent(formatTopHeader(state.filteredProjects.length, scanAge()));
    ui.projectList.setLabel(formatProjectsLabel(state.filteredProjects.length));
    ui.quickFooter.setContent(formatQuickActionsFooter());
    ui.navFooter._default = formatNavFooter().replace(
      '{right}{green-fg}⚡ Ready{/}  {cyan-fg}{/}{/right}',
      `{right}{green-fg}⚡ Ready{/}  {cyan-fg}${state.filteredProjects.length} projects{/}{/right}`
    );
    ui.navFooter.setContent(ui.navFooter._default);
  }

  function applyGitPanels(proj) {
    ui.panels.git.setContent(formatGitStatus(proj));
    ui.panels.gitFiles.setContent(formatGitFileStatus(proj));
    ui.panels.commits.setContent(formatRecentCommits(proj));
  }

  function applyOutdatedPanels(proj) {
    ui.panels.outdated.setContent(formatPackageOutdated(proj));
    ui.panels.pkg.setContent(formatPackageStatus(proj));
  }

  function fillDetailPanelsFast(proj) {
    if (!proj) return;

    applyProjectMetaFast(proj);
    if (!state.cachedSystemInfo) state.cachedSystemInfo = getSystemInfo();

    ui.detailGrid.setLabel(formatDetailTitle(proj));
    ui.panels.basic.setContent(formatBasicInfo(proj, state.customPort));
    ui.panels.pkg.setContent(formatPackageStatus(proj));
    ui.panels.scripts.setContent(formatScriptsPanel(proj));
    ui.panels.system.setContent(formatSystemStatus(state.cachedSystemInfo));
    ui.panels.outdated.setContent(
      proj._outdatedLoaded
        ? formatPackageOutdated(proj)
        : formatLoadingPanel(
            proj.installStatus === 'installed' ? 'Checking outdated…' : 'Loading outdated…'
          )
    );

    if (proj._gitLoaded) {
      applyGitPanels(proj);
      return;
    }

    ui.panels.git.setContent(formatLoadingPanel('Loading git…'));
    ui.panels.gitFiles.setContent(formatLoadingPanel('Loading git…'));
    ui.panels.commits.setContent(formatLoadingPanel('Loading commits…'));
  }

  function refreshListItem(proj, { updateSummary = true } = {}) {
    const idx = state.filteredProjects.indexOf(proj);
    const listLen = ui.projectList.items?.length ?? 0;
    const filteredLen = state.filteredProjects.length;

    if (idx < 0) return;

    const canPatch = listLen === filteredLen && listLen > 0 && Boolean(ui.projectList.items?.[idx]);

    if (canPatch) {
      ui.projectList.setItem(idx, formatProjectListItem(proj, idx === state.selectedIdx));
    } else {
      ui.projectList.setItems(
        state.filteredProjects.length
          ? state.filteredProjects.map((p, i) => formatProjectListItem(p, i === state.selectedIdx))
          : ['{center}{gray-fg}Scanning…{/}{/center}']
      );
    }

    if (updateSummary) {
      ui.summaryBox.setContent(formatProjectSummary(state.filteredProjects, { scanning: state.scanning }));
    }

    scheduleRender();
  }

  function renderProjectList() {
    ui.projectList.setItems(
      state.filteredProjects.length
        ? state.filteredProjects.map((p, i) => formatProjectListItem(p, i === state.selectedIdx))
        : ['{center}{gray-fg}Scanning…{/}{/center}']
    );
    ui.summaryBox.setContent(formatProjectSummary(state.filteredProjects, { scanning: state.scanning }));
    updateHeader();
    scheduleRender();
  }

  function ensureInstallStatusEnrichment() {
    if (installEnrichmentActive) return;

    installEnrichmentActive = true;
    const gen = installToken.current();

    startInstallStatusEnrichment(() => state.allProjects, {
      shouldCancel: () => !installToken.isCurrent(gen),
      onUpdate: (proj) => {
        if (!installToken.isCurrent(gen)) return;

        if (proj) {
          refreshListItem(proj, { updateSummary: false });
          return;
        }

        installEnrichmentActive = false;
        ui.summaryBox.setContent(formatProjectSummary(state.filteredProjects, { scanning: state.scanning }));
        scheduleRender();
      },
    });
  }

  function loadOutdatedForSelected() {
    const proj = selectedProject();
    if (!proj) return;

    const loadId = detailToken.next();
    ui.panels.outdated.setContent(formatLoadingPanel('Checking outdated…'));
    scheduleRender();

    scheduleIdle(() => {
      if (!detailToken.isCurrent(loadId)) return;
      loadProjectFsMeta(proj);
      loadProjectOutdated(proj, { force: true });
      if (!detailToken.isCurrent(loadId)) return;

      applyOutdatedPanels(proj);
      scheduleRender();
      showToast(screen, ui.navFooter, `Outdated: ${proj.stats?.outdatedCount ?? 0} packages`, 'cyan', 2500);
    });
  }

  function updateDetails(proj) {
    if (!proj) return;

    const loadId = detailToken.next();
    fillDetailPanelsFast(proj);
    scheduleRender();

    loadProjectDetails(proj, {
      isCancelled: () => !detailToken.isCurrent(loadId),
      onFs: (p) => {
        fillDetailPanelsFast(p);
        refreshListItem(p);
      },
      onGit: (p) => {
        applyGitPanels(p);
        refreshListItem(p);
      },
      onOutdated: applyOutdatedPanels,
      onDone: scheduleRender,
    });
  }

  function refreshList() {
    applyFilters();
    renderProjectList();

    if (state.filteredProjects.length === 0) {
      ui.detailGrid.setLabel(' DETAILS ');
      for (const panel of Object.values(ui.panels)) {
        panel.setContent('{center}{yellow-fg}No projects found{/}{/center}');
      }
      return;
    }

    state.selectedIdx = Math.min(state.selectedIdx, state.filteredProjects.length - 1);
    ui.projectList.select(state.selectedIdx);
    updateDetails(state.filteredProjects[state.selectedIdx]);
  }

  async function doScan() {
    const gen = scanToken.next();
    installToken.next();
    installEnrichmentActive = false;
    detailToken.next();

    state.lastScanAt = Date.now();
    state.scanning = true;
    state.allProjects = [];
    state.filteredProjects = [];
    state.selectedIdx = 0;
    state.searchQuery = '';

    ui.header.setContent(formatTopHeader(0, 0));
    ui.projectList.setItems(['{center}{gray-fg}Scanning projects…{/}{/center}']);
    ui.summaryBox.setContent(formatProjectSummary([], { scanning: true }));
    ui.detailGrid.setLabel(' DETAILS ');

    for (const panel of Object.values(ui.panels)) {
      panel.setContent(formatLoadingPanel('Scanning…'));
    }

    ui.quickFooter.setContent(formatQuickActionsFooter());
    ui.navFooter.setContent('{gray-fg}Scanning…{/}');
    screen.render();

    let lastRender = 0;

    try {
      state.allProjects = await buildProjectsAsync(rootDir, excludeSet, {
        onBatch: (projects) => {
          if (!scanToken.isCurrent(gen)) return;

          state.allProjects = projects;
          applyFilters();

          if (projects.some((p) => !p._installLoaded)) {
            ensureInstallStatusEnrichment();
          }

          const now = Date.now();
          if (now - lastRender < SCAN_RENDER_MS && projects.length > 2) return;
          lastRender = now;
          renderProjectList();
        },
      });
    } catch (err) {
      showToast(screen, ui.navFooter, `Scan failed: ${err.message}`, 'red', 4000);
    }

    if (!scanToken.isCurrent(gen)) return;

    state.scanning = false;
    refreshList();
    ensureInstallStatusEnrichment();
    showToast(screen, ui.navFooter, `✓ Found ${state.allProjects.length} projects`, 'green');
  }

  async function runScript(script) {
    const proj = selectedProject();
    if (!proj) return showToast(screen, ui.navFooter, MSG.selectFirst, 'yellow');
    if (!canRunAction(proj, script)) {
      return showToast(screen, ui.navFooter, MSG.noScriptFor(actionLabel(script), proj.name), 'yellow');
    }

    const code = await executeAction(proj, script, {
      customPort: state.customPort,
      memoryGb: state.customMemoryGb,
      onBeforeLaunch: () => screen.destroy(),
    });
    process.exit(code);
  }

  async function pickAndRun() {
    const proj = selectedProject();
    if (!proj) return;

    const script = await showActionMenu(screen, proj);
    if (script) await runScript(script);
  }

  function openExplorer() {
    const proj = selectedProject();
    if (!proj) return;

    spawn('explorer', [proj.dir], { shell: true, detached: true, stdio: 'ignore' }).unref();
    showToast(screen, ui.navFooter, `Opened ${proj.relDir}`, 'cyan');
  }

  function openTerminal() {
    const proj = selectedProject();
    if (!proj) return;

    spawn('cmd', ['/c', 'start', 'cmd', '/k', `cd /d "${proj.dir}"`], {
      shell: true,
      detached: true,
      stdio: 'ignore',
    }).unref();
    showToast(screen, ui.navFooter, 'Terminal opened', 'cyan');
  }

  warmSystemInfoCache();

  ui.projectList.on('select item', (_, idx) => {
    state.selectedIdx = idx;
    updateDetails(state.filteredProjects[idx]);
  });

  screen.key(['enter'], () => {
    if (state.focusPanel === 'projects') pickAndRun();
  });

  screen.key(['tab'], () => {
    state.focusPanel = state.focusPanel === 'projects' ? 'details' : 'projects';
    if (state.focusPanel === 'projects') ui.projectList.focus();
    else ui.panels.scripts.focus();
    showToast(screen, ui.navFooter, `Panel: ${state.focusPanel}`, 'gray', 1200);
  });

  screen.key(['i', 'I'], () => runScript(ACTION.INSTALL));
  screen.key(['c'], () => runScript(ACTION.CI));
  screen.key(['d', 'D'], () => runScript('dev'));
  screen.key(['s', 'S'], () => runScript('start'));
  screen.key(['b', 'B'], () => runScript('build'));
  screen.key(['t', 'T'], () => openTerminal());
  screen.key(['e', 'E'], () => openExplorer());
  screen.key(['g', 'G'], () => {
    showToast(screen, ui.navFooter, `Git: ${selectedProject()?.git?.statusLabel || '—'}`, 'magenta', 3000);
  });
  screen.key(['u', 'U'], () => loadOutdatedForSelected());
  screen.key(['o', 'O'], () => pickAndRun());

  screen.key(['k', 'K'], async () => {
    const proj = selectedProject();
    if (!proj) return;

    const port = state.customPort ?? proj.port;
    const result = await killPort(port);

    if (result.wasFree) {
      showToast(screen, ui.navFooter, `Port ${port} is already free`, 'gray');
      return;
    }

    if (result.killed.length === 0) {
      showToast(screen, ui.navFooter, `No process found on port ${port}`, 'yellow');
      return;
    }

    if (result.nowFree) {
      showToast(screen, ui.navFooter, `Killed PID ${result.killed.join(', ')} on :${port}`, 'green');
      return;
    }

    showToast(screen, ui.navFooter, `Port ${port} still in use`, 'yellow');
  });

  screen.key(['p', 'P'], async () => {
    const proj = selectedProject();
    if (!proj) return;

    const value = await showPrompt(
      screen,
      { label: ' ⚙ Port ', style: { border: { fg: 'yellow' } } },
      `Port for ${proj.name}:`,
      String(state.customPort ?? proj.port)
    );
    if (value == null) return;

    const trimmed = String(value).trim();
    if (!trimmed) {
      state.customPort = await findFreePort(proj.port);
    } else {
      const num = parseInt(trimmed, 10);
      state.customPort = (num >= 1 && num <= 65535) ? num : proj.port;
      if (!(await isPortFree(state.customPort))) {
        state.customPort = await findFreePort(state.customPort);
      }
    }

    updateDetails(proj);
    showToast(screen, ui.navFooter, `Port: ${state.customPort}`, 'green');
  });

  screen.key(['m', 'M'], async () => {
    const info = getMemoryInfo();
    const value = await showPrompt(
      screen,
      { label: ' ⚙ Node Memory (GB) ', width: '62%', style: { border: { fg: 'yellow' } } },
      `Device RAM: ${info.deviceGb} GB  |  Safe: ${info.minGb}–${info.maxGb} GB  |  Default: ${info.deviceDefault} GB\n` +
      'Blank = default  |  "d" = reset to device default',
      String(state.customMemoryGb)
    );
    if (value == null) return;

    const trimmed = String(value).trim().toLowerCase();
    if (!trimmed) state.customMemoryGb = setMemoryGb(info.deviceDefault);
    else if (trimmed === 'd' || trimmed === 'default') state.customMemoryGb = resetMemoryGb();
    else state.customMemoryGb = setMemoryGb(clampMemoryGb(parseFloat(trimmed)));

    if (selectedProject()) {
      ui.panels.system.setContent(formatSystemStatus(getSystemInfo()));
    }

    showToast(
      screen,
      ui.navFooter,
      `Memory: ${state.customMemoryGb} GB (${Math.round(state.customMemoryGb * 1024)} MB)`,
      'green'
    );
  });

  screen.key(['r', 'R'], () => doScan());

  screen.key(['/'], async () => {
    const value = await showPrompt(
      screen,
      { label: ' 🔍 Search ' },
      'Filter:',
      state.searchQuery
    );
    if (value == null) return;

    state.searchQuery = String(value).trim().toLowerCase();
    state.selectedIdx = 0;
    refreshList();
  });

  screen.key(['escape'], () => {
    if (!state.searchQuery) return;
    state.searchQuery = '';
    state.selectedIdx = 0;
    refreshList();
  });

  screen.key(['question', '?'], () => showHelp(screen));
  screen.key(['q', 'C-c'], () => process.exit(0));

  setInterval(() => {
    ui.header.setContent(formatTopHeader(state.filteredProjects.length, scanAge()));
  }, 30000);

  ui.header.setContent(formatTopHeader(0, 0));
  ui.projectList.setItems(['{center}{gray-fg}Starting…{/}{/center}']);
  ui.summaryBox.setContent(formatProjectSummary([], { scanning: true }));
  ui.quickFooter.setContent(formatQuickActionsFooter());
  ui.navFooter.setContent('{gray-fg}Ready to scan…{/}');
  screen.render();

  ui.projectList.focus();
  setImmediate(() => doScan());
}
