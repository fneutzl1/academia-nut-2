// DTOs exchanged between the admin server and the admin UI.

export type RunState = 'queued' | 'running' | 'succeeded' | 'failed';

export interface RunStatus {
  id: string;
  sourceId: string;
  state: RunState;
  startedAt: string;
  finishedAt?: string;
  fetched: number;
  total?: number;
  written?: number;
  message: string;
  warnings: string[];
}

export interface SourceInfo {
  id: string;
  service: string;
  dataset: string;
  description: string;
  lastRun?: RunStatus;
}

export interface DatasetMeta {
  name: string;
  rowCount: number;
  updatedAt: string;
  sourceId: string;
}
