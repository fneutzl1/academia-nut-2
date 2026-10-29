import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FileStore } from '@academia-nut/core';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';

let dir: string;
let app: ReturnType<typeof createApp>;
const auth = { Authorization: 'Bearer secret' };

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'an-admin-'));
  app = createApp({ store: new FileStore(dir), adminToken: 'secret', publicApiUrl: 'http://api.test' });
});

afterAll(() => fs.rm(dir, { recursive: true, force: true }));

describe('admin', () => {
  it('requires the token', async () => {
    await request(app).get('/admin-api/sources').expect(401);
    await request(app).get('/admin-api/sources').set({ Authorization: 'Bearer wrong!' }).expect(401);
  });

  it('exposes runtime config without auth', async () => {
    const res = await request(app).get('/admin-api/config').expect(200);
    expect(res.body).toEqual({ publicApiUrl: 'http://api.test' });
  });

  it('lists registered sources', async () => {
    const res = await request(app).get('/admin-api/sources').set(auth).expect(200);
    expect(res.body.map((s: { id: string }) => s.id)).toContain('curricunet-courses');
  });

  it('reports change history as unavailable without a database', async () => {
    const res = await request(app).get('/admin-api/catalog/courses/x/changes').set(auth).expect(503);
    expect(res.body.error).toMatch(/DATABASE_URL/);
  });

  it('404s unknown sources', async () => {
    await request(app).post('/admin-api/sources/nope/runs').set(auth).expect(404);
  });
});
