import type { z } from 'zod';

export interface SourceContext {
  /** Record a non-fatal problem; surfaced in the run status. */
  warn(message: string): void;
}

/**
 * The single shape every data pull takes, whatever the service:
 *
 *   fetch()     yields pages of raw vendor records (connector handles paging/auth)
 *   transform() maps one raw record to one flat row (return null to skip)
 *   finalize()  optional pass over all rows (cross-row work like slug lookups)
 *   schema      every row must pass before anything is written
 *   guard       sanity checks against the previous version of the dataset
 */
export interface Source<Raw = unknown, Row = unknown> {
  id: string;
  service: string;
  dataset: string;
  description: string;
  fetch(ctx: SourceContext): AsyncIterable<{ records: Raw[]; total?: number }>;
  transform(raw: Raw, ctx: SourceContext): Row | null;
  finalize?(rows: Row[], ctx: SourceContext): Row[];
  schema: z.ZodType<Row>;
  guard?: {
    /** Fail if the row count changes by more than this fraction vs the last run. */
    maxCountChange?: number;
    minRows?: number;
  };
}

export function defineSource<Raw, Row>(source: Source<Raw, Row>): Source<Raw, Row> {
  return source;
}
