import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { lane } from './lane.js';
import { readNight } from './digest/read.js';
import { readStatus } from './status.js';
import { Layout } from './views/layout.js';
import { DigestNotFound, DigestPage } from './views/digest.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const d = readNight(config.runsDir, c.req.param('night'));
    if (!d.found) {
      return c.html(
        <Layout title={`digest ${d.night}`} lane={lane()}>
          <DigestNotFound night={d.night} />
        </Layout>,
        404,
      );
    }
    return c.html(
      <Layout title={`digest ${d.night}`} lane={lane()}>
        <DigestPage night={d.night} rows={d.rows} badLines={d.badLines} />
      </Layout>,
    );
  });

  app.get('/api/digest/:night', (c) => {
    const d = readNight(config.runsDir, c.req.param('night'));
    if (!d.found) return c.json({ error: 'not found', night: d.night }, 404);
    return c.json({ night: d.night, rows: d.rows, badLines: d.badLines });
  });

  return app;
}
