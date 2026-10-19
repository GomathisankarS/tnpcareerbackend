import {
  z,
  text,
  optionalText,
  skillsSchema,
  integer,
  pageSchema
} from '../../shared/validation.js';
const optionCode = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/);
export const jobSchema = z
  .object({
    title: text(150),
    companyName: text(150),
    categoryId: integer(1, 4294967295),
    locationCity: optionalText(100),
    employmentType: optionCode,
    workMode: optionCode,
    experienceLevel: optionCode,
    minExperienceMonths: integer(0, 720),
    maxExperienceMonths: integer(0, 720).nullable(),
    salaryMinAnnualInr: z.number().finite().min(0).max(9999999999.99).nullable(),
    salaryMaxAnnualInr: z.number().finite().min(0).max(9999999999.99).nullable(),
    description: text(10000),
    skills: skillsSchema,
    isFeatured: z.boolean(),
    status: z.enum(['draft', 'published', 'closed'])
  })
  .strict()
  .superRefine((v, c) => {
    const issue = (path, message) => c.addIssue({ code: 'custom', path: [path], message });
    if (v.maxExperienceMonths !== null && v.maxExperienceMonths < v.minExperienceMonths)
      issue('maxExperienceMonths', 'Maximum must be at least minimum');
    if ((v.salaryMinAnnualInr === null) !== (v.salaryMaxAnnualInr === null))
      issue('salaryMaxAnnualInr', 'Provide both salary bounds or neither');
    if (v.salaryMinAnnualInr !== null && v.salaryMaxAnnualInr < v.salaryMinAnnualInr)
      issue('salaryMaxAnnualInr', 'Maximum must be at least minimum');
  });
export const filterSchema = pageSchema
  .extend({
    limit: z.coerce.number().int().min(1).max(50).default(8),
    q: text(100).optional(),
    categoryId: z.coerce.number().int().positive().max(4294967295).optional(),
    experienceLevel: optionCode.optional(),
    employmentType: optionCode.optional(),
    workMode: optionCode.optional(),
    city: text(100).optional(),
    featured: z.enum(['true', 'false']).optional(),
    status: z.enum(['draft', 'published', 'closed']).optional(),
    sort: z.enum(['latest', 'salary']).default('latest')
  })
  .strict();
