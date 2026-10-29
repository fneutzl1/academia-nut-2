import fs from 'node:fs/promises';
import path from 'node:path';
import type { DatasetMeta } from '@academia-nut/shared';
import type { DatasetStore } from './types.js';

interface StoredFile<T> {
  meta: DatasetMeta;
  rows: T[];
}

const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

export class FileStore implements DatasetStore {
  // Cache parsed files by mtime so the API doesn't re-parse on every request
  private cache = new Map<string, { mtimeMs: number; data: StoredFile<unknown> }>();

  constructor(private readonly dir: string) {}

  private file(name: string): string {
    if (!NAME_RE.test(name)) throw new Error(`Invalid dataset name: ${name}`);
    return path.join(this.dir, `${name}.json`);
  }

  async list(): Promise<DatasetMeta[]> {
    await fs.mkdir(this.dir, { recursive: true });
    const entries = await fs.readdir(this.dir);
    const metas: DatasetMeta[] = [];
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue;
      const data = await this.read(entry.slice(0, -'.json'.length));
      if (data) metas.push(data.meta);
    }
    return metas;
  }

  async read<T = unknown>(name: string): Promise<StoredFile<T> | null> {
    const file = this.file(name);
    let stat;
    try {
      stat = await fs.stat(file);
    } catch {
      return null;
    }
    const cached = this.cache.get(name);
    if (cached && cached.mtimeMs === stat.mtimeMs) return cached.data as StoredFile<T>;

    const data = JSON.parse(await fs.readFile(file, 'utf8')) as StoredFile<T>;
    this.cache.set(name, { mtimeMs: stat.mtimeMs, data });
    return data;
  }

  async write<T>(name: string, rows: T[], sourceId: string): Promise<DatasetMeta> {
    const file = this.file(name);
    await fs.mkdir(path.join(this.dir, 'backups'), { recursive: true });

    const meta: DatasetMeta = { name, rowCount: rows.length, updatedAt: new Date().toISOString(), sourceId };
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify({ meta, rows }));

    try {
      const stamp = meta.updatedAt.replace(/[:.]/g, '-');
      await fs.copyFile(file, path.join(this.dir, 'backups', `${name}__${stamp}.json`));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }

    // rename is atomic on the same filesystem: readers see old or new, never partial
    await fs.rename(tmp, file);
    this.cache.delete(name);
    return meta;
  }
}
