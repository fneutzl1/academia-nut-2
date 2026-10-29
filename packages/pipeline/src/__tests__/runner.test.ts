import type { DatasetMeta } from '@academia-nut/shared';
import type { DatasetStore } from '@academia-nut/core';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { runSource } from '../runner.js';
import { defineSource } from '../source.js';

function memoryStore(initial: Record<string, unknown[]> = {}): DatasetStore & { data: Record<string, unknown[]> } {
  const data = { ...initial };
  const meta = (name: string): DatasetMeta => ({ name, rowCount: data[name]!.length, updatedAt: '', sourceId: 'test' });
  return {
    data,
    async list() { return Object.keys(data).map(meta); },
    async read<T>(name: string) { return data[name] ? { meta: meta(name), rows: data[name] as T[] } : null; },
    async write(name, rows) { data[name] = rows; return meta(name); },
  };
}

const numbers = (values: unknown[], guard = {}) =>
  defineSource<unknown, { n: number }>({
    id: 'numbers',
    service: 'test',
    dataset: 'numbers',
    description: '',
    async *fetch() {
      yield { records: values.slice(0, 2), total: values.length };
      yield { records: values.slice(2), total: values.length };
    },
    transform: (raw) => (raw === null ? null : { n: raw as number }),
    schema: z.object({ n: z.number() }),
    guard,
  });

describe('runSource', () => {
  it('pages, transforms, skips nulls and writes', async () => {
    const store = memoryStore();
    const progress: string[] = [];
    const status = await runSource(numbers([1, null, 3]), store, (s) => progress.push(s.message));

    expect(status.state).toBe('succeeded');
    expect(store.data.numbers).toEqual([{ n: 1 }, { n: 3 }]);
    expect(progress).toContain('Fetched 2 of 3');
  });

  it('does not write when any row fails validation', async () => {
    const store = memoryStore({ numbers: [{ n: 9 }] });
    const status = await runSource(numbers([1, 'two', 3]), store);

    expect(status.state).toBe('failed');
    expect(status.message).toMatch(/1 rows failed validation/);
    expect(store.data.numbers).toEqual([{ n: 9 }]);
  });

  it('enforces the count-change guard against the previous dataset', async () => {
    const store = memoryStore({ numbers: Array.from({ length: 10 }, (_, n) => ({ n })) });
    const status = await runSource(numbers([1, 2, 3], { maxCountChange: 0.15 }), store);

    expect(status.state).toBe('failed');
    expect(status.message).toMatch(/differs from previous 10/);
  });

  it('reports fetch errors as a failed run', async () => {
    const source = { ...numbers([]), fetch: async function* () { throw new Error('HTTP 500'); } };
    const status = await runSource(source, memoryStore());
    expect(status).toMatchObject({ state: 'failed', message: 'HTTP 500' });
  });
  it('also writes catalog-year rows when the source has a catalog table and a writer is given', async () => {
    const store = memoryStore();
    const calls: unknown[] = [];
    const source = { ...numbers([1, 2]), catalog: 'courses' as const };
    const status = await runSource(source, store, () => {}, {
      catalog: async (table, rows, run) => {
        calls.push({ table, rows, sourceId: run.sourceId });
        return { summary: '2026-2027 courses: 2 new', warnings: ['heads up'] };
      },
    });

    expect(status.state).toBe('succeeded');
    expect(calls).toEqual([{ table: 'courses', rows: [{ n: 1 }, { n: 2 }], sourceId: 'numbers' }]);
    expect(status.message).toMatch(/2026-2027 courses: 2 new/);
    expect(status.warnings).toContain('heads up');
  });

  it('fails the run (JSON already written) when the catalog write throws', async () => {
    const store = memoryStore();
    const source = { ...numbers([1]), catalog: 'courses' as const };
    const status = await runSource(source, store, () => {}, {
      catalog: async () => {
        throw new Error('Catalog year 2025-2026 is complete');
      },
    });

    expect(status.state).toBe('failed');
    expect(status.message).toMatch(/catalog write failed: Catalog year 2025-2026 is complete/);
    expect(store.data.numbers).toEqual([{ n: 1 }]);
  });
});
