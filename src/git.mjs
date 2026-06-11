import { execSync } from 'child_process';
import path from 'path';
import { exists } from './utils.mjs';

function git(dir, args, timeout = 1200) {
  try {
    return execSync(`git -C "${dir}" ${args}`, {
      encoding: 'utf8',
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    }).trim();
  } catch {
    return null;
  }
}

function relTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function parseStatusHeader(line) {
  let branch = 'HEAD';
  let remote = '—';
  let ahead = 0;
  let behind = 0;

  if (!line?.startsWith('##')) return { branch, remote, ahead, behind };

  const body = line.slice(3).trim();
  const bracket = body.indexOf(' [');
  const head = bracket >= 0 ? body.slice(0, bracket) : body;
  const meta = bracket >= 0 ? body.slice(bracket + 2, -1) : '';

  const dots = head.indexOf('...');
  if (dots >= 0) {
    branch = head.slice(0, dots) || 'HEAD';
    remote = head.slice(dots + 3) || '—';
  } else {
    branch = head || 'HEAD';
  }

  const aheadMatch = meta.match(/ahead (\d+)/);
  const behindMatch = meta.match(/behind (\d+)/);
  if (aheadMatch) ahead = parseInt(aheadMatch[1], 10) || 0;
  if (behindMatch) behind = parseInt(behindMatch[1], 10) || 0;

  return { branch, remote, ahead, behind };
}

export function detectGitInfo(dir) {
  const empty = {
    isRepo: false,
    branch: '—',
    status: 'none',
    statusLabel: 'No git',
    statusColor: 'gray',
    modified: 0,
    staged: 0,
    untracked: 0,
    ahead: 0,
    behind: 0,
    lastHash: '—',
    lastMessage: '—',
    lastWhen: '—',
    remote: '—',
    commits: [],
  };

  if (!exists(path.join(dir, '.git')) && !git(dir, 'rev-parse --git-dir')) {
    return empty;
  }

  const statusOut = git(dir, 'status -sb --porcelain') || '';
  const statusLines = statusOut.split('\n').filter(Boolean);
  const { branch, remote, ahead, behind } = parseStatusHeader(statusLines[0]);
  const porcelain = statusLines.slice(1);

  let modified = 0;
  let staged = 0;
  let untracked = 0;
  for (const line of porcelain) {
    const x = line[0];
    const y = line[1];
    if (x === '?' && y === '?') untracked++;
    else {
      if (x !== ' ' && x !== '?') staged++;
      if (y !== ' ' && y !== '?') modified++;
    }
  }

  const totalChanges = modified + staged + untracked;
  let statusLabel = 'Clean';
  let statusColor = 'green';
  let status = 'clean';

  if (totalChanges > 0) {
    statusLabel = `${totalChanges} change${totalChanges > 1 ? 's' : ''}`;
    statusColor = totalChanges >= 8 ? 'red' : 'yellow';
    status = 'dirty';
  } else if (ahead > 0) {
    statusLabel = `Ahead +${ahead}`;
    statusColor = 'cyan';
    status = 'ahead';
  } else if (behind > 0) {
    statusLabel = `Behind ${behind}`;
    statusColor = 'magenta';
    status = 'behind';
  }

  const logRaw = git(dir, 'log -5 --format=%h|%s|%ci|%cr') || '';
  const commits = logRaw.split('\n').filter(Boolean).map((line) => {
    const [hash, message, date, when] = line.split('|');
    return { hash, message: (message || '').slice(0, 36), when: when || relTime(date) };
  });

  const last = commits[0];
  const lastHash = last?.hash || '—';
  const lastMessage = last?.message || '—';
  const lastWhen = last?.when || '—';

  return {
    isRepo: true,
    branch,
    status,
    statusLabel,
    statusColor,
    modified,
    staged,
    untracked,
    ahead,
    behind,
    lastHash,
    lastMessage,
    lastWhen,
    remote: remote.replace(/^refs\/remotes\//, ''),
    commits,
  };
}

export function summarizeGit(projects) {
  const summary = { clean: 0, modified: 0, uncommitted: 0, ahead: 0, behind: 0, none: 0 };
  for (const p of projects) {
    const g = p.git;
    if (!g?.isRepo) { summary.none++; continue; }
    if (g.status === 'dirty') {
      if (g.untracked > 0) summary.uncommitted++;
      else summary.modified++;
    } else if (g.status === 'ahead') summary.ahead++;
    else if (g.status === 'behind') summary.behind++;
    else summary.clean++;
  }
  return summary;
}
