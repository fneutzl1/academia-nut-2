import { requireEnv } from '@academia-nut/core';
import { getJson } from './http.js';

// ---- Raw vendor shapes (only the parts we read) ----

export interface CurricunetField {
  attributes: { displayName: string; fieldName?: string; isLookUpField?: boolean };
  fieldValue?: unknown;
  lookUpDisplay?: string;
}

export interface CurricunetSection {
  attributes: {
    sectionName: string;
    sectionOrInstance?: 'section' | 'sectionInstance';
    oneToManySection?: boolean;
    instanceId?: number;
    instanceSortOrder?: number;
  };
  fields?: CurricunetField[];
  subsections?: CurricunetSection[];
}

export interface CurricunetEntity {
  attributes: { entityId: number; entityType: string };
  entityMetadata: { entityTitle: string; status: string; [key: string]: unknown };
  entityFormData?: { rootSections?: CurricunetSection[] };
}

interface CurricunetResponse {
  resultSetMetadata: { StartResultNum: number; EndResultNum: number; TotalNumberOfResults: number };
  entityInstances: CurricunetEntity[];
}

const API_PATH = '/scripts/webservices/generic_meta/clients/versions/v4/cscc.cfc';

export interface CurricunetPagesOptions {
  method: 'getCourses' | 'getPrograms';
  status?: 'Active' | 'All';
  pageSize?: number;
}

/** Yields pages from the Curricunet generic_meta API until all results are read. */
export async function* curricunetPages({ method, status = 'Active', pageSize = 100 }: CurricunetPagesOptions) {
  const host = process.env.CURRIC_HOST ?? 'mws.services.curriqunet.com';
  const auth = Buffer.from(`${requireEnv('CURRIC_USER')}:${requireEnv('CURRIC_PASS')}`).toString('base64');

  let skip = 0;
  for (;;) {
    const params = new URLSearchParams({ method, returnFormat: 'JSON', top: String(pageSize) });
    if (skip > 0) params.set('skip', String(skip));
    if (status !== 'All') params.set('status', status);

    const data = await getJson<CurricunetResponse>(`https://${host}${API_PATH}?${params}`, {
      headers: { Authorization: `Basic ${auth}` },
      timeoutMs: 120_000,
    });
    if (!data?.resultSetMetadata || !Array.isArray(data.entityInstances)) {
      throw new Error(`Unexpected Curricunet response shape at skip=${skip}`);
    }

    const { EndResultNum, TotalNumberOfResults } = data.resultSetMetadata;
    yield { records: data.entityInstances, total: TotalNumberOfResults };

    if (EndResultNum >= TotalNumberOfResults || data.entityInstances.length === 0) return;
    skip += pageSize;
  }
}

// ---- Helpers for reading the nested form data by name, not position ----

function descendants(sections: CurricunetSection[] = []): CurricunetSection[] {
  return sections.flatMap((s) => [s, ...descendants(s.subsections)]);
}

/** First section with this name, searched depth-first. */
export function findSection(
  root: CurricunetEntity | CurricunetSection | undefined,
  name: string,
): CurricunetSection | undefined {
  if (!root) return undefined;
  const sections = 'entityMetadata' in root ? descendants(root.entityFormData?.rootSections) : descendants(root.subsections);
  return sections.find((s) => s.attributes.sectionName === name);
}

/** Every field in a section and its descendants, in document order. */
export function fieldsIn(section: CurricunetSection | undefined): CurricunetField[] {
  if (!section) return [];
  return [...(section.fields ?? []), ...(section.subsections ?? []).flatMap(fieldsIn)];
}

/** Find a field by display name. Pass several names to absorb vendor renames. */
export function field(section: CurricunetSection | undefined, ...names: string[]): CurricunetField | undefined {
  return fieldsIn(section).find((f) => names.includes(f.attributes.displayName));
}

export function num(f: CurricunetField | undefined): number {
  const n = Number(f?.fieldValue);
  return Number.isFinite(n) ? n : 0;
}

/** Like num(), but keeps a blank vendor value as '' (legacy output shape). */
export function numOrBlank(f: CurricunetField | undefined): number | '' {
  return f?.fieldValue === '' ? '' : num(f);
}

export function str(f: CurricunetField | undefined): string {
  return f?.fieldValue == null ? '' : String(f.fieldValue);
}
