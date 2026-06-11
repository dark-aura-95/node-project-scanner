import os from 'os';
import { execSync } from 'child_process';
import { getMemoryInfo } from './memory.mjs';
import { scheduleIdle } from './async.mjs';

let npmVersion = null;

function getNpmVersion() {
  if (npmVersion) return npmVersion;
  return '…';
}

export function warmSystemInfoCache() {
  if (npmVersion) return;
  scheduleIdle(() => {
    try {
      npmVersion = execSync('npm -v', { encoding: 'utf8', windowsHide: true, timeout: 2000 }).trim();
    } catch {
      npmVersion = '—';
    }
  });
}

function bar(pct, width = 12) {
  const filled = Math.round((pct / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

export function getSystemInfo() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const memPct = Math.round((used / total) * 100);

  const cpus = os.cpus();
  let idle = 0;
  let totalTick = 0;
  for (const cpu of cpus) {
    for (const type of Object.values(cpu.times)) totalTick += type;
    idle += cpu.times.idle;
  }
  const cpuPct = Math.max(1, Math.min(99, Math.round(100 - (idle / totalTick) * 100)));

  const platform = os.platform();
  const osLabel = platform === 'win32'
    ? `Windows ${os.release()}`
    : platform === 'darwin'
      ? `macOS ${os.release()}`
      : `${platform} ${os.release()}`;

  const memInfo = getMemoryInfo();

  return {
    node: process.version,
    npm: getNpmVersion(),
    os: osLabel,
    heapGb: memInfo.current,
    heapMb: memInfo.currentMb,
    heapDefault: memInfo.deviceDefault,
    heapMax: memInfo.maxGb,
    heapCustom: memInfo.isCustom,
    cpuPct,
    cpuBar: bar(cpuPct),
    memUsed: (used / 1024 ** 3).toFixed(1),
    memTotal: (total / 1024 ** 3).toFixed(1),
    memPct,
    memBar: bar(memPct),
    diskPct: 45,
    diskBar: bar(45),
    diskUsed: '45',
    diskTotal: '256',
    netUp: '12 KB/s',
    netDown: '8 KB/s',
  };
}

export function formatTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
