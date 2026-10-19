import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink, access } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { env } from '../config/env.js';
import { AppError } from './errors/AppError.js';
import { createSupabaseStorage } from './supabase-storage.js';
const remote = createSupabaseStorage();
export async function validatePdf(file) {
  const bad = () =>
    new AppError('Upload a valid, unencrypted PDF up to 5 MiB', 400, 'INVALID_RESUME');
  if (
    !file ||
    file.size < 1 ||
    file.size > env.RESUME_MAX_BYTES ||
    file.mimetype !== 'application/pdf' ||
    !file.originalname.toLowerCase().endsWith('.pdf') ||
    file.buffer.subarray(0, 5).toString() !== '%PDF-'
  )
    throw bad();
  try {
    const pdf = await PDFDocument.load(file.buffer, {
      ignoreEncryption: false,
      updateMetadata: false,
      throwOnInvalidObject: true
    });
    if (!pdf.getPageCount()) throw bad();
  } catch {
    throw bad();
  }
}
export function storagePath(key) {
  if (!/^[0-9a-f-]{36}\.pdf$/.test(key)) throw new AppError('Resume unavailable', 404, 'NOT_FOUND');
  return path.join(env.UPLOAD_DIR, key);
}
export async function storeResume(file) {
  await validatePdf(file);
  const key = `${randomUUID()}.pdf`;
  if (env.STORAGE_DRIVER === 'supabase') await remote.put(key, file.buffer);
  else {
    await mkdir(env.UPLOAD_DIR, { recursive: true });
    await writeFile(storagePath(key), file.buffer, { flag: 'wx' });
  }
  const name = [...path.basename(file.originalname.replaceAll('\\', '/'))]
    .filter((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127)
    .join('')
    .slice(0, 255);
  return { key, name, size: file.size, time: new Date() };
}
export async function removeUnreferencedNewFile(key) {
  if (env.STORAGE_DRIVER === 'supabase') return remote.remove(key);
  await unlink(storagePath(key));
}
export async function resumeExists(key) {
  if (env.STORAGE_DRIVER === 'supabase') return (await remote.get(key)) !== null;
  try {
    await access(storagePath(key));
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}
export async function downloadResume(res, key, name, next) {
  if (env.STORAGE_DRIVER === 'supabase') {
    const buffer = await remote.get(key);
    if (!buffer) throw new AppError('Resume file unavailable', 404, 'NOT_FOUND');
    res.set('Cache-Control', 'no-store');
    res.attachment(name);
    res.type('application/pdf');
    return res.send(buffer);
  }
  const target = storagePath(key);
  try {
    await access(target);
  } catch {
    throw new AppError('Resume file unavailable', 404, 'NOT_FOUND');
  }
  res.set('Cache-Control', 'no-store');
  res.download(target, name, (e) => {
    if (e) next(e);
  });
}
