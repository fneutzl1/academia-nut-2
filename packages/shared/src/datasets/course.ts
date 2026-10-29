import { z } from 'zod';

// Mirrors the legacy explore-api `courses.json` record shape so existing
// consumers (programs, catalog front end) keep working. Change with care.

export const RequisiteSchema = z.object({
  course: z.string(),
  slug: z.string(),
  subject: z.string(),
  description: z.string(),
  condition: z.string(),
  order: z.number().optional(),
});

export const RestrictionSchema = z.object({
  type: z.string(),
  status: z.boolean(),
  listType: z.string().optional(),
  explanation: z.string().optional(),
});

export const ContactHoursSchema = z.object({
  type: z.string(),
  minHours: z.union([z.number(), z.string()]),
  maxHours: z.union([z.number(), z.string()]),
});

// The vendor leaves some numeric fields blank; legacy output kept them as ""
// (e.g. creditsMax "" = fixed credits, no range), so consumers may rely on it.
const NumberOrBlank = z.union([z.number(), z.literal('')]);

export const CourseSchema = z.object({
  name: z.string().min(1),
  courseID: z.string().regex(/^[A-Z]+-\w+$/, 'expected SUBJ-1234'),
  noDash: z.string(),
  code: z.string(),
  type: z.string().min(1),
  description: z.string(),
  creditsMin: z.number(),
  creditsMax: NumberOrBlank,
  status: z.string(),
  offered: z.object({
    autumn: z.number(),
    spring: z.number(),
    summer: z.number(),
    od: z.number(),
  }),
  requisites: z.object({
    pre: z.array(RequisiteSchema),
    co: z.array(RequisiteSchema),
  }),
  restrictions: z.array(RestrictionSchema),
  fees: z.object({
    deptFee: NumberOrBlank,
    techFee: NumberOrBlank,
    totalFee: NumberOrBlank,
  }),
  contactHours: z.array(ContactHoursSchema),
  beginDate: z.string(),
  syllabus: z
    .object({
      entityId: z.number(),
      attachments: z.array(z.object({ id: z.number(), fileName: z.string(), downloadUrl: z.string() })),
    })
    .nullable(),
});

export type Course = z.infer<typeof CourseSchema>;
export type Requisite = z.infer<typeof RequisiteSchema>;
