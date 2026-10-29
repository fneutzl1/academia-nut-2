import type { DatasetStore } from '@academia-nut/core';
import {
  getCourseDetail,
  getCourseForYear,
  listCatalogYears,
  listCourses,
  listDepartments,
  type PrismaClient,
} from '@academia-nut/db';
import type { Course } from '@academia-nut/shared';
import compression from 'compression';
import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';

export interface ApiOptions {
  store: DatasetStore;
  corsOrigins: string[];
  /** Catalog-year tables (Postgres). The /api/catalog routes 503 without it. */
  db?: PrismaClient;
}

export function createApp({ store, corsOrigins, db }: ApiOptions) {
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

  // Year-versioned catalog data from Postgres
  const catalog = express.Router();
  catalog.use((_req, res, next) => {
    if (db) return next();
    res.status(503).json({ error: 'Catalog database not configured' });
  });
  catalog.get('/years', async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=60');
    res.json(await listCatalogYears(db!));
  });
  catalog.get('/years/:year/courses', async (req, res) => {
    res.set('Cache-Control', 'public, max-age=60');
    res.json(await listCourses(db!, req.params.year));
  });
  catalog.get('/years/:year/courses/:code', async (req, res) => {
    const course = await getCourseForYear(db!, req.params.year, req.params.code);
    if (!course) {
      res.status(404).json({ error: `Course ${req.params.code} not found in ${req.params.year}` });
      return;
    }
    res.set('Cache-Control', 'public, max-age=60');
    res.json(course);
  });
  catalog.get('/years/:year/departments', async (req, res) => {
    res.set('Cache-Control', 'public, max-age=60');
    res.json(await listDepartments(db!, req.params.year));
  });
  catalog.get('/courses/:id', async (req, res) => {
    const detail = await getCourseDetail(db!, req.params.id);
    if (!detail) {
      res.status(404).json({ error: 'Unknown course' });
      return;
    }
    res.set('Cache-Control', 'public, max-age=60');
    res.json(detail);
  });
  app.use('/api/catalog', catalog);

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error(err);
    res.status(err instanceof Error && err.message.startsWith('Invalid dataset name') ? 400 : 500).json({ error: 'Request failed' });
  };
  app.use(onError);

  return app;
}
