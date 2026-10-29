import type { DatasetStore } from '@academia-nut/core';
import type { Course } from '@academia-nut/shared';
import compression from 'compression';
import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';

export interface ApiOptions {
  store: DatasetStore;
  corsOrigins: string[];
}

export function createApp({ store, corsOrigins }: ApiOptions) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(compression());
  app.use(cors({ origin: corsOrigins, methods: ['GET'] }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Dataset metadata: names, row counts and last-updated times (replaces legacy settings.json sync stamps)
  app.get('/api/datasets', async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=60');
    res.json(await store.list());
  });

  app.get('/api/datasets/:name', async (req, res) => {
    const data = await store.read(req.params.name);
    if (!data) {
      res.status(404).json({ error: `Unknown dataset ${req.params.name}` });
      return;
    }
    res.set('Cache-Control', 'public, max-age=300');
    res.set('Last-Modified', new Date(data.meta.updatedAt).toUTCString());
    res.json(data.rows);
  });

  app.get('/api/courses/:courseID', async (req, res) => {
    const id = req.params.courseID.toUpperCase();
    const data = await store.read<Course>('courses');
    const course = data?.rows.find((c) => c.courseID === id || c.noDash === id);
    if (!course) {
      res.status(404).json({ error: `Course ${req.params.courseID} not found` });
      return;
    }
    res.json(course);
  });

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error(err);
    res.status(err instanceof Error && err.message.startsWith('Invalid dataset name') ? 400 : 500).json({ error: 'Request failed' });
  };
  app.use(onError);

  return app;
}
