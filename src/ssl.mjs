import fs from 'fs';
import path from 'path';
import { X509Certificate } from 'node:crypto';
import selfsigned from 'selfsigned';
import { CONFIG_FILE, loadConfig, saveConfig } from './config.mjs';

export const MIN_EXPIRY_DAYS = 7;
export const EXPIRY_UNITS = ['day', 'week', 'month', 'year'];

export const EXPIRY_UNIT_ALIASES = {
  d: 'day',
  day: 'day',
  days: 'day',
  w: 'week',
  week: 'week',
  weeks: 'week',
  m: 'month',
  month: 'month',
  months: 'month',
  y: 'year',
  year: 'year',
  years: 'year',
};

export const DEFAULT_EXPIRY = { value: 1, unit: 'year' };

const UNIT_DAYS = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};

export const CERT_DIR = 'certs';
export const CERT_FILE = 'localhost.pem';
export const KEY_FILE = 'localhost-key.pem';

function normalizeUnit(unit) {
  const key = String(unit || '').toLowerCase();
  return EXPIRY_UNIT_ALIASES[key] || null;
}

export function unitToDays(value, unit) {
  const normalized = normalizeUnit(unit);
  if (!normalized) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * UNIT_DAYS[normalized]);
}

export function clampExpiry({ value, unit }) {
  const normalized = normalizeUnit(unit);
  if (!normalized) return { ...DEFAULT_EXPIRY, days: unitToDays(DEFAULT_EXPIRY.value, DEFAULT_EXPIRY.unit) };

  let days = unitToDays(value, normalized);
  if (days == null) return { ...DEFAULT_EXPIRY, days: unitToDays(DEFAULT_EXPIRY.value, DEFAULT_EXPIRY.unit) };

  if (days < MIN_EXPIRY_DAYS) {
    return { value: MIN_EXPIRY_DAYS, unit: 'day', days: MIN_EXPIRY_DAYS };
  }

  return { value: Math.round(Number(value)), unit: normalized, days };
}

export function parseExpiry(input) {
  const trimmed = String(input ?? '').trim().toLowerCase();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?$/);
  if (!match) return null;

  const value = parseFloat(match[1]);
  if (Number.isNaN(value) || value <= 0) return null;

  const unit = match[2] ? normalizeUnit(match[2]) : 'day';
  if (!unit) return null;

  return clampExpiry({ value, unit });
}

export function formatExpiry({ value, unit }) {
  const label = value === 1 ? unit : `${unit}s`;
  return `${value} ${label}`;
}

function readExpiryFromConfig(config = loadConfig()) {
  const raw = config.sslExpiry;
  if (!raw || raw.value == null || !raw.unit) {
    return { ...DEFAULT_EXPIRY, days: unitToDays(DEFAULT_EXPIRY.value, DEFAULT_EXPIRY.unit) };
  }
  return clampExpiry(raw);
}

export function getSslExpiry() {
  return readExpiryFromConfig();
}

export function setSslExpiry(expiry) {
  const clamped = clampExpiry(expiry);
  const config = loadConfig();
  config.sslExpiry = { value: clamped.value, unit: clamped.unit };
  saveConfig(config);
  return clamped;
}

export function resetSslExpiry() {
  const config = loadConfig();
  delete config.sslExpiry;
  saveConfig(config);
  return readExpiryFromConfig();
}

export function getSslExpiryInfo() {
  const current = getSslExpiry();
  const isCustom = loadConfig().sslExpiry != null;

  return {
    current,
    defaultExpiry: DEFAULT_EXPIRY,
    minDays: MIN_EXPIRY_DAYS,
    units: EXPIRY_UNITS,
    isCustom,
    configPath: CONFIG_FILE,
  };
}

export function hasSslSupport() {
  return true;
}

export function getCertPaths(projectDir) {
  const dir = path.join(projectDir, CERT_DIR);
  return {
    dir,
    cert: path.join(dir, CERT_FILE),
    key: path.join(dir, KEY_FILE),
  };
}

export function readCertExpiry(certPath) {
  try {
    const cert = new X509Certificate(fs.readFileSync(certPath));
    return new Date(cert.validTo);
  } catch {
    return null;
  }
}

export function getExistingCertInfo(projectDir) {
  const paths = getCertPaths(projectDir);
  if (!fs.existsSync(paths.cert) || !fs.existsSync(paths.key)) return null;

  const expiresAt = readCertExpiry(paths.cert);
  return {
    ...paths,
    expiresAt,
    expiresLabel: expiresAt ? expiresAt.toLocaleDateString() : 'unknown',
  };
}

export function getSslStatus(projectDir) {
  const existing = getExistingCertInfo(projectDir);
  if (!existing) {
    return { state: 'none', expiresAt: null, expiresLabel: null, daysLeft: null };
  }

  if (!existing.expiresAt) {
    return { state: 'unknown', ...existing, daysLeft: null };
  }

  const daysLeft = Math.ceil((existing.expiresAt.getTime() - Date.now()) / 86400000);

  if (isCertExpired(existing.expiresAt)) {
    return { state: 'expired', ...existing, daysLeft };
  }

  return { state: 'valid', ...existing, daysLeft };
}

export function formatSslStatusBlessed(status) {
  switch (status.state) {
    case 'valid':
      return `{green-fg}valid until ${status.expiresLabel}{/}  {gray-fg}(${status.daysLeft}d){/}`;
    case 'expired':
      return `{red-fg}expired ${status.expiresLabel}{/}  {gray-fg}(press H to renew){/}`;
    case 'unknown':
      return '{yellow-fg}present (expiry unknown){/}';
    default:
      return '{yellow-fg}none{/}  {gray-fg}(press H to create){/}';
  }
}

function hostsToAltNames(hosts) {
  const altNames = [];
  for (const host of hosts) {
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) {
      altNames.push({ type: 7, ip: host });
    } else {
      altNames.push({ type: 2, value: host });
    }
  }
  return altNames;
}

export function isCertExpired(expiresAt, now = Date.now()) {
  if (!expiresAt) return true;
  return expiresAt.getTime() <= now;
}

function shouldRenewCert(existing, { force, expiry }) {
  if (!existing) return false;
  if (force) return true;
  if (expiry != null) return true;
  if (isCertExpired(existing.expiresAt)) return true;
  return false;
}

async function generateCertPems(hosts, days) {
  const names = hosts.length ? hosts : ['localhost', '127.0.0.1'];
  const cn = names.find((host) => !/^\d/.test(host)) || names[0] || 'localhost';
  const notAfterDate = new Date();
  notAfterDate.setDate(notAfterDate.getDate() + days);

  return selfsigned.generate(
    [{ name: 'commonName', value: cn }],
    {
      algorithm: 'sha256',
      keySize: 2048,
      notAfterDate,
      extensions: [
        { name: 'basicConstraints', cA: false },
        { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
        { name: 'extKeyUsage', serverAuth: true, clientAuth: true },
        {
          name: 'subjectAltName',
          altNames: hostsToAltNames(names),
        },
      ],
    }
  );
}

export async function createSslCertificate(projectDir, { expiry, force = false, hosts = ['localhost', '127.0.0.1'] } = {}) {
  const paths = getCertPaths(projectDir);
  const existing = getExistingCertInfo(projectDir);

  if (existing && !shouldRenewCert(existing, { force, expiry })) {
    return {
      ok: true,
      created: false,
      renewed: false,
      skipped: true,
      ...paths,
      existing,
      expiry: readExpiryFromConfig(),
      days: null,
      expiresAt: existing.expiresAt,
    };
  }

  const resolved = clampExpiry(expiry ?? getSslExpiry());
  const isRenewal = Boolean(existing);

  try {
    fs.mkdirSync(paths.dir, { recursive: true });
    const pems = await generateCertPems(hosts, resolved.days);
    fs.writeFileSync(paths.cert, pems.cert, 'utf8');
    fs.writeFileSync(paths.key, pems.private, 'utf8');
  } catch (err) {
    return { ok: false, error: err.message || 'SSL certificate generation failed' };
  }

  const expiresAt = readCertExpiry(paths.cert) || new Date(Date.now() + resolved.days * 86400000);

  return {
    ok: true,
    created: true,
    renewed: isRenewal,
    skipped: false,
    ...paths,
    expiry: { value: resolved.value, unit: resolved.unit },
    days: resolved.days,
    expiresAt,
    hosts,
    previousExpiresAt: existing?.expiresAt ?? null,
  };
}

export function formatSslResult(result) {
  if (!result.ok) return result.error;

  const expiryText = result.expiresAt
    ? result.expiresAt.toLocaleDateString()
    : 'unknown';

  if (result.skipped) {
    return `Certificate already exists (expires ${expiryText})\n  cert: ${result.cert}\n  key:  ${result.key}`;
  }

  const duration = result.expiry ? formatExpiry(result.expiry) : `${result.days} days`;
  const verb = result.renewed ? 'Renewed' : 'Created';
  return `${verb} SSL certificate (${duration}, expires ${expiryText})\n  cert: ${result.cert}\n  key:  ${result.key}`;
}
