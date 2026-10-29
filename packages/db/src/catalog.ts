import type { Course, Department } from '@academia-nut/shared';
import { Prisma, type CatalogYear, type PrismaClient, type RecordOrigin } from './generated/client.js';
import { contentHash, courseToVersionContent, versionToCourse } from './course-mapping.js';

type Tx = Prisma.TransactionClient;

export interface Provenance {
  origin: RecordOrigin;
  /** Pipeline source id, e.g. "curricunet-courses". */
  sourceId?: string;
  sourceRunId?: string;
  /** Person making a MANUAL change. */
  actor?: string;
  /** When the data was pulled; defaults to now. */
  pulledAt?: Date;
}

export interface YearWriteResult {
  year: string;
  created: number;
  updated: number;
  unchanged: number;
  removed: number;
  warnings: string[];
}

export interface SubjectRow {
  code: string;
  name: string;
}

export const COURSE_CODE = 'course-code';
export const CURRICUNET_ENTITY = 'curricunet-entity';
export const AIRTABLE = 'airtable';

const YEAR_RE = /^(\d{4})-(\d{4})$/;
// A full year is a few thousand statements; Prisma's 5s default is far too short.
const TX_OPTIONS = { timeout: 120_000, maxWait: 10_000 };

export function parseYearCode(code: string): number {
  const m = YEAR_RE.exec(code);
  if (!m || Number(m[2]) !== Number(m[1]) + 1) throw new Error(`Invalid catalog year "${code}", expected e.g. 2025-2026`);
  return Number(m[1]);
}

export async function ensureCatalogYear(db: PrismaClient | Tx, code: string): Promise<CatalogYear> {
  const startYear = parseYearCode(code);
  return db.catalogYear.upsert({ where: { code }, update: {}, create: { code, startYear } });
}

/** The newest OPEN catalog year: where live pulls write. */
export async function openCatalogYear(db: PrismaClient | Tx): Promise<CatalogYear> {
  const year = await db.catalogYear.findFirst({ where: { status: 'OPEN' }, orderBy: { startYear: 'desc' } });
  if (!year) throw new Error('No OPEN catalog year. Create one in admin before pulling.');
  return year;
}

async function writableYear(tx: Tx, code: string): Promise<CatalogYear> {
  const year = await ensureCatalogYear(tx, code);
  if (year.status === 'COMPLETE') throw new Error(`Catalog year ${code} is complete; its data is frozen`);
  return year;
}

const versionProvenance = (p: Provenance) => ({
  origin: p.origin,
  sourceId: p.sourceId ?? null,
  sourceRunId: p.sourceRunId ?? null,
  pulledAt: p.origin === 'MANUAL' ? null : (p.pulledAt ?? new Date()),
  updatedBy: p.origin === 'MANUAL' ? (p.actor ?? null) : null,
});

const logEntry = (
  entityType: string,
  entityId: string,
  yearId: number,
  action: 'create' | 'update' | 'remove',
  p: Provenance,
  before: unknown,
  after: unknown,
): Prisma.ChangeLogCreateManyInput => ({
  entityType,
  entityId,
  catalogYearId: yearId,
  action,
  origin: p.origin,
  actor: p.actor ?? p.sourceId ?? null,
  sourceRunId: p.sourceRunId ?? null,
  before: before === null ? Prisma.DbNull : (before as Prisma.InputJsonValue),
  after: after === null ? Prisma.DbNull : (after as Prisma.InputJsonValue),
});

/** Map of identifier value → owning entity id, for one identifier system. */
async function identifierMap(tx: Tx, model: 'course' | 'department', system: string): Promise<Map<string, string>> {
  const rows =
    model === 'course'
      ? (await tx.courseIdentifier.findMany({ where: { system } })).map((r) => [r.value, r.courseId] as const)
      : (await tx.departmentIdentifier.findMany({ where: { system } })).map((r) => [r.value, r.departmentId] as const);
  return new Map(rows);
}

/**
 * Replace one catalog year's courses with `courses` (the full set from a pull or snapshot).
 *
 * Identity: a course resolves by Curricunet entityId first, then course code, so a course
 * renumbered in the vendor keeps its persistent id. New codes / entity ids are recorded
 * as identifiers. Versions whose content hash is unchanged are not touched. Courses missing
 * from `courses` lose their version for this year (PULL/IMPORT rows only; MANUAL rows stay).
 * Every change is appended to ChangeLog. Refuses COMPLETE years.
 */
export async function writeCourseYear(
  db: PrismaClient,
  yearCode: string,
  courses: Course[],
  provenance: Provenance,
): Promise<YearWriteResult> {
  return db.$transaction(async (tx) => {
    const year = await writableYear(tx, yearCode);
    const result: YearWriteResult = { year: yearCode, created: 0, updated: 0, unchanged: 0, removed: 0, warnings: [] };
    const byCode = await identifierMap(tx, 'course', COURSE_CODE);
    const byEntity = await identifierMap(tx, 'course', CURRICUNET_ENTITY);
    const existing = new Map(
      (await tx.courseVersion.findMany({ where: { catalogYearId: year.id } })).map((v) => [v.courseId, v]),
    );
    const seen = new Set<string>();
    const changes: Prisma.ChangeLogCreateManyInput[] = [];

    for (const course of courses) {
      const entityKey = course.syllabus ? String(course.syllabus.entityId) : undefined;
      const codeOwner = byCode.get(course.courseID);
      const entityOwner = entityKey ? byEntity.get(entityKey) : undefined;
      if (codeOwner && entityOwner && codeOwner !== entityOwner) {
        result.warnings.push(
          `${course.courseID}: code and Curricunet entity ${entityKey} point at different courses; using the code`,
        );
      }
      let courseId = codeOwner && entityOwner && codeOwner !== entityOwner ? codeOwner : (entityOwner ?? codeOwner);

      if (!courseId) {
        courseId = (await tx.course.create({ data: {} })).id;
      }
      if (seen.has(courseId)) {
        result.warnings.push(`${course.courseID}: resolves to a course already written this year; skipped`);
        continue;
      }
      seen.add(courseId);
      if (!codeOwner) {
        await tx.courseIdentifier.create({ data: { courseId, system: COURSE_CODE, value: course.courseID } });
        byCode.set(course.courseID, courseId);
      }
      if (entityKey && !entityOwner) {
        await tx.courseIdentifier.create({ data: { courseId, system: CURRICUNET_ENTITY, value: entityKey } });
        byEntity.set(entityKey, courseId);
      }

      const content = courseToVersionContent(course);
      const hash = contentHash(versionToCourse(content));
      const data = {
        ...content,
        requisites: content.requisites as Prisma.InputJsonValue,
        restrictions: content.restrictions as Prisma.InputJsonValue,
        contactHours: content.contactHours as Prisma.InputJsonValue,
        syllabus: content.syllabus === null ? Prisma.JsonNull : (content.syllabus as Prisma.InputJsonValue),
        contentHash: hash,
        ...versionProvenance(provenance),
      };
      const before = existing.get(courseId);
      if (!before) {
        await tx.courseVersion.create({ data: { ...data, courseId, catalogYearId: year.id } });
        changes.push(logEntry('course', courseId, year.id, 'create', provenance, null, versionToCourse(content)));
        result.created++;
      } else if (before.contentHash !== hash) {
        await tx.courseVersion.update({ where: { id: before.id }, data });
        changes.push(
          logEntry('course', courseId, year.id, 'update', provenance, versionToCourse(before), versionToCourse(content)),
        );
        result.updated++;
      } else {
        result.unchanged++;
      }
    }

    for (const [courseId, version] of existing) {
      if (seen.has(courseId) || version.origin === 'MANUAL') continue;
      await tx.courseVersion.delete({ where: { id: version.id } });
      changes.push(logEntry('course', courseId, year.id, 'remove', provenance, versionToCourse(version), null));
      result.removed++;
    }

    if (changes.length) await tx.changeLog.createMany({ data: changes });
    return result;
  }, TX_OPTIONS);
}

/** Replace one catalog year's departments. Identity is the Airtable record id (stable across years). */
export async function writeDepartmentYear(
  db: PrismaClient,
  yearCode: string,
  departments: Department[],
  provenance: Provenance,
): Promise<YearWriteResult> {
  return db.$transaction(async (tx) => {
    const year = await writableYear(tx, yearCode);
    const result: YearWriteResult = { year: yearCode, created: 0, updated: 0, unchanged: 0, removed: 0, warnings: [] };
    const byAirtable = await identifierMap(tx, 'department', AIRTABLE);
    const existing = new Map(
      (await tx.departmentVersion.findMany({ where: { catalogYearId: year.id } })).map((v) => [v.departmentId, v]),
    );
    const seen = new Set<string>();
    const changes: Prisma.ChangeLogCreateManyInput[] = [];

    for (const dept of departments) {
      let departmentId = byAirtable.get(dept.id);
      if (!departmentId) {
        departmentId = (await tx.department.create({ data: {} })).id;
        await tx.departmentIdentifier.create({ data: { departmentId, system: AIRTABLE, value: dept.id } });
        byAirtable.set(dept.id, departmentId);
      }
      if (seen.has(departmentId)) {
        result.warnings.push(`Department ${dept.id} appears twice; skipped the duplicate`);
        continue;
      }
      seen.add(departmentId);

      const content = {
        name: dept.name,
        code: dept.code ?? null,
        link: dept.link ?? null,
        subDepartments: dept.subDepartments,
        programIds: dept.programIds,
      };
      const hash = contentHash(content);
      const data = { ...content, contentHash: hash, ...versionProvenance(provenance) };
      const before = existing.get(departmentId);
      if (!before) {
        await tx.departmentVersion.create({ data: { ...data, departmentId, catalogYearId: year.id } });
        changes.push(logEntry('department', departmentId, year.id, 'create', provenance, null, content));
        result.created++;
      } else if (before.contentHash !== hash) {
        await tx.departmentVersion.update({ where: { id: before.id }, data });
        changes.push(logEntry('department', departmentId, year.id, 'update', provenance, departmentContent(before), content));
        result.updated++;
      } else {
        result.unchanged++;
      }
    }

    for (const [departmentId, version] of existing) {
      if (seen.has(departmentId) || version.origin === 'MANUAL') continue;
      await tx.departmentVersion.delete({ where: { id: version.id } });
      changes.push(logEntry('department', departmentId, year.id, 'remove', provenance, departmentContent(version), null));
      result.removed++;
    }

    if (changes.length) await tx.changeLog.createMany({ data: changes });
    return result;
  }, TX_OPTIONS);
}

const departmentContent = (v: {
  name: string;
  code: string | null;
  link: string | null;
  subDepartments: string[];
  programIds: string[];
}) => ({ name: v.name, code: v.code, link: v.link, subDepartments: v.subDepartments, programIds: v.programIds });

/** Replace one catalog year's subjects. A subject's code is its identity. */
export async function writeSubjectYear(
  db: PrismaClient,
  yearCode: string,
  subjects: SubjectRow[],
  provenance: Provenance,
): Promise<YearWriteResult> {
  return db.$transaction(async (tx) => {
    const year = await writableYear(tx, yearCode);
    const result: YearWriteResult = { year: yearCode, created: 0, updated: 0, unchanged: 0, removed: 0, warnings: [] };
    const existing = new Map(
      (await tx.subjectVersion.findMany({ where: { catalogYearId: year.id } })).map((v) => [v.subjectId, v]),
    );
    const seen = new Set<string>();
    const changes: Prisma.ChangeLogCreateManyInput[] = [];

    for (const s of subjects) {
      const subject = await tx.subject.upsert({ where: { code: s.code }, update: {}, create: { code: s.code } });
      if (seen.has(subject.id)) {
        result.warnings.push(`Subject ${s.code} appears twice; skipped the duplicate`);
        continue;
      }
      seen.add(subject.id);

      const content = { code: s.code, name: s.name };
      const hash = contentHash(content);
      const data = { name: s.name, contentHash: hash, ...versionProvenance(provenance) };
      const before = existing.get(subject.id);
      if (!before) {
        await tx.subjectVersion.create({ data: { ...data, subjectId: subject.id, catalogYearId: year.id } });
        changes.push(logEntry('subject', subject.id, year.id, 'create', provenance, null, content));
        result.created++;
      } else if (before.contentHash !== hash) {
        await tx.subjectVersion.update({ where: { id: before.id }, data });
        changes.push(logEntry('subject', subject.id, year.id, 'update', provenance, { code: s.code, name: before.name }, content));
        result.updated++;
      } else {
        result.unchanged++;
      }
    }

    for (const [subjectId, version] of existing) {
      if (seen.has(subjectId) || version.origin === 'MANUAL') continue;
      await tx.subjectVersion.delete({ where: { id: version.id } });
      changes.push(logEntry('subject', subjectId, year.id, 'remove', provenance, { name: version.name }, null));
      result.removed++;
    }

    if (changes.length) await tx.changeLog.createMany({ data: changes });
    return result;
  }, TX_OPTIONS);
}

/** Freeze a catalog year: its version rows become read-only. Done by a person in admin. */
export async function completeCatalogYear(db: PrismaClient, code: string, actor: string): Promise<CatalogYear> {
  return db.$transaction(async (tx) => {
    const year = await tx.catalogYear.findUnique({ where: { code } });
    if (!year) throw new Error(`Unknown catalog year ${code}`);
    if (year.status === 'COMPLETE') return year;
    const updated = await tx.catalogYear.update({
      where: { id: year.id },
      data: { status: 'COMPLETE', completedAt: new Date(), completedBy: actor },
    });
    await tx.changeLog.create({
      data: {
        entityType: 'catalog-year',
        entityId: String(year.id),
        catalogYearId: year.id,
        action: 'complete-year',
        origin: 'MANUAL',
        actor,
      },
    });
    return updated;
  });
}

/** One catalog year's courses in the legacy courses.json shape, ordered by course code. */
export async function readCourseYear(db: PrismaClient, yearCode: string): Promise<Course[]> {
  const versions = await db.courseVersion.findMany({
    where: { catalogYear: { code: yearCode } },
    orderBy: { courseCode: 'asc' },
  });
  return versions.map(versionToCourse);
}

/**
 * Adapter for the pipeline runner: writes a validated run's rows into the newest OPEN year.
 * Structurally matches `CatalogWriter` in @academia-nut/pipeline (db doesn't depend on pipeline).
 */
export function catalogWriter(db: PrismaClient) {
  return async (
    table: 'courses' | 'departments',
    rows: unknown[],
    run: { sourceId: string; runId: string },
  ): Promise<{ summary: string; warnings: string[] }> => {
    const year = await openCatalogYear(db);
    const provenance: Provenance = { origin: 'PULL', sourceId: run.sourceId, sourceRunId: run.runId };
    const r =
      table === 'courses'
        ? await writeCourseYear(db, year.code, rows as Course[], provenance)
        : await writeDepartmentYear(db, year.code, rows as Department[], provenance);
    return {
      summary: `${year.code} ${table}: ${r.created} new, ${r.updated} changed, ${r.removed} removed, ${r.unchanged} unchanged`,
      warnings: r.warnings,
    };
  };
}
