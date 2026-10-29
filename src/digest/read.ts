import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, NightDigest, ReadNight, RunStatus } from './types.js';

// Definitions of runs / retries / lastError etc. are in ./types.ts.

type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error: string | null;
};

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isStatus(v: unknown): v is RunStatus {
  return v === 'ok' || v === 'retry' || v === 'fail';
}

// Parse one log line at the edge; null means a bad line.
export function parseLine(line: string): RunLine | null {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isRecord(raw)) return null;
  const { at, job, status, owner, error } = raw;
  if (typeof at !== 'string' || at === '') return null;
  if (typeof job !== 'string' || job === '') return null;
  if (!isStatus(status)) return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && error !== null && typeof error !== 'string') return null;
  return { at, job, status, owner, error: typeof error === 'string' ? error : null };
}

export function digestLines(lines: RunLine[]): DigestRow[] {
  const byJob = new Map<string, DigestRow>();
  for (const l of lines) {
    const row = byJob.get(l.job);
    if (!row) {
      byJob.set(l.job, {
        job: l.job,
        owner: l.owner,
        runs: 1,
        retries: l.status === 'retry' ? 1 : 0,
        lastStatus: l.status,
        lastError: l.error,
        firstAt: l.at,
        lastAt: l.at,
      });
      continue;
    }
    row.owner = l.owner;
    row.runs += 1;
    if (l.status === 'retry') row.retries += 1;
    row.lastStatus = l.status;
    if (l.error !== null) row.lastError = l.error;
    row.lastAt = l.at;
  }
  return [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
}

export const readNight: ReadNight = (runsDir, night): NightDigest => {
  if (!NIGHT.test(night)) return { found: false, night };
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (e) {
    if (isRecord(e) && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) return { found: false, night };
    throw e;
  }
  const lines: RunLine[] = [];
  let badLines = 0;
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const parsed = parseLine(raw);
    if (parsed) lines.push(parsed);
    else badLines += 1;
  }
  return { found: true, night, rows: digestLines(lines), badLines };
};
