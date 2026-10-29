import type { Course } from '@academia-nut/shared';

export const sampleCourse = (over: Partial<Course> = {}): Course => ({
  name: 'Critical Thinking in Arts & Sciences',
  courseID: 'ASC-1190',
  noDash: 'ASC1190',
  code: '1190',
  type: 'ASC',
  description: 'Intro course.',
  creditsMin: 1.5,
  creditsMax: '',
  status: 'Active',
  offered: { autumn: 1, spring: 0, summer: 1, od: 0 },
  requisites: {
    pre: [{ course: 'ENGL1100', slug: 'composition-i', subject: 'ENGL', description: '', condition: '', order: 1 }],
    co: [],
  },
  restrictions: [{ type: 'Other', status: false, listType: 'Other-Explain', explanation: '' }],
  fees: { deptFee: 2, techFee: '', totalFee: 2.5 },
  contactHours: [{ type: 'Lecture', minHours: 1, maxHours: '' }],
  beginDate: '2016-06-01T04:00:00.000Z',
  syllabus: { entityId: 4052, attachments: [] },
  ...over,
});
