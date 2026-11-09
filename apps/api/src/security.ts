import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
  createHash,
} from 'node:crypto';
import { TOTP, Secret } from 'otpauth';
import type { Request, Response, NextFunction } from 'express';
import { config } from './config.js';
import { User, Rate } from './models.js';
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    public details?: unknown,
  ) {
    super(code);
  }
}
export const digest = (data: unknown) =>
  createHash('sha256').update(JSON.stringify(data)).digest('hex');
export const randomToken = () => randomBytes(32).toString('hex');
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function encrypt(text: string) {
  const iv = randomBytes(12),
    c = createCipheriv('aes-256-gcm', Buffer.from(config.mfaKey, 'hex'), iv);
  return Buffer.concat([iv, c.update(text), c.final(), c.getAuthTag()]).toString('base64');
}
export function decrypt(text: string) {
  const b = Buffer.from(text, 'base64'),
    d = createDecipheriv('aes-256-gcm', Buffer.from(config.mfaKey, 'hex'), b.subarray(0, 12));
  d.setAuthTag(b.subarray(-16));
  return Buffer.concat([d.update(b.subarray(12, -16)), d.final()]).toString();
}
export async function verifyMfa(user: any, token: string) {
  if (!/^\d{6}$/.test(token) || !user.mfa) return false;
  const totp = new TOTP({ secret: Secret.fromBase32(decrypt(user.mfa)) });
  const delta = totp.validate({ token, window: 1 });
  if (delta === null) return false;
  const counter = Math.floor(Date.now() / 30000) + delta;
  return !!(await User.findOneAndUpdate(
    { _id: user._id, mfaCounter: { $lt: counter } },
    { $set: { mfaCounter: counter } },
  ));
}
declare module 'express-session' {
  interface SessionData {
    userId: string;
    version: number;
    csrf: string;
    mfa: boolean;
  }
}
export async function auth(req: Request, _res: Response, next: NextFunction) {
  const user = req.session.userId ? await User.findById(req.session.userId) : null;
  if (!user || user.sessionVersion !== req.session.version)
    throw new AppError(401, 'LOGIN_REQUIRED');
  next();
}
export function permit(permission: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const user = await User.findById(req.session.userId);
    if (!req.session.mfa || !user?.permissions.includes(permission))
      throw new AppError(403, 'FORBIDDEN');
    next();
  };
}
export function csrf(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.path === '/webhooks/midtrans')
    return next();
  if (
    req.get('origin') !== config.origin ||
    !req.session.csrf ||
    !safeEqual(req.get('x-csrf-token') || '', req.session.csrf)
  )
    throw new AppError(403, 'CSRF_INVALID');
  next();
}
export function limit(scope: string, max: number) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const identity =
      scope === 'auth'
        ? String(req.body?.email || req.session.userId || req.ip).toLowerCase()
        : `${req.ip}:${req.session.userId || ''}`;
    const bucket = Math.floor(Date.now() / 60000),
      id = digest([scope, identity, bucket]);
    const rate = await Rate.findOneAndUpdate(
      { _id: id },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + 120000) } },
      { upsert: true, new: true },
    );
    if ((rate.count || 0) > max) throw new AppError(429, 'RATE_LIMITED');
    next();
  };
}
