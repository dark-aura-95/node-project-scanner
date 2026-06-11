import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { fg, R, DIM, B, cursor } from './theme.mjs';

const CONFIG_DIR = path.join(os.homedir(), '.nps');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const MIN_GB = 1;
const RESERVED_GB = 2;

export function getDeviceMemoryGb() {
  return Math.round((os.totalmem() / 1024 ** 3) * 10) / 10;
}

export function getSafeLimits() {
  const deviceGb = getDeviceMemoryGb();
  const maxGb = Math.max(MIN_GB, Math.round((deviceGb - RESERVED_GB) * 10) / 10);
  return { minGb: MIN_GB, maxGb, deviceGb, reservedGb: RESERVED_GB };
}

export function getDefaultMemoryGb() {
  const { deviceGb, maxGb } = getSafeLimits();
  const suggested = Math.min(12, Math.round(deviceGb * 0.75 * 10) / 10);
  return Math.min(maxGb, Math.max(MIN_GB, suggested));
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig(config) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function clampMemoryGb(gb) {
  const { minGb, maxGb } = getSafeLimits();
  const n = parseFloat(gb);
  if (Number.isNaN(n)) return getDefaultMemoryGb();
  return Math.round(Math.min(maxGb, Math.max(minGb, n)) * 10) / 10;
}

export function getMemoryGb() {
  const config = loadConfig();
  if (config.memoryGb != null) return clampMemoryGb(config.memoryGb);
  return getDefaultMemoryGb();
}

export function setMemoryGb(gb) {
  const clamped = clampMemoryGb(gb);
  saveConfig({ ...loadConfig(), memoryGb: clamped });
  return clamped;
}

export function resetMemoryGb() {
  const config = loadConfig();
  delete config.memoryGb;
  saveConfig(config);
  return getDefaultMemoryGb();
}

export function memoryMb(gb) {
  return Math.round((gb ?? getMemoryGb()) * 1024);
}

export function getMemoryInfo() {
  const limits = getSafeLimits();
  const deviceDefault = getDefaultMemoryGb();
  const current = getMemoryGb();
  const isCustom = loadConfig().memoryGb != null;

  return {
    ...limits,
    deviceDefault,
    current,
    currentMb: memoryMb(current),
    isCustom,
    configPath: CONFIG_FILE,
  };
}

export function buildNodeOptions(gb) {
  const mb = memoryMb(gb ?? getMemoryGb());
  const existing = (process.env.NODE_OPTIONS || '').replace(/--max-old-space-size=\d+/g, '').trim();
  const heap = `--max-old-space-size=${mb}`;
  return existing ? `${heap} ${existing}` : heap;
}

export function askMemory(currentGb) {
  const info = getMemoryInfo();
  const cur = currentGb ?? info.current;

  return new Promise((resolve) => {
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    cursor.show();

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    rl.question(
      `\n  ${B}${fg.bcyan}⚙ Node Memory (GB)${R}\n` +
      `  ${DIM}Device RAM:{R} ${info.deviceGb} GB  ${DIM}Safe range:{R} ${info.minGb}–${info.maxGb} GB\n` +
      `  ${DIM}Recommended:{R} ${info.deviceDefault} GB  ${DIM}Current:{R} ${cur} GB\n` +
      `  ${DIM}Enter GB, blank = recommended (${info.deviceDefault}), "d" = device default:{R} `,
      (answer) => {
        rl.close();
        const trimmed = answer.trim().toLowerCase();
        if (!trimmed) {
          resolve(info.deviceDefault);
          return;
        }
        if (trimmed === 'd' || trimmed === 'default') {
          resolve(resetMemoryGb());
          return;
        }
        const num = parseFloat(trimmed);
        resolve(clampMemoryGb(num));
      }
    );
  });
}

export function formatMemoryStatus() {
  const info = getMemoryInfo();
  const tag = info.isCustom ? `${fg.yellow}custom${R}` : `${fg.green}auto${R}`;
  return `${info.current} GB (${info.currentMb} MB) [${tag}]`;
}
