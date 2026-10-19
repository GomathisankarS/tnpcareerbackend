import argon2 from 'argon2';
import { parse, emailSchema, passwordSchema, text } from '../src/shared/validation.js';
import { transaction, closePool } from '../src/db/pool.js';
import { findContact, createUser } from '../src/modules/auth/auth.repository.js';
try {
  const email = parse(emailSchema, process.env.ADMIN_EMAIL),
    password = parse(passwordSchema, process.env.ADMIN_PASSWORD),
    fullName = parse(text(100), process.env.ADMIN_NAME || 'TNP Administrator');
  const hash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });
  await transaction(async (c) => {
    if (await findContact('email', email, c)) throw new Error('Account already exists');
    await createUser({ email, fullName, mobileNumber: null }, hash, 'admin', c);
  });
  console.info('Administrator created. Existing accounts were not changed.');
} catch {
  console.error(
    'Administrator creation failed. Supply valid local ADMIN_EMAIL/ADMIN_PASSWORD; an existing email is never overwritten.'
  );
  process.exitCode = 1;
} finally {
  await closePool();
}
