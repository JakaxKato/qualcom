import mongoose, { Schema, model } from 'mongoose';
import { config } from './config.js';
const options = { timestamps: true };
export const User = model(
  'User',
  new Schema(
    {
      email: { type: String, unique: true, required: true },
      name: { type: String, required: true },
      password: { type: String, required: true, select: false },
      permissions: [String],
      mfa: { type: String, select: false },
      mfaCounter: { type: Number, default: -1 },
      sessionVersion: { type: Number, default: 0 },
      resetHash: { type: String, select: false },
      resetExpires: Date,
    },
    options,
  ),
);
export const Product = model(
  'Product',
  new Schema(
    {
      slug: { type: String, unique: true, required: true },
      name: { type: String, required: true },
      category: { type: String, enum: ['kasur', 'bantal', 'furnitur'], required: true },
      description: String,
      care: String,
      image: String,
      alt: String,
      published: { type: Boolean, default: false },
      featured: { type: Boolean, default: false },
    },
    options,
  ),
);
export const Variant = model(
  'Variant',
  new Schema(
    {
      sku: { type: String, required: true, unique: true },
      product: { type: String, required: true, index: true },
      label: { type: String, required: true },
      price: { type: Number, required: true, min: 0 },
      physical: { type: Number, default: 0, min: 0 },
      held: { type: Number, default: 0, min: 0 },
      allocated: { type: Number, default: 0, min: 0 },
      shippingClass: { type: String, required: true },
      image: String,
      attributes: { type: Map, of: String },
    },
    options,
  ),
);
export const Zone = model(
  'Zone',
  new Schema(
    {
      name: { type: String, unique: true, required: true },
      city: { type: String, required: true },
      postalPrefixes: [String],
      active: { type: Boolean, default: true },
      version: { type: Number, default: 1 },
      rates: { type: Map, of: Number },
    },
    options,
  ),
);
const item = new Schema(
  { sku: String, name: String, label: String, price: Number, quantity: Number, image: String },
  { _id: false },
);
const orderSchema = new Schema(
  {
    number: { type: String, unique: true, required: true },
    userId: { type: String, required: true, index: true },
    key: String,
    requestHash: String,
    items: [item],
    address: { type: Schema.Types.Mixed, required: true },
    subtotal: Number,
    shipping: Number,
    shippingVersion: String,
    shippingBreakdown: { type: Schema.Types.Mixed },
    total: { type: Number, required: true },
    payment: { type: String, default: 'checking' },
    fulfillment: { type: String, default: 'unprocessed' },
    reservation: { type: String, default: 'held' },
    gatewayRef: { type: String, unique: true, required: true },
    transactionId: String,
    paymentUrl: String,
    attempt: { type: String, default: 'creating' },
    gatewayStatus: String,
    holdReason: String,
    tracking: String,
    expiresAt: Date,
    paidAt: Date,
  },
  options,
);
orderSchema.index({ userId: 1, key: 1 }, { unique: true });
orderSchema.index(
  { transactionId: 1 },
  { unique: true, partialFilterExpression: { transactionId: { $type: 'string' } } },
);
export const Order = model('Order', orderSchema);
export const PaymentCase = model(
  'PaymentCase',
  new Schema(
    {
      order: { type: String, required: true },
      reason: { type: String, required: true },
      owner: String,
      status: { type: String, default: 'open' },
      notes: [{ actor: String, text: String, at: Date }],
    },
    options,
  ).index({ order: 1, reason: 1 }, { unique: true }),
);
export const Audit = model(
  'Audit',
  new Schema(
    { actor: String, action: String, target: String, details: Schema.Types.Mixed },
    options,
  ),
);
export const Event = model(
  'Event',
  new Schema(
    {
      order: String,
      kind: String,
      status: String,
      attempts: { type: Number, default: 0 },
      nextAttempt: Date,
    },
    options,
  ),
);
export const SimPayment = model(
  'SimPayment',
  new Schema(
    {
      order_id: { type: String, unique: true },
      transaction_id: String,
      gross_amount: String,
      transaction_status: String,
      payment_type: { type: String, default: 'bank_transfer' },
      fraud_status: String,
      creationTimeout: Boolean,
    },
    options,
  ),
);
export const Rate = model(
  'Rate',
  new Schema({ _id: String, count: Number, expiresAt: Date }).index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 },
  ),
);
export async function connect() {
  await mongoose.connect(config.db);
  await Promise.all(
    [User, Product, Variant, Zone, Order, PaymentCase, Audit, Event, SimPayment, Rate].map((m) =>
      m.init(),
    ),
  );
}
export { mongoose };
