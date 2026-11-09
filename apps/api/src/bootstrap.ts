import argon2 from 'argon2';
import { connect, User, mongoose } from './models.js';
import { encrypt } from './security.js';
const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_MFA_SECRET } = process.env;
if (
  !ADMIN_EMAIL ||
  !ADMIN_PASSWORD ||
  ADMIN_PASSWORD.length < 14 ||
  !ADMIN_MFA_SECRET ||
  !/^[A-Z2-7]{32,}$/.test(ADMIN_MFA_SECRET)
)
  throw Error(
    'Set ADMIN_EMAIL, ADMIN_PASSWORD (14+ chars), ADMIN_MFA_SECRET (base32, 32+ chars). Configure this TOTP secret in your authenticator before login.',
  );
await connect();
if (await User.exists({ email: ADMIN_EMAIL.toLowerCase() }))
  throw Error('Account already exists; bootstrap does not overwrite accounts.');
await User.create({
  email: ADMIN_EMAIL.toLowerCase(),
  name: 'Administrator',
  password: await argon2.hash(ADMIN_PASSWORD),
  permissions: ['catalog', 'operations', 'finance'],
  mfa: encrypt(ADMIN_MFA_SECRET),
});
console.log('Administrator created. MFA is required for login.');
await mongoose.disconnect();
