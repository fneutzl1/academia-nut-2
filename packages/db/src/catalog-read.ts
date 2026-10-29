import type {
  CatalogYearSummary,
  ChangeEntry,
  CourseDetail,
  CourseListItem,
  CourseYearVersion,
  DepartmentListItem,
} from '@academia-nut/shared';
import type { PrismaClient } from './generated/client.js';
import { AIRTABLE } from './catalog.js';
import { stableStringify, versionToCourse } from './course-mapping.js';

const CHANGE_LIMIT = 100;

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** Top-level keys whose values differ between two objects (either may be null). */
export function changedKeys(before: unknown, after: unknown): string[] {
  const a = (before ?? {}) as Record<string, unknown>;
  const b = (after ?? {}) as Record<string, unknown>;
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(
    (k) => stableStringify(a[k]) !== stableStringify(b[k]),
  );
}

export async function listCatalogYears(db: PrismaClient): Promise<CatalogYearSummary[]> {
  const years = await db.catalogYear.findMany({
    orderBy: { startYear: 'desc' },
    include: { _count: { select: { courseVersions: true, departmentVersions: true, subjectVersions: true } } },
  });
  return years.map((y) => ({
    code: y.code,
    status: y.status,
    completedAt: iso(y.completedAt),
    completedBy: y.completedBy,
    courseCount: y._count.courseVersions,
    departmentCount: y._count.departmentVersions,
    subjectCount: y._count.subjectVersions,
  }));
}

export async function listCourses(db: PrismaClient, yearCode: string): Promise<CourseListItem[]> {
  const rows = await db.courseVersion.findMany({
    where: { catalogYear: { code: yearCode } },
    orderBy: { courseCode: 'asc' },
    select: {
      courseId: true,
      courseCode: true,
      name: true,
      subject: true,
      creditsMin: true,
      creditsMax: true,
      status: true,
      origin: true,
      updatedAt: true,
    },
  });
  return rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }));
}

/** One course across catalog years: its identifiers and every yearly version. */
export async function getCourseDetail(db: PrismaClient, courseId: string): Promise<CourseDetail | null> {
  const course = await db.course.findUnique({
    where: { id: courseId },
    include: {
      identifiers: { orderBy: { createdAt: 'asc' } },
      versions: { include: { catalogYear: true }, orderBy: { catalogYear: { startYear: 'asc' } } },
    },
  });
  if (!course) return null;

  let previous: CourseYearVersion | undefined;
  const versions = course.versions.map((v): CourseYearVersion => {
    const version: CourseYearVersion = {
      year: v.catalogYear.code,
      yearStatus: v.catalogYear.status,
      course: versionToCourse(v),
      provenance: {
        origin: v.origin,
        sourceId: v.sourceId,
        sourceRunId: v.sourceRunId,
        pulledAt: iso(v.pulledAt),
        updatedBy: v.updatedBy,
        updatedAt: v.updatedAt.toISOString(),
      },
      changedFromPrevious: previous ? changedKeys(previous.course, versionToCourse(v)) : null,
    };
    previous = version;
    return version;
  });

  return {
    courseId: course.id,
    identifiers: course.identifiers.map((i) => ({ system: i.system, value: i.value })),
    versions,
  };
}

/** One course for one catalog year, in the legacy courses.json shape. Matches ASC-1190 or ASC1190. */
export async function getCourseForYear(db: PrismaClient, yearCode: string, code: string) {
  const courseCode = code.toUpperCase().replace(/^([A-Z]+)-?/, '$1-');
  const version = await db.courseVersion.findFirst({ where: { catalogYear: { code: yearCode }, courseCode } });
  return version ? { courseId: version.courseId, ...versionToCourse(version) } : null;
}

/** Most recent changes to one course (pull, import and future manual edits), newest first. Admin only. */
export async function listCourseChanges(db: PrismaClient, courseId: string): Promise<ChangeEntry[]> {
  const changes = await db.changeLog.findMany({
    where: { entityType: 'course', entityId: courseId },
    include: { catalogYear: true },
    orderBy: { id: 'desc' },
    take: CHANGE_LIMIT,
  });
  return changes.map((c) => ({
    id: String(c.id),
    year: c.catalogYear?.code ?? null,
    action: c.action,
    origin: c.origin,
    actor: c.actor,
    sourceRunId: c.sourceRunId,
    createdAt: c.createdAt.toISOString(),
    changedFields: c.action === 'update' ? changedKeys(c.before, c.after) : [],
    before: c.before,
    after: c.after,
  }));
}

export async function listDepartments(db: PrismaClient, yearCode: string): Promise<DepartmentListItem[]> {
  const rows = await db.departmentVersion.findMany({
    where: { catalogYear: { code: yearCode } },
    orderBy: { name: 'asc' },
    include: { department: { include: { identifiers: { where: { system: AIRTABLE } } } } },
  });
  return rows.map((r) => ({
    departmentId: r.departmentId,
    airtableId: r.department.identifiers[0]?.value ?? null,
    name: r.name,
    code: r.code,
    link: r.link,
    subDepartments: r.subDepartments,
    programCount: r.programIds.length,
    origin: r.origin,
    updatedAt: r.updatedAt.toISOString(),
  }));
}
