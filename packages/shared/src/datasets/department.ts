import { z } from 'zod';

export const DepartmentSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  code: z.string().optional(),
  subDepartments: z.array(z.string()).default([]),
  programIds: z.array(z.string()).default([]),
  link: z.string().optional(),
});

export type Department = z.infer<typeof DepartmentSchema>;
