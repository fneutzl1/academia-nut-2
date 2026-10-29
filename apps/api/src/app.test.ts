import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FileStore } from '@academia-nut/core';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';

let dir: string;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'an-api-'));
  const store = new FileStore(dir);
  await store.write('courses', [{ courseID: 'ASC-1190', noDash: 'ASC1190', name: 'Critical Thinking' }], 'test');
  app = createApp({ store, corsOrigins: [] });
});

afterAll(() => fs.rm(dir, { recursive: true, force: true }));

describe('api', () => {
  it('lists datasets', async () => {
    const res = await request(app).get('/api/datasets').expect(200);
    expect(res.body).toMatchObject([{ name: 'courses', rowCount: 1 }]);
  });

  it('serves a dataset', async () => {
    const res = await request(app).get('/api/datasets/courses').expect(200);
    expect(res.body).toHaveLength(1);
  });

  it('finds a course by either id form', async () => {
    await request(app).get('/api/courses/asc-1190').expect(200);
    await request(app).get('/api/courses/ASC1190').expect(200);
    await request(app).get('/api/courses/NOPE-1').expect(404);
  });

  it('404s unknown datasets and 400s bad names', async () => {
    await request(app).get('/api/datasets/nope').expect(404);
    await request(app).get('/api/datasets/Bad..Name').expect(400);
  });
});
