import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileStore } from '../file-store.js';

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'an-store-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('FileStore', () => {
  it('writes, reads and lists datasets', async () => {
    const store = new FileStore(dir);
    await store.write('courses', [{ id: 1 }, { id: 2 }], 'test');

    const data = await store.read<{ id: number }>('courses');
    expect(data?.rows).toEqual([{ id: 1 }, { id: 2 }]);
    expect(data?.meta.rowCount).toBe(2);
    expect((await store.list()).map((m) => m.name)).toEqual(['courses']);
  });

  it('backs up the previous version on overwrite', async () => {
    const store = new FileStore(dir);
    await store.write('courses', [{ id: 1 }], 'test');
    await store.write('courses', [{ id: 2 }], 'test');

    expect((await store.read('courses'))?.rows).toEqual([{ id: 2 }]);
    expect(await fs.readdir(path.join(dir, 'backups'))).toHaveLength(1);
  });

  it('rejects path-like dataset names', async () => {
    const store = new FileStore(dir);
    await expect(store.read('../secrets')).rejects.toThrow('Invalid dataset name');
  });
});
