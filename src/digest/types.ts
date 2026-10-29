// Types for the night's run log digest (plan.md § 1).
//
// Input: runs/<night>.jsonl, one JSON object per line:
//   { at, job, status: 'ok' | 'retry' | 'fail', owner: string | null, error?: string }
//
// Definitions (the reader and every view use these):
// - runs:      number of valid lines for the job (every attempt counts, retries included).
// - retries:   number of valid lines for the job with status 'retry'.
// - lastStatus: status of the job's last valid line (in file order).
// - lastError: error of the most recent valid line that had one, even if a later line
//              succeeded; null if no line for the job carried an error.
// - firstAt / lastAt: `at` of the job's first / last valid line, verbatim from the log
//              (offset kept, never converted to UTC).
// - owner:     owner of the job's last valid line; null is kept (views render it as `—`).
//
// A line that is not JSON, lacks a required field, or has an unknown status is a bad line:
// counted in `badLines`, never thrown. Blank lines are skipped and not counted.

export type RunStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

// `found: false` means there is no log file for the night (route: 404).
// `found: true` with `rows: []` is a night whose file exists but holds no valid lines.
// Rows are sorted by job.
export type NightDigest =
  | { found: false; night: string }
  | { found: true; night: string; rows: DigestRow[]; badLines: number };

// `night` is `YYYY-MM-DD`; anything else is treated as not found.
export type ReadNight = (runsDir: string, night: string) => NightDigest;
