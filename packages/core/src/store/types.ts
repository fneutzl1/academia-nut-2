import type { DatasetMeta } from '@academia-nut/shared';

/**
 * Where pulled datasets live. Both apps talk to this interface only, so the
 * local FileStore can be swapped for a Postgres-backed store on Heroku
 * (dyno filesystems are ephemeral and not shared between apps).
 */
export interface DatasetStore {
  list(): Promise<DatasetMeta[]>;
  read<T = unknown>(name: string): Promise<{ meta: DatasetMeta; rows: T[] } | null>;
  /** Replace a dataset atomically. The previous version is kept as a backup. */
  write<T>(name: string, rows: T[], sourceId: string): Promise<DatasetMeta>;
}
