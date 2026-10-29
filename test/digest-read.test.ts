import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');
  if (!night.found) throw new Error('fixture night not found');

  it('has 5 jobs, sorted by job, and 1 bad line', () => {
    expect(night.badLines).toBe(1);
    expect(night.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('counts runs and retries, keeps the last error and the offsets', () => {
    const fixtures = night.rows.find((r) => r.job === 'fixtures/refresh');
    expect(fixtures).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    const sync = night.rows.find((r) => r.job === 'lane/sync');
    expect(sync).toMatchObject({ runs: 8, retries: 1, lastStatus: 'ok', lastError: 'lock held' });
    expect(sync?.firstAt).toBe('2026-10-28T23:00:06+01:00');
  });

  it('keeps a fail and a null owner', () => {
    expect(night.rows.find((r) => r.job === 'notes/backup')).toMatchObject({
      lastStatus: 'fail',
      lastError: 'quota exceeded',
      owner: 'lane-07',
    });
    expect(night.rows.find((r) => r.job === 'digest/render')).toMatchObject({
      owner: null,
      lastError: null,
      runs: 1,
    });
  });
});

describe('readNight edge cases', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('reports a missing file as not found', () => {
    expect(readNight(dir, '2026-01-01')).toEqual({ found: false, night: '2026-01-01' });
  });

  it('treats a malformed night as not found', () => {
    expect(readNight(dir, '../runs/2026-10-28')).toMatchObject({ found: false });
  });

  it('reads an empty file as found with no rows', () => {
    writeFileSync(join(dir, '2026-01-02.jsonl'), '');
    expect(readNight(dir, '2026-01-02')).toEqual({ found: true, night: '2026-01-02', rows: [], badLines: 0 });
  });

  it('counts invalid lines (bad JSON, missing fields, bad status) without throwing', () => {
    writeFileSync(
      join(dir, '2026-01-03.jsonl'),
      [
        '{"at":"2026-01-03T01:00:00+01:00","job":"a","status":"ok","owner":null}',
        'not json',
        '{"at":"2026-01-03T01:00:00+01:00","job":"a","status":"maybe","owner":null}',
        '{"job":"a","status":"ok","owner":null}',
        '[1,2]',
        '',
      ].join('\n'),
    );
    const n = readNight(dir, '2026-01-03');
    expect(n).toMatchObject({ found: true, badLines: 4 });
    expect(n.found && n.rows).toHaveLength(1);
  });
});
