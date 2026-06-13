import { spawn } from 'child_process';
import { buildProjectsAsync } from '../scanner.mjs';
import { filterProjects } from '../project-filter.mjs';
import { createGenerationToken } from '../async.mjs';
import {
  applyProjectMetaFast,
  startInstallStatusEnrichment,
  loadProjectDetails,
} from './lazy-load.mjs';
import { executeAction } from './launch-flow.mjs';
import { getPortStatus, killPort, restoreStdinForPrompt, validatePort } from '../port.mjs';
import { getSystemInfo, warmSystemInfoCache } from '../system.mjs';
import { getMemoryGb, getMemoryInfo, setMemoryGb, clampMemoryGb, resetMemoryGb } from '../memory.mjs';
import { ACTION, canRunAction, actionLabel, needsPort } from '../project.mjs';
import { MSG } from '../messages.mjs';
import {
  formatTopHeader,
  formatProjectListItem,
  formatProjectsListHeader,
  formatBasicInfo,
  formatPackageStatus,
  formatScriptsPanel,
  formatSystemStatus,
  formatQuickActionsFooter,
  formatNavFooter,
  formatProjectsLabel,
  formatLoadingPanel,
} from './dashboard-format.mjs';
import { createBlessedScreen, createDashboardLayout } from './blessed-layout.mjs';
import {
  showToast,
  showActionMenu,
  showHelp,
  showPrompt,
  showPortLaunchConfirm,
  isModalActive,
  nextModalFrame,
} from './blessed-modals.mjs';

const SCAN_RENDER_MS = 250;

export async function runBlessedInteractive(rootDir, excludeSet) {
  const screen = createBlessedScreen();
  const ui = createDashboardLayout(screen);

  const state = {
    allProjects: [],
    filteredProjects: [],
    selectedIdx: 0,
    searchQuery: '',
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
    ui.projectHeader.setContent(formatProjectsListHeader());
    ui.projectList.setLabel(formatProjectsLabel(state.filteredProjects.length));
    ui.quickFooter.setContent(formatQuickActionsFooter());
    ui.navFooter.setContent(formatNavFooter(state.filteredProjects.length));
  }

  async function refreshPortStatus(proj, { retries = 4 } = {}) {
    if (!proj) return;

    let status = null;
    for (let i = 0; i < retries; i++) {
      status = await getPortStatus(proj.port);
      if (status.isFree || i === retries - 1) break;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    ui.panels.basic.setContent(
      formatBasicInfo(proj, null, status.valid ? status : null)
    );
    scheduleRender();
  }

  async function confirmPortForLaunch(proj) {
    const detected = proj.port;
    const status = await getPortStatus(detected);
    if (!status.valid) {
      showToast(screen, ui.navFooter, `Invalid port: ${detected}`, 'red');
      return null;
    }

    await nextModalFrame(screen);

    const value = await showPortLaunchConfirm(screen, {
      projectName: proj.name,
      detected,
      isFree: status.isFree,
      freePort: status.freePort,
      onPortFreed: () => refreshPortStatus(proj),
    });
    if (value == null) return null;

    const port = validatePort(String(value).trim());
    if (port == null) {
      showToast(screen, ui.navFooter, 'Invalid port (1–65535)', 'red');
      return null;
    }

    const chosen = await getPortStatus(port);
    if (!chosen.valid || !chosen.isFree) {
      const alt = chosen.valid ? chosen.freePort : port;
      showToast(screen, ui.navFooter, `Port ${port} is in use — try ${alt}`, 'yellow');
      return null;
    }

    return port;
  }

  function fillDetailPanelsFast(proj) {
    if (!proj) return;

    applyProjectMetaFast(proj);
    if (!state.cachedSystemInfo) state.cachedSystemInfo = getSystemInfo();

    ui.panels.basic.setContent(formatBasicInfo(proj));
    ui.panels.pkg.setLabel(` PACKAGE STATUS (${proj.pkgMgr}) `);
    ui.panels.pkg.setContent(formatPackageStatus(proj));
    ui.panels.scripts.setContent(formatScriptsPanel(proj));
    ui.panels.system.setContent(formatSystemStatus(state.cachedSystemInfo));
    refreshPortStatus(proj);
  }

  function refreshListItem(proj) {
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

    if (selectedProject() === proj) {
      fillDetailPanelsFast(proj);
    }

    scheduleRender();
  }

  function autoLoadSelectedDetails() {
    if (state.filteredProjects.length === 0) return;

    state.selectedIdx = Math.min(state.selectedIdx, state.filteredProjects.length - 1);
    ui.projectList.select(state.selectedIdx);
    updateDetails(state.filteredProjects[state.selectedIdx]);
  }

  function renderProjectList() {
    ui.projectList.setItems(
      state.filteredProjects.length
        ? state.filteredProjects.map((p, i) => formatProjectListItem(p, i === state.selectedIdx))
        : ['{center}{gray-fg}Scanning…{/}{/center}']
    );
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
          refreshListItem(proj);
          return;
        }

        installEnrichmentActive = false;
        scheduleRender();
      },
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
      onDone: scheduleRender,
    });
  }

  function refreshList() {
    applyFilters();
    renderProjectList();

    if (state.filteredProjects.length === 0) {
      for (const panel of Object.values(ui.panels)) {
        panel.setContent('{center}{yellow-fg}No projects found{/}{/center}');
      }
      return;
    }

    autoLoadSelectedDetails();
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
          autoLoadSelectedDetails();
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

    let launchPort = null;
    if (needsPort(script)) {
      launchPort = await confirmPortForLaunch(proj);
      if (launchPort == null) return;
    }

    const code = await executeAction(proj, script, {
      customPort: launchPort,
      memoryGb: state.customMemoryGb,
      fromTui: true,
      onBeforeLaunch: async () => {
        screen.destroy();
        await restoreStdinForPrompt();
      },
    });
    process.exit(code);
  }

  async function pickAndRun() {
    if (isModalActive()) return;

    const proj = selectedProject();
    if (!proj) return;

    const script = await showActionMenu(screen, proj);
    if (!script) return;

    await nextModalFrame(screen);
    await runScript(script);
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

  const DBL_CLICK_MS = 450;
  let listClickState = { idx: -1, count: 0, timer: null };

  function onProjectListActivate(idx) {
    if (idx !== listClickState.idx) {
      clearTimeout(listClickState.timer);
      listClickState = {
        idx,
        count: 1,
        timer: setTimeout(() => {
          listClickState = { idx: -1, count: 0, timer: null };
        }, DBL_CLICK_MS),
      };
      return;
    }

    listClickState.count += 1;
    if (listClickState.count >= 2) {
      clearTimeout(listClickState.timer);
      listClickState = { idx: -1, count: 0, timer: null };
      pickAndRun();
    }
  }

  ui.projectList.on('select item', (_, idx) => {
    state.selectedIdx = idx;
    updateDetails(state.filteredProjects[idx]);
    onProjectListActivate(idx);
  });

  ui.projectList.on('action', (_, idx) => {
    onProjectListActivate(idx ?? state.selectedIdx);
  });

  screen.key(['enter'], () => {
    if (isModalActive()) return;
    if (state.focusPanel === 'projects') pickAndRun();
  });

  screen.key(['tab'], () => {
    state.focusPanel = state.focusPanel === 'projects' ? 'details' : 'projects';
    if (state.focusPanel === 'projects') ui.projectList.focus();
    else ui.panels.scripts.focus();
    showToast(screen, ui.navFooter, `Panel: ${state.focusPanel}`, 'gray', 1200);
  });

  screen.key(['i', 'I'], () => runScript(ACTION.INSTALL));
  screen.key(['u', 'U'], () => runScript(ACTION.REINIT));
  screen.key(['c'], () => runScript(ACTION.CI));
  screen.key(['d', 'D'], () => runScript('dev'));
  screen.key(['s', 'S'], () => pickAndRun());
  screen.key(['b', 'B'], () => runScript('build'));
  screen.key(['t', 'T'], () => openTerminal());
  screen.key(['e', 'E'], () => openExplorer());

  screen.key(['k', 'K'], async () => {
    const proj = selectedProject();
    if (!proj) return;

    const port = proj.port;
    const result = await killPort(port);
    await refreshPortStatus(proj);

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

  screen.key(['o', 'O'], () => runScript('start'));

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
    if (isModalActive()) return;
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
  ui.projectHeader.setContent(formatProjectsListHeader());
  ui.projectList.setItems(['{center}{gray-fg}Starting…{/}{/center}']);
  ui.quickFooter.setContent(formatQuickActionsFooter());
  ui.navFooter.setContent('{gray-fg}Ready to scan…{/}');
  screen.render();

  ui.projectList.focus();
  setImmediate(() => doScan());
}
