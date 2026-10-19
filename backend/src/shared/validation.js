import { z } from 'zod';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { AppError } from './errors/AppError.js';
export const text = (max) => z.string().trim().min(1).max(max);
export const optionalText = (max) =>
  z.preprocess((v) => (v === '' || v === undefined ? null : v), text(max).nullable());
export const integer = (min, max) => z.number().int().min(min).max(max);
export const idSchema = z.coerce.number().int().min(1).max(4294967295);
export const pageSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12)
});
export function parse(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new AppError(
      'Please check the highlighted fields',
      400,
      'VALIDATION_ERROR',
      result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
    );
  return result.data;
}
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .email()
  .regex(/^[\x20-\x7E]+$/, 'Use an ASCII email address');
export function normalizeMobile(value) {
  const phone =
    typeof value === 'string' && value.trim().startsWith('+')
      ? parsePhoneNumberFromString(value.trim())
      : null;
  if (!phone?.isValid())
    throw new AppError('Use a valid mobile number with country code', 400, 'VALIDATION_ERROR', [
      { field: 'mobileNumber', message: 'Include country code, e.g. +919876543210' }
    ]);
  return phone.number;
}
export const passwordSchema = z.string().min(10, 'Use at least 10 characters').max(128);
export const skillsSchema = z
  .array(text(60))
  .min(1)
  .max(30)
  .refine((a) => new Set(a.map((s) => s.toLowerCase())).size === a.length, 'Skills must be unique');
export { z };
