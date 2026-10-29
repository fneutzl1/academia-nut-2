import { CourseSchema, type Course, type Requisite } from '@academia-nut/shared';
import {
  curricunetPages,
  field,
  fieldsIn,
  findSection,
  num,
  numOrBlank,
  str,
  type CurricunetEntity,
  type CurricunetSection,
} from '../connectors/curricunet.js';
import { sanitizeContent, slugify } from '../sanitize.js';
import { defineSource } from '../source.js';

// Restriction flags; each is followed by its explanation field in the vendor form
const RESTRICTION_TYPES = ['Instructor Permission', 'Health Code', 'Immunization Level', 'Program Admission', 'Declared Major', 'Other'];

/** "ASC 1190 - Critical Thinking" -> { courseID: "ASC-1190", code: "1190" } */
export function parseCourseTitle(entityTitle: string): { courseID: string; code: string } | null {
  const compact = (entityTitle.split('-')[0] ?? '').replace(/ /g, '');
  const code = compact.match(/^\d+|\d+\b|\d+(?=\w)[a-zA-Z]/)?.[0];
  if (!code) return null;
  return { courseID: `${compact.replace(code, '-')}${code}`, code };
}

/** "ENGL 1100 - Composition I" -> "ENGL1100" */
const lookupCode = (display: string | undefined) => (display ?? '').split('-')[0]!.replace(/ /g, '');

function requisites(section: CurricunetSection | undefined): Course['requisites'] {
  const pre: Requisite[] = [];
  const co: Requisite[] = [];
  const instances = ['Pre-Requisites', 'Co-Requisites'].flatMap((name) => findSection(section, name)?.subsections ?? []);

  for (const instance of instances) {
    const type = (field(instance, 'Requisite Type')?.lookUpDisplay ?? '').replace(/ \(Taken (Previously|With)\)/, '');
    const req: Requisite = {
      course: lookupCode(field(instance, 'Requisite Course')?.lookUpDisplay),
      slug: '', // filled in finalize() once every course name is known
      subject: lookupCode(field(instance, 'Subject')?.lookUpDisplay),
      description: sanitizeContent(field(instance, 'Requisite Description')?.fieldValue),
      condition: field(instance, 'Condition')?.lookUpDisplay ?? '',
      order: instance.attributes.instanceSortOrder,
    };
    if (!req.course && !req.description) continue;
    if (type !== 'Corequisite') pre.push(req);
    if (type !== 'Prerequisite') co.push(req);
  }

  const byOrder = (a: Requisite, b: Requisite) => (a.order ?? 0) - (b.order ?? 0);
  return { pre: pre.sort(byOrder), co: co.sort(byOrder) };
}

function restrictions(section: CurricunetSection | undefined): Course['restrictions'] {
  // TODO: positional (flag, then explanation) like the legacy code; match by
  // field name once we confirm the vendor's explanation field names.
  const fields = fieldsIn(section);
  return fields.flatMap((f, i) => {
    if (!RESTRICTION_TYPES.includes(f.attributes.displayName)) return [];
    const next = fields[i + 1];
    return [{
      type: f.attributes.displayName,
      status: f.fieldValue === 1,
      listType: next?.attributes.displayName,
      explanation: next?.fieldValue == null ? undefined : String(next.fieldValue),
    }];
  });
}

function contactHours(section: CurricunetSection | undefined): Course['contactHours'] {
  const parent = section?.subsections?.find((s) => s.attributes.oneToManySection);
  return (parent?.subsections ?? [])
    .filter((s) => s.attributes.sectionOrInstance === 'sectionInstance')
    .flatMap((instance) => {
      const type = field(instance, 'Contact Hour Type')?.lookUpDisplay;
      if (!type) return [];
      const min = field(instance, 'Minimum Contact Hour')?.fieldValue;
      const max = field(instance, 'Maximum Contact Hour')?.fieldValue;
      return [{ type, minHours: (min as number | string) ?? '', maxHours: (max as number | string) ?? '' }];
    });
}

function syllabus(entity: CurricunetEntity): Course['syllabus'] {
  const section = findSection(entity, 'Syllabus');
  if (!section) return null;
  const entityId = entity.attributes.entityId;
  const files = findSection(section, 'Attached File:')?.subsections ?? [];
  return {
    entityId,
    attachments: files.flatMap((item) => {
      const fileName = str(field(item, 'Attached File Name'));
      const id = item.attributes.instanceId;
      if (!fileName || !id) return [];
      return [{ id, fileName, downloadUrl: `https://cscc.curriqunet.com/Form/Course/_DownloadFile/${entityId}?fileid=${id}` }];
    }),
  };
}

export function transformCourse(entity: CurricunetEntity, warn: (m: string) => void = () => {}): Course | null {
  const parsed = parseCourseTitle(entity.entityMetadata.entityTitle);
  if (!parsed) {
    warn(`Skipped "${entity.entityMetadata.entityTitle}": no course number in title`);
    return null;
  }
  const { courseID, code } = parsed;

  const sections = {
    dates: findSection(entity, 'Codes/Dates'),
    general: findSection(entity, 'General Course Information'),
    type: findSection(entity, 'Course Type'),
    requisites: findSection(entity, 'Requisites'),
    restrictions: findSection(entity, 'Course Restrictions'),
    fees: findSection(entity, 'Fees'),
  };
  for (const [key, name] of [['dates', 'Codes/Dates'], ['general', 'General Course Information'], ['type', 'Course Type']] as const) {
    if (!sections[key]) warn(`${courseID}: '${name}' section not found`);
  }

  const { general } = sections;
  const autumn = num(field(general, 'Autumn'));
  const spring = num(field(general, 'Spring'));
  const summer = num(field(general, 'Summer'));
  const implementDate = str(field(sections.dates, 'Catalog Implement Date', 'Implement Date'));
  const parsedDate = implementDate ? new Date(implementDate) : null;

  return {
    name: str(field(general, 'Course Title')),
    courseID,
    noDash: courseID.replace(/-/g, ''),
    code,
    type: (field(general, 'Subject Code')?.lookUpDisplay ?? '').replace(/\s/g, ''),
    description: sanitizeContent(field(general, 'Course Description')?.fieldValue),
    creditsMin: num(field(sections.type, 'Minimum Credit Hour Total')),
    creditsMax: numOrBlank(field(sections.type, 'Maximum Credit Hour Total')),
    status: entity.entityMetadata.status,
    offered: { autumn, spring, summer, od: autumn + spring + summer > 0 ? 0 : 1 },
    requisites: requisites(sections.requisites),
    restrictions: restrictions(sections.restrictions),
    fees: {
      deptFee: numOrBlank(field(sections.fees, 'Dept: Amount')),
      techFee: numOrBlank(field(sections.fees, 'Data Center (IT) Amount')),
      totalFee: numOrBlank(field(sections.fees, 'Total Lab Fee')),
    },
    contactHours: contactHours(sections.type),
    beginDate: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : '',
    syllabus: syllabus(entity),
  };
}

/** Fill requisite slugs from this run's own course names (not a stale file). */
export function linkRequisiteSlugs(courses: Course[]): Course[] {
  const slugByNoDash = new Map(courses.map((c) => [c.noDash, slugify(c.name)]));
  for (const course of courses) {
    for (const req of [...course.requisites.pre, ...course.requisites.co]) {
      req.slug = slugByNoDash.get(req.course) ?? '';
    }
  }
  return courses;
}

export const curricunetCourses = defineSource<CurricunetEntity, Course>({
  id: 'curricunet-courses',
  service: 'curricunet',
  dataset: 'courses',
  description: 'Active courses from Curricunet, flattened to the legacy courses.json shape',
  fetch: () => curricunetPages({ method: 'getCourses', status: 'Active' }),
  transform: (entity, ctx) => transformCourse(entity, ctx.warn),
  finalize: linkRequisiteSlugs,
  schema: CourseSchema,
  guard: { maxCountChange: 0.15, minRows: 100 },
});
