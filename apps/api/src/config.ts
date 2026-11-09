import 'dotenv/config';
import { config as dotenv } from 'dotenv';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../../../', import.meta.url));
dotenv({ path: root + '.env', quiet: true });
const prod = process.env.NODE_ENV === 'production';
const provider = process.env.PAYMENT_PROVIDER || 'disabled';
if (!['disabled', 'midtrans', 'simulated'].includes(provider))
  throw Error('Invalid payment provider');
if (provider === 'simulated' && process.env.NODE_ENV !== 'test')
  throw Error('Simulated payments require NODE_ENV=test');
let local: Record<string, string> = {};
if (!prod) {
  mkdirSync(root + '.data', { recursive: true, mode: 0o700 });
  const file = root + '.data/dev-secrets.json';
  if (!existsSync(file))
    writeFileSync(
      file,
      JSON.stringify({
        session: randomBytes(32).toString('hex'),
        mfa: randomBytes(32).toString('hex'),
      }),
      { mode: 0o600, flag: 'wx' },
    );
  local = JSON.parse(readFileSync(file, 'utf8'));
}
export const config = {
  prod,
  provider,
  port: Number(process.env.PORT || 3001),
  origin: process.env.APP_ORIGIN || 'http://localhost:5173',
  db:
    process.env.MONGODB_URI ||
    'mongodb://127.0.0.1:27017/ruang_teduh?replicaSet=rs0&directConnection=true',
  session: process.env.SESSION_SECRET || local.session,
  mfaKey: process.env.MFA_ENCRYPTION_KEY || local.mfa,
  midtransEnv: process.env.MIDTRANS_ENV || 'sandbox',
  midtransKey:
    process.env.MIDTRANS_SERVER_KEY || (provider === 'simulated' ? 'test-only-signature-key' : ''),
  channels: (process.env.MIDTRANS_CHANNELS || 'bank_transfer,qris').split(','),
  brand: process.env.BRAND_NAME || 'Ruang Teduh',
  demo: process.env.DEMO_MODE !== 'false',
  support: process.env.SUPPORT_EMAIL || '',
  checkout: process.env.CHECKOUT_ENABLED !== 'false',
};
if (!config.session || config.session.length < 32 || !/^[a-f0-9]{64}$/i.test(config.mfaKey || ''))
  throw Error('SESSION_SECRET (32+ chars) and MFA_ENCRYPTION_KEY (64 hex chars) required');
if (provider === 'midtrans' && !config.midtransKey) throw Error('MIDTRANS_SERVER_KEY required');
if (!['sandbox', 'production'].includes(config.midtransEnv))
  throw Error('Invalid Midtrans environment');
if (
  prod &&
  (!config.origin.startsWith('https://') ||
    config.demo ||
    !process.env.SMTP_URL?.startsWith('smtps://') ||
    !process.env.MAIL_FROM)
)
  throw Error('Production requires HTTPS, DEMO_MODE=false and SMTPS configuration');
