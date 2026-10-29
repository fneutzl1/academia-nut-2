import { createHash } from 'node:crypto';
import type { Course } from '@academia-nut/shared';
import type { CourseVersion } from './generated/client.js';

/** Columns of a CourseVersion that hold course content (no identity / provenance). */
export type CourseVersionContent = Pick<
  CourseVersion,
  | 'courseCode'
  | 'subject'
  | 'number'
  | 'name'
  | 'description'
  | 'status'
  | 'creditsMin'
  | 'creditsMax'
  | 'offeredAutumn'
  | 'offeredSpring'
  | 'offeredSummer'
  | 'offeredOnDemand'
  | 'deptFee'
  | 'techFee'
  | 'totalFee'
  | 'beginDate'
  | 'requisites'
  | 'restrictions'
  | 'contactHours'
  | 'syllabus'
>;

// Legacy keeps blank vendor numbers as "", stored as NULL.
const blankToNull = (v: number | ''): number | null => (v === '' ? null : v);
const nullToBlank = (v: number | null): number | '' => (v === null ? '' : v);

export function courseToVersionContent(c: Course): CourseVersionContent {
  return {
    courseCode: c.courseID,
    subject: c.type,
    number: c.code,
    name: c.name,
    description: c.description,
    status: c.status,
    creditsMin: c.creditsMin,
    creditsMax: blankToNull(c.creditsMax),
    offeredAutumn: c.offered.autumn === 1,
    offeredSpring: c.offered.spring === 1,
    offeredSummer: c.offered.summer === 1,
    offeredOnDemand: c.offered.od === 1,
    deptFee: blankToNull(c.fees.deptFee),
    techFee: blankToNull(c.fees.techFee),
    totalFee: blankToNull(c.fees.totalFee),
    beginDate: c.beginDate,
    requisites: c.requisites,
    restrictions: c.restrictions,
    contactHours: c.contactHours,
    syllabus: c.syllabus ?? null,
  };
}

/** Rebuild the legacy courses.json row (same key order) from a version row. */
export function versionToCourse(v: CourseVersionContent): Course {
  return {
    name: v.name,
    courseID: v.courseCode,
    noDash: v.courseCode.replace('-', ''),
    code: v.number,
    type: v.subject,
    description: v.description,
    creditsMin: v.creditsMin,
    creditsMax: nullToBlank(v.creditsMax),
    status: v.status,
    offered: {
      autumn: v.offeredAutumn ? 1 : 0,
      spring: v.offeredSpring ? 1 : 0,
      summer: v.offeredSummer ? 1 : 0,
      od: v.offeredOnDemand ? 1 : 0,
    },
    requisites: v.requisites as Course['requisites'],
    restrictions: v.restrictions as Course['restrictions'],
    fees: { deptFee: nullToBlank(v.deptFee), techFee: nullToBlank(v.techFee), totalFee: nullToBlank(v.totalFee) },
    contactHours: v.contactHours as Course['contactHours'],
    beginDate: v.beginDate,
    syllabus: (v.syllabus ?? null) as Course['syllabus'],
  };
}

/** JSON with object keys sorted, so equal content always hashes the same. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

export function contentHash(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}
