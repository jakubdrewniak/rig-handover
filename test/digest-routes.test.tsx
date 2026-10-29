import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestRow } from '../src/digest/types.js';

const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const l = (at: string, job: string, status: string, owner: string | null, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error ? { error } : {}) });

writeFileSync(join(dir, '2026-01-01.jsonl'), [
  l('2026-01-01T01:00:00+01:00', 'b/job', 'retry', null, 'boom'),
  l('2026-01-01T01:05:00+01:00', 'b/job', 'retry', null),
  l('2026-01-01T01:06:00+01:00', 'b/job', 'retry', null),
  l('2026-01-01T01:07:00+01:00', 'b/job', 'fail', null),
  l('2026-01-01T02:00:00+01:00', 'a/job', 'ok', 'rook'),
  'not json',
].join('\n') + '\n');
writeFileSync(join(dir, '2026-01-02.jsonl'), '');
writeFileSync(join(dir, '2026-01-03.jsonl'), l('2026-01-03T01:00:00+01:00', 'x', 'ok', 'rook') + '\n{bad\n');

const config = { adapter: 'shim', installed: 'x', beatEverySeconds: 60, runsDir: dir };
const app = createApp(config);

describe('digest page', () => {
  it('renders a sorted table with warnings and dashes', async () => {
    const res = await app.request('/digest/2026-01-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('lane-07');
    expect(html.indexOf('a/job')).toBeLessThan(html.indexOf('b/job'));
    expect(html).toContain('class="warn"');
    expect(html).toContain('—');
    expect(html).toContain('1 line could not be read');
  });

  it('404s a night with no file', async () => {
    const res = await app.request('/digest/2026-01-09');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('lane-07');
  });

  it('says nothing ran for an empty night', async () => {
    const res = await app.request('/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('reports a bad line', async () => {
    const html = await (await app.request('/digest/2026-01-03')).text();
    expect(html).toContain('1 line could not be read');
  });
});

describe('digest json', () => {
  it('returns rows and badLines; same jobs in same order as the page', async () => {
    const res = await app.request('/api/digest/2026-01-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { night: string; rows: DigestRow[]; badLines: number };
    expect(body.night).toBe('2026-01-01');
    expect(body.badLines).toBe(1);
    const jobs = body.rows.map((r) => r.job);
    expect(jobs).toEqual(['a/job', 'b/job']);
    const html = await (await app.request('/digest/2026-01-01')).text();
    expect(html.indexOf(jobs[0]!)).toBeLessThan(html.indexOf(jobs[1]!));
  });

  it('404s as JSON', async () => {
    const res = await app.request('/api/digest/2026-01-09');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'not found' });
  });

  it('empty night gives empty rows', async () => {
    const body = (await (await app.request('/api/digest/2026-01-02')).json()) as { rows: unknown[] };
    expect(body.rows).toEqual([]);
  });
});

describe('status board links', () => {
  it('links each night with counts', async () => {
    const html = await (await app.request('/')).text();
    expect(html).toContain('href="/digest/2026-01-01"');
    expect(html).toContain('href="/digest/2026-01-03"');
    expect(html).toMatch(/2026-01-01<\/a> · ok 1 · retry 3 · fail 1/);
  });
});
