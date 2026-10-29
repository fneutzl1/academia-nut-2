import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CourseSchema, type Course } from '@academia-nut/shared';
import { contentHash, courseToVersionContent, versionToCourse } from '../course-mapping.js';
import { sampleCourse } from './fixtures.js';

describe('course mapping', () => {
  it('round-trips a course exactly, including blank ("") numbers', () => {
    const course = sampleCourse();
    expect(versionToCourse(courseToVersionContent(course))).toStrictEqual(course);
  });

  it('round-trips a course without a syllabus', () => {
    const course = sampleCourse({ syllabus: null });
    expect(versionToCourse(courseToVersionContent(course))).toStrictEqual(course);
  });

  it('hashes independent of key order', () => {
    const a = sampleCourse();
    const b = { ...a, offered: { od: 0, summer: 1, spring: 0, autumn: 1 } };
    expect(contentHash(a)).toBe(contentHash(b));
    expect(contentHash(a)).not.toBe(contentHash(sampleCourse({ name: 'Changed' })));
  });

  // Every real legacy snapshot row must survive the trip (skipped when the legacy repo isn't checked out alongside).
  const legacyDir =
    process.env.LEGACY_DATA_DIR ?? path.resolve(import.meta.dirname, '../../../../../explore-api-original/public/data');
  const years = ['2022-2023', '2023-2024', '2024-2025', '2025-2026'];
  it.skipIf(!fs.existsSync(legacyDir))('round-trips every legacy snapshot row', () => {
    for (const year of years) {
      const rows = JSON.parse(fs.readFileSync(path.join(legacyDir, 'years', year, 'courses.json'), 'utf8')) as Course[];
      for (const raw of rows) {
        // Snapshots before 2025-2026 have no syllabus key; the table stores that as null.
        const course = CourseSchema.parse({ ...raw, syllabus: raw.syllabus ?? null });
        expect(versionToCourse(courseToVersionContent(course)), `${year} ${course.courseID}`).toStrictEqual(course);
      }
    }
  });
});
