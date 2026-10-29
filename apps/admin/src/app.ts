import { timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { DatasetStore } from '@academia-nut/core';
import { listCourseChanges, type PrismaClient } from '@academia-nut/db';
import { getSource, sources, type CatalogWriter } from '@academia-nut/pipeline';
import type { SourceInfo } from '@academia-nut/shared';
import express, { type RequestHandler } from 'express';
import helmet from 'helmet';
import { RunRegistry } from './runs.js';

export interface AdminOptions {
  store: DatasetStore;
  catalog?: CatalogWriter;
  /** Catalog-year tables (change history). Optional until Postgres is required. */
  db?: PrismaClient;
  adminToken: string;
  publicApiUrl: string;
  webDist?: string;
}

// Placeholder auth: a shared bearer token. Swap for SSO/session auth before real use.
function requireToken(token: string): RequestHandler {
  const expected = Buffer.from(`Bearer ${token}`);
  return (req, res, next) => {
    const given = Buffer.from(req.get('authorization') ?? '');
    if (given.length === expected.length && timingSafeEqual(given, expected)) return next();
    res.status(401).json({ error: 'Unauthorized' });
  };
}

export function createApp({ store, catalog, db, adminToken, publicApiUrl, webDist }: AdminOptions) {
  const runs = new RunRegistry(store, catalog);
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Unauthenticated: the UI needs this before it has a token
  app.get('/admin-api/config', (_req, res) => {
    res.json({ publicApiUrl });
  });

  const api = express.Router();
  api.use(requireToken(adminToken));

  api.get('/sources', (_req, res) => {
    const body: SourceInfo[] = sources.map((s) => ({
      id: s.id,
      service: s.service,
      dataset: s.dataset,
      description: s.description,
      lastRun: runs.latestFor(s.id),
    }));
    res.json(body);
  });

  api.post('/sources/:id/runs', async (req, res) => {
    const source = getSource(req.params.id);
    if (!source) {
      res.status(404).json({ error: `Unknown source ${req.params.id}` });
      return;
    }
    if (runs.isRunning(source.id)) {
      res.status(409).json({ error: `${source.id} is already running`, run: runs.latestFor(source.id) });
      return;
    }
    res.status(202).json(await runs.start(source));
  });

  api.get('/runs', (_req, res) => {
    res.json(runs.list());
  });

  api.get('/runs/:id', (req, res) => {
    const run = runs.get(req.params.id);
    if (!run) {
      res.status(404).json({ error: 'Unknown run' });
      return;
    }
    res.json(run);
  });

  api.get('/datasets', async (_req, res) => {
    res.json(await store.list());
  });

  // Change history for the Catalog browser. The data itself is read from the public API.
  api.get('/catalog/courses/:id/changes', async (req, res) => {
    if (!db) {
      res.status(503).json({ error: 'Catalog database not configured (set DATABASE_URL)' });
      return;
    }
    res.json(await listCourseChanges(db, req.params.id));
  });

  app.use('/admin-api', api);

  // In production the built Vue app is served from here; in dev Vite serves it
  if (webDist && fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  return app;
}
