import type { DatasetStore } from '@academia-nut/core';
import { runSource, type CatalogWriter, type Source } from '@academia-nut/pipeline';
import type { RunStatus } from '@academia-nut/shared';

const HISTORY_LIMIT = 50;

/**
 * In-memory run tracker. Fine for a single admin dyno; move to the store
 * (Postgres) when runs need to survive restarts or move to a worker dyno.
 */
export class RunRegistry {
  private runs: RunStatus[] = [];

  constructor(
    private readonly store: DatasetStore,
    private readonly catalog?: CatalogWriter,
  ) {}

  list(): RunStatus[] {
    return this.runs;
  }

  get(id: string): RunStatus | undefined {
    return this.runs.find((r) => r.id === id);
  }

  latestFor(sourceId: string): RunStatus | undefined {
    return this.runs.find((r) => r.sourceId === sourceId);
  }

  isRunning(sourceId: string): boolean {
    return this.latestFor(sourceId)?.state === 'running';
  }

  /** Start a run in the background and resolve once it is registered. */
  start(source: Source): Promise<RunStatus> {
    return new Promise((resolve) => {
      let registered = false;
      void runSource(source, this.store, (status) => {
        if (!registered) {
          registered = true;
          this.runs = [status, ...this.runs].slice(0, HISTORY_LIMIT);
          resolve(status);
        }
        if (status.state === 'failed') console.error(`[${source.id}] ${status.message}`);
      }, { catalog: this.catalog });
    });
  }
}
