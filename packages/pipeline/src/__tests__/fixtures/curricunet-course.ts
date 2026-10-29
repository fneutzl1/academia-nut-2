import type { CurricunetEntity, CurricunetField, CurricunetSection } from '../../connectors/curricunet.js';

// Hand-built from the shape of real getCourses responses (trimmed). When the
// vendor changes something, paste a real (scrubbed) record here and fix forward.

const f = (displayName: string, fieldValue?: unknown, lookUpDisplay?: string): CurricunetField => ({
  attributes: { displayName },
  fieldValue,
  ...(lookUpDisplay ? { lookUpDisplay } : {}),
});

const section = (sectionName: string, fields: CurricunetField[] = [], subsections: CurricunetSection[] = [], extra = {}): CurricunetSection => ({
  attributes: { sectionName, sectionOrInstance: 'section', ...extra },
  fields,
  subsections,
});

const instance = (fields: CurricunetField[], extra = {}): CurricunetSection => ({
  attributes: { sectionName: '', sectionOrInstance: 'sectionInstance', ...extra },
  fields,
  subsections: [],
});

export function courseEntity(overrides: { title?: string; name?: string } = {}): CurricunetEntity {
  return {
    attributes: { entityId: 4052, entityType: 'Course' },
    entityMetadata: { entityTitle: overrides.title ?? 'ASC 1190 - Critical Thinking in Arts & Sciences', status: 'Active' },
    entityFormData: {
      rootSections: [
        section('Main', [], [
          section('Codes/Dates', [f('Catalog Implement Date', 'June, 01 2016 00:00:00')]),
          section('General Course Information', [
            f('Subject Code', 12, 'ASC '),
            f('Course Title', overrides.name ?? 'Critical Thinking in Arts & Sciences'),
            f('Course Description', '<p>Intro course.</p><p> </p><script>x</script>'),
            f('Autumn', 1),
            f('Spring', 1),
            f('Summer', 0),
          ]),
          section('Course Type', [f('Minimum Credit Hour Total', 1), f('Maximum Credit Hour Total', '')], [
            section('Contact Hours', [], [
              instance([f('Contact Hour Type', 1, 'Lecture'), f('Minimum Contact Hour', 1), f('Maximum Contact Hour', '')]),
            ], { oneToManySection: true }),
          ]),
          section('Requisites', [], [
            section('Pre-Requisites', [], [
              instance([
                f('Requisite Type', 1, 'Prerequisite (Taken Previously)'),
                f('Subject', 3, 'ENGL - English'),
                f('Requisite Course', 9, 'ENGL 1100 - Composition I'),
              ], { instanceSortOrder: 2 }),
              instance([
                f('Requisite Type', 2, 'Prerequisite or Corequisite'),
                f('Requisite Description', '<p>Placement test</p>'),
              ], { instanceSortOrder: 1 }),
            ]),
          ]),
          section('Course Restrictions', [
            f('Instructor Permission', 1),
            f('List/Explain', 'Ask the chair'),
            f('Health Code', 0),
            f('List/Explain', ''),
          ]),
          section('Fees', [f('Dept: Amount', 25), f('Data Center (IT) Amount', ''), f('Total Lab Fee', 30)]),
          section('Syllabus', [], [
            section('Attached File:', [], [instance([f('Attached File Name', 'syllabus.docx')], { instanceId: 13215 })]),
          ]),
        ]),
      ],
    },
  };
}
