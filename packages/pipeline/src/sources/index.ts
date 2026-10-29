import type { Source } from '../source.js';
import { airtableDepartments } from './airtable-departments.js';
import { curricunetCourses } from './curricunet-courses.js';

// Register new sources here. The admin app lists and runs everything in this array.
export const sources: Source<any, any>[] = [curricunetCourses, airtableDepartments];

export function getSource(id: string): Source<any, any> | undefined {
  return sources.find((s) => s.id === id);
}
