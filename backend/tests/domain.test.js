import { it } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { parse } from '../src/shared/validation.js';
import { jobSchema, filterSchema } from '../src/modules/jobs/jobs.validation.js';
import { buildFilters } from '../src/modules/jobs/jobs.repository.js';
import { validatePdf, storagePath } from '../src/shared/storage.js';
const valid = {
  title: 'Developer',
  companyName: 'Company',
  categoryId: 1,
  locationCity: null,
  workMode: 'remote',
  employmentType: 'full_time',
  experienceLevel: 'junior',
  minExperienceMonths: 0,
  maxExperienceMonths: 24,
  salaryMinAnnualInr: 400000,
  salaryMaxAnnualInr: 900000,
  description: 'Build applications',
  skills: ['React'],
  isFeatured: false,
  status: 'published'
};
it('job validation rejects inconsistent ranges and writable ownership', () => {
  assert.equal(parse(jobSchema, valid).title, 'Developer');
  for (const patch of [
    { maxExperienceMonths: -1 },
    { minExperienceMonths: 30 },
    { salaryMaxAnnualInr: null },
    { skills: ['React', 'react'] },
    { createdBy: 1 }
  ])
    assert.throws(() => parse(jobSchema, { ...valid, ...patch }));
  for (const p of [
    { page: 0 },
    { limit: 1000 },
    { categoryId: '1 OR 1=1' },
    { sort: 'DROP TABLE jobs' }
  ])
    assert.throws(() => parse(filterSchema, p));
});
it('public filters always constrain visibility and bind query input', () => {
  const f = buildFilters({ q: "%' OR 1=1 --", categoryId: 2 });
  assert.ok(f.sql.includes("j.status = 'published'"));
  assert.ok(f.sql.includes('j.deleted_at IS NULL'));
  assert.ok(!f.sql.includes('OR 1=1'));
  assert.equal(f.values[0], 2);
  assert.ok(f.values[1].includes('!%'));
});
it('resume validation checks parsed PDF content, MIME, extension and size', async () => {
  const doc = await PDFDocument.create();
  doc.addPage();
  const buffer = Buffer.from(await doc.save());
  const file = { buffer, size: buffer.length, mimetype: 'application/pdf', originalname: 'cv.pdf' };
  await validatePdf(file);
  for (const patch of [
    { buffer: Buffer.from('%PDF-fake') },
    { mimetype: 'text/plain' },
    { originalname: 'cv.exe' },
    { size: 5242881 }
  ])
    await assert.rejects(() => validatePdf({ ...file, ...patch }));
  assert.throws(() => storagePath('../../secret'));
});
