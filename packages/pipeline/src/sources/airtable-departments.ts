import { DepartmentSchema, type Department } from '@academia-nut/shared';
import { airtablePages, type AirtableRecord } from '../connectors/airtable.js';
import { defineSource } from '../source.js';

const PROGRAMS_BASE = 'appVA4fDbPROOgy8R';

interface DepartmentFields {
  Name?: string;
  Code?: string;
  'Sub Departments'?: string[];
  'CSCC Programs'?: string[];
  'Department Homepage'?: string;
}

export const airtableDepartments = defineSource<AirtableRecord<DepartmentFields>, Department>({
  id: 'airtable-departments',
  service: 'airtable',
  dataset: 'departments',
  description: 'Department list side-loaded from the Airtable programs base',
  fetch: () => airtablePages<DepartmentFields>(PROGRAMS_BASE, 'Department'),
  transform: ({ id, fields }, ctx) => {
    if (!fields.Name) {
      ctx.warn(`Skipped Airtable department ${id}: no Name`);
      return null;
    }
    return {
      id,
      name: fields.Name,
      code: fields.Code,
      subDepartments: fields['Sub Departments'] ?? [],
      programIds: fields['CSCC Programs'] ?? [],
      link: fields['Department Homepage'],
    };
  },
  schema: DepartmentSchema,
  guard: { maxCountChange: 0.25 },
});
