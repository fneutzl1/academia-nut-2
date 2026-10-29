import { CourseSchema } from '@academia-nut/shared';
import { describe, expect, it } from 'vitest';
import { linkRequisiteSlugs, parseCourseTitle, transformCourse } from '../sources/curricunet-courses.js';
import { courseEntity } from './fixtures/curricunet-course.js';

describe('parseCourseTitle', () => {
  it.each([
    ['ASC 1190 - Critical Thinking', 'ASC-1190', '1190'],
    ['ENGL 1100H - Honors Composition', 'ENGL-1100H', '1100H'],
  ])('%s', (title, courseID, code) => {
    expect(parseCourseTitle(title)).toEqual({ courseID, code });
  });

  it('returns null without a course number', () => {
    expect(parseCourseTitle('Placeholder')).toBeNull();
  });
});

describe('transformCourse', () => {
  const course = transformCourse(courseEntity())!;

  it('produces a schema-valid legacy course row', () => {
    expect(CourseSchema.safeParse(course).success).toBe(true);
  });

  it('maps core fields', () => {
    expect(course).toMatchObject({
      name: 'Critical Thinking in Arts & Sciences',
      courseID: 'ASC-1190',
      noDash: 'ASC1190',
      code: '1190',
      type: 'ASC',
      description: '<p>Intro course.</p>',
      creditsMin: 1,
      creditsMax: '',
      status: 'Active',
      offered: { autumn: 1, spring: 1, summer: 0, od: 0 },
      fees: { deptFee: 25, techFee: '', totalFee: 30 },
      contactHours: [{ type: 'Lecture', minHours: 1, maxHours: '' }],
    });
    expect(course.beginDate).toMatch(/^2016-06-01T/);
  });

  it('splits and orders requisites', () => {
    expect(course.requisites.pre.map((r) => r.course || r.description)).toEqual(['<p>Placement test</p>', 'ENGL1100']);
    expect(course.requisites.co.map((r) => r.description)).toEqual(['<p>Placement test</p>']);
    expect(course.requisites.pre[1]).toMatchObject({ subject: 'ENGL', course: 'ENGL1100' });
  });

  it('reads restrictions and syllabus', () => {
    expect(course.restrictions).toEqual([
      { type: 'Instructor Permission', status: true, listType: 'List/Explain', explanation: 'Ask the chair' },
      { type: 'Health Code', status: false, listType: 'List/Explain', explanation: '' },
    ]);
    expect(course.syllabus?.attachments[0]).toMatchObject({ id: 13215, fileName: 'syllabus.docx' });
  });

  it('warns about missing sections instead of crashing', () => {
    const entity = courseEntity();
    entity.entityFormData!.rootSections![0]!.subsections = [];
    const warnings: string[] = [];
    const row = transformCourse(entity, (m) => warnings.push(m));
    expect(row?.name).toBe('');
    expect(warnings).toContain("ASC-1190: 'General Course Information' section not found");
  });
});

describe('linkRequisiteSlugs', () => {
  it('links requisites to courses pulled in the same run', () => {
    const asc = transformCourse(courseEntity())!;
    const engl = transformCourse(courseEntity({ title: 'ENGL 1100 - Composition I', name: 'Composition I' }))!;
    linkRequisiteSlugs([asc, engl]);
    expect(asc.requisites.pre.find((r) => r.course === 'ENGL1100')?.slug).toBe('composition-i');
  });
});
