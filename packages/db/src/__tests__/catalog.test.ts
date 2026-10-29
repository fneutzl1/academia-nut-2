import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Department } from '@academia-nut/shared';
import {
  completeCatalogYear,
  createDb,
  getCourseDetail,
  getCourseForYear,
  listCatalogYears,
  listCourseChanges,
  openCatalogYear,
  readCourseYear,
  writeCourseYear,
  writeDepartmentYear,
  writeSubjectYear,
} from '../index.js';
import { sampleCourse } from './fixtures.js';

const url = process.env.TEST_DATABASE_URL;
const pull = { origin: 'PULL' as const, sourceId: 'curricunet-courses', sourceRunId: 'run-1' };

describe.skipIf(!url)('catalog years (Postgres)', () => {
  const db = url ? createDb(url) : (undefined as never);

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE "ChangeLog", "CourseVersion", "CourseIdentifier", "Course", "DepartmentVersion", "DepartmentIdentifier", "Department", "SubjectVersion", "Subject", "CatalogYear" RESTART IDENTITY CASCADE',
    );
  });
  afterAll(() => db?.$disconnect());

  it('creates a course once and versions it per year under one persistent id', async () => {
    const course = sampleCourse();
    await writeCourseYear(db, '2024-2025', [course], pull);
    await writeCourseYear(db, '2025-2026', [{ ...course, name: 'Renamed' }], pull);

    expect(await db.course.count()).toBe(1);
    const versions = await db.courseVersion.findMany({ include: { catalogYear: true } });
    expect(versions.map((v) => [v.catalogYear.code, v.name]).sort()).toEqual([
      ['2024-2025', course.name],
      ['2025-2026', 'Renamed'],
    ]);
    expect(new Set(versions.map((v) => v.courseId)).size).toBe(1);
    expect(await readCourseYear(db, '2024-2025')).toStrictEqual([course]);
  });

  it('keeps the same course when the vendor renumbers it (matched by entityId)', async () => {
    await writeCourseYear(db, '2024-2025', [sampleCourse()], pull);
    const renumbered = sampleCourse({ courseID: 'ASC-2190', noDash: 'ASC2190', code: '2190' });
    await writeCourseYear(db, '2025-2026', [renumbered], pull);

    expect(await db.course.count()).toBe(1);
    const ids = await db.courseIdentifier.findMany({ where: { system: 'course-code' } });
    expect(ids.map((i) => i.value).sort()).toEqual(['ASC-1190', 'ASC-2190']);
  });

  it('skips unchanged rows, logs changes, and removes courses dropped from the pull', async () => {
    const a = sampleCourse();
    const b = sampleCourse({ courseID: 'ASC-1200', noDash: 'ASC1200', code: '1200', syllabus: null });
    expect(await writeCourseYear(db, '2026-2027', [a, b], pull)).toMatchObject({ created: 2 });
    expect(await writeCourseYear(db, '2026-2027', [a, b], pull)).toMatchObject({ unchanged: 2, created: 0, updated: 0 });
    const res = await writeCourseYear(db, '2026-2027', [{ ...a, description: 'New text' }], pull);
    expect(res).toMatchObject({ updated: 1, removed: 1 });

    const log = await db.changeLog.findMany({ orderBy: { id: 'asc' } });
    expect(log.map((l) => l.action)).toEqual(['create', 'create', 'update', 'remove']);
    expect((await readCourseYear(db, '2026-2027')).map((c) => c.courseID)).toEqual(['ASC-1190']);
  });

  it('freezes a completed year and moves pulls to the newest open year', async () => {
    await writeCourseYear(db, '2025-2026', [sampleCourse()], pull);
    await writeCourseYear(db, '2026-2027', [sampleCourse()], pull);
    await completeCatalogYear(db, '2025-2026', 'admin@cscc.edu');

    await expect(writeCourseYear(db, '2025-2026', [], pull)).rejects.toThrow(/complete/);
    expect((await openCatalogYear(db)).code).toBe('2026-2027');
    expect(await readCourseYear(db, '2025-2026')).toHaveLength(1);
  });

  it('versions departments by Airtable id and subjects by code', async () => {
    const dept: Department = { id: 'recA', name: 'Geography', code: 'GEOG', subDepartments: [], programIds: ['recP'] };
    await writeDepartmentYear(db, '2025-2026', [dept], pull);
    await writeDepartmentYear(db, '2026-2027', [{ ...dept, name: 'Geography & GIS' }], pull);
    await writeSubjectYear(db, '2025-2026', [{ code: 'GEOG', name: 'Geography' }], pull);
    await writeSubjectYear(db, '2026-2027', [{ code: 'GEOG', name: 'Geography' }], pull);

    expect(await db.department.count()).toBe(1);
    expect(await db.departmentVersion.count()).toBe(2);
    expect(await db.subject.count()).toBe(1);
    expect(await db.subjectVersion.count()).toBe(2);
  });

  it('rejects malformed year codes', async () => {
    await expect(writeCourseYear(db, '2025-2027', [], pull)).rejects.toThrow(/Invalid catalog year/);
  });

  it('reads a course across years with per-year diffs and its change history', async () => {
    await writeCourseYear(db, '2024-2025', [sampleCourse()], pull);
    await writeCourseYear(db, '2025-2026', [sampleCourse({ name: 'Renamed', creditsMin: 3 })], pull);
    const courseId = (await db.course.findFirstOrThrow()).id;

    const detail = await getCourseDetail(db, courseId);
    expect(detail?.versions.map((v) => [v.year, v.changedFromPrevious])).toEqual([
      ['2024-2025', null],
      ['2025-2026', ['name', 'creditsMin']],
    ]);
    expect(await getCourseForYear(db, '2025-2026', 'asc1190')).toMatchObject({ courseId, name: 'Renamed' });
    expect(await getCourseForYear(db, '2024-2025', 'ASC-9999')).toBeNull();
    expect((await listCourseChanges(db, courseId)).map((c) => [c.year, c.action])).toEqual([
      ['2025-2026', 'create'],
      ['2024-2025', 'create'],
    ]);
    expect((await listCatalogYears(db)).map((y) => [y.code, y.courseCount])).toEqual([
      ['2025-2026', 1],
      ['2024-2025', 1],
    ]);
  });
});
