import { createHash, randomUUID } from 'node:crypto';
import { config } from './config.js';
import { SimPayment } from './models.js';
import { AppError, safeEqual } from './security.js';
export interface GatewayStatus {
  order_id: string;
  transaction_id?: string;
  gross_amount: string;
  transaction_status: string;
  payment_type?: string;
  fraud_status?: string;
}
const hosts =
  config.midtransEnv === 'production'
    ? { api: 'https://api.midtrans.com', snap: 'https://app.midtrans.com' }
    : { api: 'https://api.sandbox.midtrans.com', snap: 'https://app.sandbox.midtrans.com' };
async function request(base: string, path: string, body?: unknown) {
  const r = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: 'Basic ' + Buffer.from(config.midtransKey + ':').toString('base64'),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new AppError(503, 'GATEWAY_UNAVAILABLE');
  const payload = await r.json();
  if (String(payload.status_code) === '404') return null;
  return payload;
}
export function validPaymentUrl(value: string) {
  try {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      u.hostname === new URL(hosts.snap).hostname &&
      !u.username &&
      !u.password &&
      !u.port
    );
  } catch {
    return false;
  }
}
export async function createPayment(order: any) {
  if (config.provider === 'disabled') throw new AppError(503, 'PAYMENTS_NOT_CONFIGURED');
  if (config.provider === 'simulated') {
    await SimPayment.create({
      order_id: order.gatewayRef,
      transaction_id: randomUUID(),
      gross_amount: String(order.total) + '.00',
      transaction_status: 'pending',
    });
    if (process.env.SIM_TIMEOUT === 'true') throw new Error('Simulated timeout');
    return '/pesanan/' + order.number;
  }
  const result = await request(hosts.snap, '/snap/v1/transactions', {
    transaction_details: { order_id: order.gatewayRef, gross_amount: order.total },
    item_details: [
      ...order.items.map((i: any) => ({
        id: i.sku,
        price: i.price,
        quantity: i.quantity,
        name: i.name.slice(0, 50),
      })),
      { id: 'SHIPPING', price: order.shipping, quantity: 1, name: 'Ongkos kirim' },
    ],
    enabled_payments: config.channels,
    callbacks: { finish: config.origin + '/pesanan/' + order.number },
    expiry: { unit: 'minutes', duration: 60 },
  });
  if (!result?.redirect_url || !validPaymentUrl(result.redirect_url))
    throw new AppError(503, 'INVALID_GATEWAY_URL');
  return result.redirect_url as string;
}
export async function getStatus(ref: string): Promise<GatewayStatus | null> {
  if (config.provider === 'simulated')
    return (await SimPayment.findOne({ order_id: ref }).lean()) as GatewayStatus | null;
  if (config.provider === 'disabled') return null;
  return request(hosts.api, '/v2/' + encodeURIComponent(ref) + '/status');
}
export function validSignature(p: {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
}) {
  if (!/^[a-f0-9]{128}$/i.test(p.signature_key)) return false;
  const expected = createHash('sha512')
    .update(p.order_id + p.status_code + p.gross_amount + config.midtransKey)
    .digest('hex');
  return safeEqual(expected, p.signature_key.toLowerCase());
}
