import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { mongoose, Variant, Product, Zone, Order, PaymentCase, Audit } from './models.js';
import { AppError, digest } from './security.js';
import { createPayment, getStatus } from './gateway.js';
import { config } from './config.js';
export const addressSchema = z
  .object({
    name: z.string().min(2).max(80),
    phone: z.string().regex(/^\+?[0-9 -]{9,18}$/),
    street: z.string().min(8).max(300),
    city: z.string().min(2).max(80),
    postalCode: z.string().regex(/^\d{5}$/),
  })
  .strict();
export const cartSchema = z
  .object({
    items: z
      .array(
        z
          .object({ sku: z.string().min(1).max(80), quantity: z.number().int().min(1).max(20) })
          .strict(),
      )
      .min(1)
      .max(30),
    address: addressSchema,
  })
  .strict();
export type CartInput = z.infer<typeof cartSchema>;
export async function quote(input: CartInput, session?: mongoose.ClientSession) {
  const merged = new Map<string, number>();
  for (const i of input.items) merged.set(i.sku, (merged.get(i.sku) || 0) + i.quantity);
  const items = [];
  const classes = new Set<string>();
  for (const [sku, quantity] of [...merged].sort(([a], [b]) => a.localeCompare(b))) {
    if (quantity > 20) throw new AppError(400, 'QUANTITY_LIMIT');
    const v = await Variant.findOne({ sku }).session(session || null);
    const p = v
      ? await Product.findOne({ slug: v.product, published: true }).session(session || null)
      : null;
    if (!v || !p) throw new AppError(409, 'PRODUCT_UNAVAILABLE');
    if (v.physical - v.held - v.allocated < quantity)
      throw new AppError(409, 'OUT_OF_STOCK', { sku });
    items.push({
      sku,
      quantity,
      name: p.name,
      label: v.label,
      price: v.price,
      image: v.image || p.image,
    });
    classes.add(v.shippingClass);
  }
  const zones = await Zone.find({
    active: true,
    city: input.address.city.toLowerCase().trim(),
  }).session(session || null);
  const zone = zones.find((z) =>
    z.postalPrefixes.some((p) => input.address.postalCode.startsWith(p)),
  );
  if (!zone) throw new AppError(422, 'SHIPPING_UNAVAILABLE');
  const breakdown = [...classes].sort().map((c) => {
    const rate = zone.rates?.get(c);
    if (rate === undefined) throw new AppError(422, 'SHIPPING_UNAVAILABLE');
    return { class: c, amount: rate };
  });
  const subtotal = items.reduce((n, i) => n + i.quantity * i.price, 0),
    shipping = breakdown.reduce((n, b) => n + b.amount, 0);
  const data = {
    items,
    address: input.address,
    subtotal,
    shipping,
    shippingBreakdown: breakdown,
    shippingVersion: zone.id + ':' + zone.version,
    total: subtotal + shipping,
  };
  return { ...data, hash: digest(data) };
}
export async function checkout(
  userId: string,
  key: string,
  body: CartInput & { quoteHash: string },
) {
  if (!config.checkout) throw new AppError(503, 'CHECKOUT_PAUSED');
  if (config.provider === 'disabled') throw new AppError(503, 'PAYMENTS_NOT_CONFIGURED');
  const requestHash = digest(body);
  const existing = await Order.findOne({ userId, key });
  if (existing) {
    if (existing.requestHash !== requestHash) throw new AppError(409, 'IDEMPOTENCY_CONFLICT');
    return existing;
  }
  let created: any;
  let ownsAttempt = false;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      ownsAttempt = false;
      const old = await Order.findOne({ userId, key }).session(session);
      if (old) {
        if (old.requestHash !== requestHash) throw new AppError(409, 'IDEMPOTENCY_CONFLICT');
        created = old;
        return;
      }
      const q = await quote(body, session);
      if (q.hash !== body.quoteHash) throw new AppError(409, 'QUOTE_CHANGED', q);
      for (const i of q.items) {
        const result = await Variant.updateOne(
          {
            sku: i.sku,
            $expr: {
              $gte: [{ $subtract: ['$physical', { $add: ['$held', '$allocated'] }] }, i.quantity],
            },
          },
          { $inc: { held: i.quantity } },
          { session },
        );
        if (result.modifiedCount !== 1) throw new AppError(409, 'OUT_OF_STOCK');
      }
      ownsAttempt = true;
      [created] = await Order.create(
        [
          {
            ...q,
            number: 'RT-' + randomUUID().slice(0, 8).toUpperCase(),
            userId,
            key,
            requestHash,
            gatewayRef: 'rt-' + randomUUID(),
            expiresAt: new Date(Date.now() + 3600000),
          },
        ],
        { session },
      );
    });
  } catch (e: any) {
    if (e.code === 11000) {
      const same = await Order.findOne({ userId, key });
      if (same && same.requestHash === requestHash) return same;
      if (same) throw new AppError(409, 'IDEMPOTENCY_CONFLICT');
    }
    throw e;
  } finally {
    await session.endSession();
  }
  if (!ownsAttempt) return created;
  // Only the creator reaches the external call. Replays return the durable attempt.
  try {
    const url = await createPayment(created);
    await Order.updateOne(
      { _id: created._id },
      { $set: { paymentUrl: url, attempt: 'active', payment: 'pending' } },
    );
  } catch {
    await Order.updateOne(
      { _id: created._id },
      { $set: { attempt: 'uncertain', payment: 'checking' } },
    );
  }
  return Order.findById(created._id);
}
export async function reconcile(ref: string) {
  const status = await getStatus(ref);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const o = await Order.findOne({ gatewayRef: ref }).session(session);
      if (!o) throw new AppError(404, 'ORDER_NOT_FOUND');
      const flag = async (reason: string) => {
        o.payment = 'review';
        o.holdReason = reason;
        await PaymentCase.updateOne(
          { order: o.number, reason },
          { $setOnInsert: { status: 'open' } },
          { upsert: true, session },
        );
      };
      if (!status) {
        if (o.expiresAt && o.expiresAt.getTime() < Date.now() && o.reservation === 'held')
          await flag('GATEWAY_STATUS_UNKNOWN');
        await o.save({ session });
        return;
      }
      const amount = /^\d+(\.00)?$/.test(status.gross_amount) ? Number(status.gross_amount) : NaN;
      if (
        status.order_id !== ref ||
        amount !== o.total ||
        !status.transaction_id ||
        (o.transactionId && o.transactionId !== status.transaction_id)
      ) {
        await flag('PAYMENT_MISMATCH');
        await o.save({ session });
        return;
      }
      o.transactionId = status.transaction_id;
      o.gatewayStatus = status.transaction_status;
      o.attempt = 'known';
      const paid =
        status.transaction_status === 'settlement' ||
        (status.transaction_status === 'capture' &&
          status.payment_type === 'credit_card' &&
          status.fraud_status === 'accept' &&
          config.channels.includes('credit_card'));
      const allowedChannel =
        config.channels.includes(status.payment_type || '') ||
        (status.payment_type === 'bank_transfer' && config.channels.some((c) => c.endsWith('_va')));
      if (
        paid &&
        (!allowedChannel ||
          (status.payment_type === 'credit_card' && status.fraud_status !== 'accept'))
      ) {
        await flag('PAYMENT_CHANNEL_REVIEW');
      } else if (paid) {
        if (o.reservation === 'released') await flag('LATE_PAYMENT');
        else if (o.reservation === 'held' && !o.holdReason) {
          for (const i of o.items)
            await Variant.updateOne(
              { sku: i.sku },
              { $inc: { held: -i.quantity!, allocated: i.quantity! } },
              { session },
            );
          o.reservation = 'allocated';
          o.payment = 'paid';
          o.paidAt = new Date();
        }
      } else if (
        ['refund', 'partial_refund', 'chargeback', 'partial_chargeback'].includes(
          status.transaction_status,
        )
      ) {
        await flag(status.transaction_status.toUpperCase());
      } else if (['cancel', 'deny', 'expire', 'failure'].includes(status.transaction_status)) {
        if (o.reservation === 'held' && !o.holdReason) {
          for (const i of o.items)
            await Variant.updateOne({ sku: i.sku }, { $inc: { held: -i.quantity! } }, { session });
          o.reservation = 'released';
          o.payment = status.transaction_status;
        } else if (o.reservation === 'allocated' || o.reservation === 'shipped')
          await flag('CONFLICTING_PAYMENT_STATUS');
      } else if (status.transaction_status === 'pending') {
        if (o.reservation === 'held' && !o.holdReason) o.payment = 'pending';
      } else if (o.payment !== 'paid') await flag('UNRECOGNIZED_GATEWAY_STATUS');
      await o.save({ session });
      await Audit.create(
        [
          {
            actor: 'gateway',
            action: 'payment.reconcile',
            target: o.number,
            details: { status: o.gatewayStatus, payment: o.payment, reservation: o.reservation },
          },
        ],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
  return Order.findOne({ gatewayRef: ref });
}
export async function fulfill(number: string, actor: string, status: string, tracking?: string) {
  const s = await mongoose.startSession();
  try {
    await s.withTransaction(async () => {
      const o = await Order.findOne({ number }).session(s);
      if (!o) throw new AppError(404, 'ORDER_NOT_FOUND');
      if (
        o.payment !== 'paid' ||
        o.holdReason ||
        !['allocated', 'shipped'].includes(o.reservation!)
      )
        throw new AppError(409, 'ORDER_ON_HOLD');
      const allowed: Record<string, string> = {
        unprocessed: 'ready',
        ready: 'shipped',
        shipped: 'delivered',
      };
      if (allowed[o.fulfillment!] !== status) throw new AppError(409, 'INVALID_TRANSITION');
      if (status === 'shipped') {
        if (!tracking) throw new AppError(400, 'TRACKING_REQUIRED');
        for (const i of o.items)
          await Variant.updateOne(
            { sku: i.sku },
            { $inc: { physical: -i.quantity!, allocated: -i.quantity! } },
            { session: s },
          );
        o.reservation = 'shipped';
        o.tracking = tracking;
      }
      o.fulfillment = status;
      await o.save({ session: s });
      await Audit.create(
        [{ actor, action: 'order.fulfill', target: number, details: { status, tracking } }],
        { session: s },
      );
    });
  } finally {
    await s.endSession();
  }
}
