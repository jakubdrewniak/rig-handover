import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLine } from './read.js';

export type NightCounts = { night: string; ok: number; retry: number; fail: number };

// Counts valid lines by their own status (not per job). Bad lines are not counted.
export function countNight(runsDir: string, night: string): NightCounts {
  const counts: NightCounts = { night, ok: 0, retry: 0, fail: 0 };
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return counts;
  }
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (line) counts[line.status] += 1;
  }
  return counts;
}
