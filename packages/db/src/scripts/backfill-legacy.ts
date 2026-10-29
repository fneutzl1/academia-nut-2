/**
 * One-time import of the legacy explore-api JSON snapshots into catalog-year tables.
 *
 *   pnpm --filter @academia-nut/db backfill:legacy [path/to/explore-api-original/public/data]
 *
 * - years/2022-2023 … 2025-2026 are imported and marked COMPLETE (2021-2022 uses an older
 *   course shape and is deliberately skipped).
 * - The live top-level files seed the OPEN year 2026-2027 until the first real pull.
 * Safe to rerun: COMPLETE years are skipped, the open year only gets changed rows.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CourseSchema, DepartmentSchema, type Course, type Department } from '@academia-nut/shared';
import { createDb } from '../client.js';
import {
  completeCatalogYear,
  writeCourseYear,
  writeDepartmentYear,
  writeSubjectYear,
  type Provenance,
  type SubjectRow,
} from '../catalog.js';

const COMPLETE_YEARS = ['2022-2023', '2023-2024', '2024-2025', '2025-2026'];
const OPEN_YEAR = '2026-2027';
const ACTOR = 'legacy-backfill';

const rootEnv = path.resolve(import.meta.dirname, '../../../../.env');
if (fs.existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const dataDir = path.resolve(
  process.argv[2] ?? process.env.LEGACY_DATA_DIR ?? path.resolve(import.meta.dirname, '../../../../../explore-api-original/public/data'),
);

const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;

function loadCourses(dir: string): Course[] {
  // Pre-2025 snapshots have no syllabus key.
  return readJson<object[]>(path.join(dir, 'courses.json')).map((raw) => CourseSchema.parse({ syllabus: null, ...raw }));
}

interface LegacyDepartment {
  id: string;
  name: string;
  code?: string;
  link?: string;
  sub_departments?: string[];
  cscc_programs?: string[];
}

function loadDepartments(dir: string): Department[] {
  return readJson<LegacyDepartment[]>(path.join(dir, 'departmentList.json')).map((d) =>
    DepartmentSchema.parse({
      id: d.id,
      name: d.name,
      code: d.code,
      link: d.link,
      subDepartments: d.sub_departments ?? [],
      programIds: d.cscc_programs ?? [],
    }),
  );
}

function loadSubjects(dir: string): SubjectRow[] {
  return readJson<{ type: string; name: string }[]>(path.join(dir, 'subjects.json')).map((s) => ({ code: s.type, name: s.name }));
}

async function importYear(db: ReturnType<typeof createDb>, year: string, dir: string, provenance: Provenance) {
  for (const [label, run] of [
    ['subjects', () => writeSubjectYear(db, year, loadSubjects(dir), provenance)],
    ['departments', () => writeDepartmentYear(db, year, loadDepartments(dir), provenance)],
    ['courses', () => writeCourseYear(db, year, loadCourses(dir), provenance)],
  ] as const) {
    const r = await run();
    console.log(
      `${year} ${label.padEnd(11)} created ${r.created}, updated ${r.updated}, unchanged ${r.unchanged}, removed ${r.removed}`,
    );
    for (const w of r.warnings) console.warn(`  ! ${w}`);
  }
}

async function main() {
  if (!fs.existsSync(path.join(dataDir, 'years'))) throw new Error(`No legacy data at ${dataDir}`);
  const db = createDb();
  try {
    for (const year of COMPLETE_YEARS) {
      const existing = await db.catalogYear.findUnique({ where: { code: year } });
      if (existing?.status === 'COMPLETE') {
        console.log(`${year} already complete, skipped`);
        continue;
      }
      const provenance: Provenance = { origin: 'IMPORT', sourceId: `legacy:years/${year}`, actor: ACTOR };
      await importYear(db, year, path.join(dataDir, 'years', year), provenance);
      await completeCatalogYear(db, year, ACTOR);
    }
    await importYear(db, OPEN_YEAR, dataDir, { origin: 'IMPORT', sourceId: 'legacy:live', actor: ACTOR });
  } finally {
    await db.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
