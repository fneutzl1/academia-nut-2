// DTOs for browsing the catalog-year tables in the admin UI.
import type { Course } from './datasets/course.js';

export type CatalogYearStatus = 'OPEN' | 'COMPLETE';
export type RecordOrigin = 'IMPORT' | 'PULL' | 'MANUAL';

export interface CatalogYearSummary {
  code: string;
  status: CatalogYearStatus;
  completedAt: string | null;
  completedBy: string | null;
  courseCount: number;
  departmentCount: number;
  subjectCount: number;
}

export interface Provenance {
  origin: RecordOrigin;
  sourceId: string | null;
  sourceRunId: string | null;
  pulledAt: string | null;
  updatedBy: string | null;
  updatedAt: string;
}

export interface CourseListItem {
  courseId: string; // persistent internal id
  courseCode: string;
  name: string;
  subject: string;
  creditsMin: number;
  creditsMax: number | null;
  status: string;
  origin: RecordOrigin;
  updatedAt: string;
}

export interface CourseYearVersion {
  year: string;
  yearStatus: CatalogYearStatus;
  course: Course;
  provenance: Provenance;
  /** Top-level course fields that differ from the previous year this course exists in. */
  changedFromPrevious: string[] | null;
}

export interface ChangeEntry {
  id: string;
  year: string | null;
  action: string;
  origin: RecordOrigin;
  actor: string | null;
  sourceRunId: string | null;
  createdAt: string;
  changedFields: string[];
  before: unknown;
  after: unknown;
}

export interface CourseDetail {
  courseId: string;
  identifiers: { system: string; value: string }[];
  versions: CourseYearVersion[];
}

export interface DepartmentListItem {
  departmentId: string;
  airtableId: string | null;
  name: string;
  code: string | null;
  link: string | null;
  subDepartments: string[];
  programCount: number;
  origin: RecordOrigin;
  updatedAt: string;
}
