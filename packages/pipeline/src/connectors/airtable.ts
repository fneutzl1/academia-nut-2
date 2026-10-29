import { requireEnv } from '@academia-nut/core';
import { getJson } from './http.js';

export interface AirtableRecord<F = Record<string, unknown>> {
  id: string;
  fields: F;
}

/** Yields pages of records from one Airtable table, following `offset`. */
export async function* airtablePages<F = Record<string, unknown>>(baseId: string, table: string) {
  const token = requireEnv('AIRTABLE_TOKEN');
  let offset: string | undefined;
  do {
    const params = new URLSearchParams(offset ? { offset } : {});
    const data = await getJson<{ records: AirtableRecord<F>[]; offset?: string }>(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?${params}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    yield { records: data.records };
    offset = data.offset;
  } while (offset);
}
