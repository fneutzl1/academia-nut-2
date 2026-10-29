import { randomUUID } from 'node:crypto';
import type { DatasetStore } from '@academia-nut/core';
import type { RunStatus } from '@academia-nut/shared';
import type { CatalogWriter, Source, SourceContext } from './source.js';

const MAX_WARNINGS = 200;
const MAX_INVALID_EXAMPLES = 5;

/**
 * Run a source end to end. Never throws: failures are reported in the
 * returned status, and the stored dataset is only replaced on success.
 */
export async function runSource<Raw, Row>(
  source: Source<Raw, Row>,
  store: DatasetStore,
  onProgress: (status: RunStatus) => void = () => {},
  options: { catalog?: CatalogWriter } = {},
): Promise<RunStatus> {
  const status: RunStatus = {
    id: randomUUID(),
    sourceId: source.id,
    state: 'running',
    startedAt: new Date().toISOString(),
    fetched: 0,
    message: 'Starting',
    warnings: [],
  };
  const ctx: SourceContext = {
    warn(message) {
      if (status.warnings.length < MAX_WARNINGS) status.warnings.push(message);
    },
  };
  const finish = (state: RunStatus['state'], message: string) => {
    Object.assign(status, { state, message, finishedAt: new Date().toISOString() });
    onProgress(status);
    return status;
  };

  onProgress(status);

  try {
    let rows: Row[] = [];
    for await (const page of source.fetch(ctx)) {
      for (const raw of page.records) {
        const row = source.transform(raw, ctx);
        if (row !== null) rows.push(row);
      }
      status.fetched += page.records.length;
      status.total = page.total ?? status.total;
      status.message = `Fetched ${status.fetched}${status.total ? ` of ${status.total}` : ''}`;
      onProgress(status);
    }

    if (source.finalize) rows = source.finalize(rows, ctx);

    const invalid: string[] = [];
    rows.forEach((row, i) => {
      const result = source.schema.safeParse(row);
      if (!result.success) {
        const issues = result.error.issues.map((iss) => `${iss.path.join('.')} ${iss.message}`).join(', ');
        invalid.push(`row ${i}: ${issues}`);
      }
    });
    if (invalid.length > 0) {
      return finish('failed', `${invalid.length} rows failed validation. ${invalid.slice(0, MAX_INVALID_EXAMPLES).join('; ')}`);
    }

    const { minRows = 1, maxCountChange } = source.guard ?? {};
    if (rows.length < minRows) {
      return finish('failed', `Only ${rows.length} rows (minimum ${minRows})`);
    }
    if (maxCountChange !== undefined) {
      const previous = (await store.read(source.dataset))?.meta.rowCount ?? 0;
      const change = previous > 0 ? Math.abs(rows.length - previous) / previous : 0;
      if (change > maxCountChange) {
        return finish(
          'failed',
          `Row count ${rows.length} differs from previous ${previous} by ${(change * 100).toFixed(1)}% (limit ${maxCountChange * 100}%)`,
        );
      }
    }

    const meta = await store.write(source.dataset, rows, source.id);
    status.written = meta.rowCount;
    const wrote = `Wrote ${meta.rowCount} rows to ${source.dataset}`;

    if (source.catalog && options.catalog) {
      try {
        const result = await options.catalog(source.catalog, rows, { sourceId: source.id, runId: status.id });
        result.warnings.forEach((w) => ctx.warn(w));
        return finish('succeeded', `${wrote}; ${result.summary}`);
      } catch (err) {
        return finish('failed', `${wrote}, but the catalog write failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return finish('succeeded', wrote);
  } catch (err) {
    return finish('failed', err instanceof Error ? err.message : String(err));
  }
}
