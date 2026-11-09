import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import argon2 from 'argon2';
import { TOTP, Secret } from 'otpauth';
process.env.MONGODB_URI =
  'mongodb://127.0.0.1:27017/ruang_teduh_test?replicaSet=rs0&directConnection=true';
const { createApp } = await import('../src/app.js');
const {
  connect,
  mongoose,
  User,
  Product,
  Variant,
  Zone,
  Order,
  PaymentCase,
  Audit,
  Event,
  SimPayment,
  Rate,
} = await import('../src/models.js');
const { seed } = await import('../src/seed.js');
const { config, root } = await import('../src/config.js');
const { reconcile, fulfill } = await import('../src/commerce.js');
const { encrypt } = await import('../src/security.js');
const { validPaymentUrl } = await import('../src/gateway.js');
const app = createApp();
const address = {
  name: 'Pembeli Uji',
  phone: '081234567890',
  street: 'Jalan Pengujian No. 10',
  city: 'Jakarta',
  postalCode: '12110',
};
const cart = { items: [{ sku: 'RT-01-1', quantity: 1 }], address };
const password = 'TestingPassword!234';
async function client(admin = false) {
  const agent = request.agent(app);
  let s = (await agent.get('/api/v1/auth/session')).body;
  const email = randomUUID() + '@example.test';
  if (admin) {
    await User.create({
      email,
      name: 'Admin Uji',
      password: await argon2.hash(password),
      permissions: ['catalog', 'operations', 'finance'],
      mfa: encrypt('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'),
    });
  }
  const c: any = {
    agent,
    email,
    csrf: s.csrf,
    post: (path: string, body: any, extra: any = {}) =>
      agent
        .post('/api/v1' + path)
        .set('Origin', config.origin)
        .set('X-CSRF-Token', c.csrf)
        .set(extra)
        .send(body),
  };
  if (!admin) {
    assert.equal(
      (await c.post('/auth/register', { email, password, name: 'Pembeli Uji' })).status,
      201,
    );
    s = (await agent.get('/api/v1/auth/session')).body;
    c.csrf = s.csrf;
    c.userId = s.user.id;
  }
  return c;
}
async function order(c: any, input = cart, key = randomUUID()) {
  const q = await c.post('/checkout/quote', input);
  assert.equal(q.status, 200);
  const body = { ...input, quoteHash: q.body.hash };
  const r = await c.post('/orders', body, { 'Idempotency-Key': key });
  return { r, body, key };
}
async function status(number: string, state: string, extra: Record<string, unknown> = {}) {
  const o = await Order.findOne({ number });
  assert(o);
  await SimPayment.updateOne(
    { order_id: o.gatewayRef },
    { $set: { transaction_status: state, ...extra } },
  );
  await reconcile(o.gatewayRef);
  return await Order.findById(o.id);
}
function signature(ref: string, amount: string) {
  return createHash('sha512')
    .update(ref + '200' + amount + config.midtransKey)
    .digest('hex');
}
before(async () => {
  await connect();
  assert(mongoose.connection.name.endsWith('_test'));
});
beforeEach(async () => {
  delete process.env.SIM_TIMEOUT;
  await Promise.all(
    [User, Product, Variant, Zone, Order, PaymentCase, Audit, Event, SimPayment, Rate].map((m) =>
      m.deleteMany({}),
    ),
  );
  await seed();
});
after(async () => {
  await app.locals.sessionStore.close();
  await mongoose.disconnect();
});
test('catalog filters apply to one variant, exclude unpublished products, paginate and reject operator injection', async () => {
  await Variant.updateOne({ sku: 'RT-01-1' }, { $set: { physical: 0 } });
  let r = await request(app).get('/api/v1/products?category=kasur&max=2000000&stock=true');
  assert.equal(r.body.total, 0);
  r = await request(app).get(
    '/api/v1/products?category=kasur&size=160%20%C3%97%20200&sort=price-asc',
  );
  assert.equal(r.body.total, 2);
  assert.equal(r.body.products[0].price, 3290000);
  await Product.updateOne({ slug: 'kasur-senja' }, { $set: { published: false } });
  assert.equal((await request(app).get('/api/v1/products/kasur-senja')).status, 404);
  assert.equal((await request(app).get('/api/v1/products?q[$ne]=x')).status, 400);
});
test('server quote determines price and shipping; unserved city or postal code is rejected', async () => {
  const c = await client();
  const q = await c.post('/checkout/quote', cart);
  assert.equal(q.body.total, 2040000);
  assert.equal((await c.post('/checkout/quote', { ...cart, price: 1, shipping: 0 })).status, 400);
  assert.equal(
    (await c.post('/checkout/quote', { ...cart, address: { ...address, city: 'Bandung' } })).status,
    422,
  );
  assert.equal(
    (await c.post('/checkout/quote', { ...cart, address: { ...address, postalCode: '99999' } }))
      .status,
    422,
  );
});
test('mixed carts charge each shipping class once; missing class blocks payment', async () => {
  const c = await client();
  const input = {
    ...cart,
    items: [
      { sku: 'RT-01-1', quantity: 1 },
      { sku: 'RT-02-1', quantity: 2 },
    ],
  };
  assert.equal((await c.post('/checkout/quote', input)).body.shipping, 170000);
  await Zone.updateOne({ name: 'Jakarta Demo' }, { $unset: { 'rates.small': 1 } });
  assert.equal((await c.post('/checkout/quote', input)).status, 422);
});
test('changed price and shipping version require a new quote before reservation', async () => {
  const c = await client();
  const q = await c.post('/checkout/quote', cart);
  await Variant.updateOne({ sku: 'RT-01-1' }, { $inc: { price: 1000 } });
  const r = await c.post(
    '/orders',
    { ...cart, quoteHash: q.body.hash },
    { 'Idempotency-Key': randomUUID() },
  );
  assert.equal(r.status, 409);
  assert.equal(r.body.error, 'QUOTE_CHANGED');
  assert.equal(await Order.countDocuments(), 0);
  assert.equal((await Variant.findOne({ sku: 'RT-01-1' }))?.held, 0);
});
test('repeated checkout returns the same order and gateway attempt; changed body conflicts', async () => {
  const c = await client();
  const { r, body, key } = await order(c);
  assert.equal(r.status, 201);
  const replay = await c.post('/orders', body, { 'Idempotency-Key': key });
  assert.equal(replay.body.number, r.body.number);
  assert.equal(await Order.countDocuments(), 1);
  assert.equal(await SimPayment.countDocuments(), 1);
  assert.equal((await Variant.findOne({ sku: 'RT-01-1' }))?.held, 1);
  assert.equal(
    (
      await c.post(
        '/orders',
        { ...body, address: { ...address, name: 'Changed' } },
        { 'Idempotency-Key': key },
      )
    ).body.error,
    'IDEMPOTENCY_CONFLICT',
  );
});
test('parallel identical checkout creates one payable attempt', async () => {
  const c = await client();
  const q = await c.post('/checkout/quote', cart);
  const body = { ...cart, quoteHash: q.body.hash },
    key = randomUUID();
  const results = await Promise.all([
    c.post('/orders', body, { 'Idempotency-Key': key }),
    c.post('/orders', body, { 'Idempotency-Key': key }),
  ]);
  assert(results.every((r) => r.status === 201));
  assert.equal(results[0].body.number, results[1].body.number);
  assert.equal(await SimPayment.countDocuments(), 1);
  assert.equal((await Variant.findOne({ sku: 'RT-01-1' }))?.held, 1);
});
test('two buyers compete for the last SKU: exactly one succeeds', async () => {
  await Variant.updateOne({ sku: 'RT-01-1' }, { $set: { physical: 1 } });
  const a = await client(),
    b = await client();
  const qa = await a.post('/checkout/quote', cart),
    qb = await b.post('/checkout/quote', cart);
  const results = await Promise.all([
    a.post('/orders', { ...cart, quoteHash: qa.body.hash }, { 'Idempotency-Key': randomUUID() }),
    b.post('/orders', { ...cart, quoteHash: qb.body.hash }, { 'Idempotency-Key': randomUUID() }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const v = await Variant.findOne({ sku: 'RT-01-1' });
  assert.equal(v?.held, 1);
  assert.equal(v?.physical, 1);
});
test('CSRF and origin are mandatory for browser writes', async () => {
  const c = await client();
  assert.equal((await c.agent.post('/api/v1/checkout/quote').send(cart)).status, 403);
  assert.equal(
    (
      await c.agent
        .post('/api/v1/checkout/quote')
        .set('Origin', 'https://evil.example')
        .set('X-CSRF-Token', c.csrf)
        .send(cart)
    ).status,
    403,
  );
});
test('customer cannot read another customer order or use admin endpoints', async () => {
  const a = await client(),
    b = await client();
  const { r } = await order(a);
  assert.equal((await b.agent.get('/api/v1/orders/' + r.body.number)).status, 404);
  assert.equal((await b.agent.get('/api/v1/admin/orders')).status, 403);
  assert.equal((await request(app).get('/api/v1/orders/' + r.body.number)).status, 401);
});
test('forged webhook and browser success query cannot mark paid', async () => {
  const c = await client();
  const { r } = await order(c);
  const o = await Order.findOne({ number: r.body.number });
  assert.equal(
    (
      await request(app)
        .post('/api/v1/webhooks/midtrans')
        .send({
          order_id: o!.gatewayRef,
          status_code: '200',
          gross_amount: String(o!.total) + '.00',
          signature_key: '0'.repeat(128),
        })
    ).status,
    401,
  );
  await c.agent.get('/api/v1/orders/' + o!.number + '?transaction_status=settlement');
  assert.equal((await Order.findById(o!.id))?.payment, 'pending');
});
test('valid webhook verifies remote amount; mismatch creates hold without allocating', async () => {
  const c = await client();
  const { r } = await order(c);
  const o = await Order.findOne({ number: r.body.number });
  await SimPayment.updateOne(
    { order_id: o!.gatewayRef },
    { $set: { transaction_status: 'settlement', gross_amount: '1.00' } },
  );
  const amount = String(o!.total) + '.00';
  assert.equal(
    (
      await request(app)
        .post('/api/v1/webhooks/midtrans')
        .send({
          order_id: o!.gatewayRef,
          status_code: '200',
          gross_amount: amount,
          signature_key: signature(o!.gatewayRef, amount),
        })
    ).status,
    200,
  );
  assert.equal((await Order.findById(o!.id))?.payment, 'review');
  assert.equal((await Variant.findOne({ sku: 'RT-01-1' }))?.allocated, 0);
  assert.equal(await PaymentCase.countDocuments(), 1);
});
test('verified duplicate and out-of-order payment status finalizes stock exactly once', async () => {
  const c = await client();
  const { r } = await order(c);
  await status(r.body.number, 'settlement');
  await status(r.body.number, 'settlement');
  await status(r.body.number, 'pending');
  const o = await Order.findOne({ number: r.body.number }),
    v = await Variant.findOne({ sku: 'RT-01-1' });
  assert.equal(o?.payment, 'paid');
  assert.equal(v?.allocated, 1);
  assert.equal(v?.held, 0);
  assert.equal(v?.physical, 12);
});
test('gateway creation timeout retains its durable reference and reconciles without new attempts', async () => {
  const c = await client();
  process.env.SIM_TIMEOUT = 'true';
  const { r, body, key } = await order(c);
  assert.equal(r.body.payment, 'checking');
  delete process.env.SIM_TIMEOUT;
  const replay = await c.post('/orders', body, { 'Idempotency-Key': key });
  assert.equal(replay.body.number, r.body.number);
  assert.equal(await SimPayment.countDocuments(), 1);
  assert.equal((await status(r.body.number, 'settlement'))?.payment, 'paid');
});
test('abandoned Snap with status 404 keeps reservation and creates a case after deadline', async () => {
  const c = await client();
  const { r } = await order(c);
  const o = await Order.findOne({ number: r.body.number });
  await SimPayment.deleteMany({});
  await Order.updateOne({ _id: o!.id }, { $set: { expiresAt: new Date(0) } });
  await reconcile(o!.gatewayRef);
  assert.equal((await Order.findById(o!.id))?.reservation, 'held');
  assert.equal((await Variant.findOne({ sku: 'RT-01-1' }))?.held, 1);
  assert.equal(await PaymentCase.countDocuments({ reason: 'GATEWAY_STATUS_UNKNOWN' }), 1);
});
test('verified expiry releases once; late payment holds fulfillment', async () => {
  const c = await client();
  const { r } = await order(c);
  await status(r.body.number, 'expire');
  await status(r.body.number, 'expire');
  assert.equal((await Variant.findOne({ sku: 'RT-01-1' }))?.held, 0);
  const late = await status(r.body.number, 'settlement');
  assert.equal(late?.payment, 'review');
  assert.equal(late?.reservation, 'released');
  assert.equal(await PaymentCase.countDocuments({ reason: 'LATE_PAYMENT' }), 1);
  await assert.rejects(fulfill(r.body.number, 'admin', 'ready'));
});
test('refund and chargeback create cases without returning shipped stock', async () => {
  const c = await client();
  const { r } = await order(c);
  await status(r.body.number, 'settlement');
  await fulfill(r.body.number, 'admin', 'ready');
  await fulfill(r.body.number, 'admin', 'shipped', 'TEST-TRACK-1');
  await status(r.body.number, 'refund');
  await status(r.body.number, 'chargeback');
  assert.equal((await Variant.findOne({ sku: 'RT-01-1' }))?.physical, 11);
  assert.equal(await PaymentCase.countDocuments(), 2);
});
test('shipping requires verified payment, follows transitions, and consumes physical allocation once', async () => {
  const c = await client();
  const { r } = await order(c);
  await assert.rejects(fulfill(r.body.number, 'admin', 'ready'));
  await status(r.body.number, 'settlement');
  await assert.rejects(fulfill(r.body.number, 'admin', 'shipped', 'TEST'));
  await fulfill(r.body.number, 'admin', 'ready');
  await assert.rejects(fulfill(r.body.number, 'admin', 'shipped'));
  await fulfill(r.body.number, 'admin', 'shipped', 'TEST-TRACK-2');
  await assert.rejects(fulfill(r.body.number, 'admin', 'shipped', 'TEST-TRACK-2'));
  await fulfill(r.body.number, 'admin', 'delivered');
  const v = await Variant.findOne({ sku: 'RT-01-1' });
  assert.equal(v?.physical, 11);
  assert.equal(v?.allocated, 0);
});
test('admin login requires MFA and enforces stock floors with audited changes', async () => {
  const c = await client(true);
  assert.equal(
    (await c.post('/auth/login', { email: c.email, password })).body.error,
    'MFA_REQUIRED',
  );
  const code = new TOTP({
    secret: Secret.fromBase32('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'),
  }).generate();
  assert.equal((await c.post('/auth/login', { email: c.email, password, code })).status, 200);
  const session = (await c.agent.get('/api/v1/auth/session')).body;
  c.csrf = session.csrf;
  assert(session.user.mfa);
  assert.equal((await c.agent.get('/api/v1/admin/products')).status, 200);
  await Variant.updateOne({ sku: 'RT-01-1' }, { $set: { held: 2 } });
  const v = {
    sku: 'RT-01-1',
    product: 'kasur-senja',
    label: 'Test',
    price: 1890000,
    physical: 1,
    shippingClass: 'large',
    attributes: {},
  };
  let r = await c.agent
    .put('/api/v1/admin/variants/RT-01-1')
    .set('Origin', config.origin)
    .set('X-CSRF-Token', c.csrf)
    .send(v);
  assert.equal(r.status, 409);
  r = await c.agent
    .put('/api/v1/admin/variants/RT-01-1')
    .set('Origin', config.origin)
    .set('X-CSRF-Token', c.csrf)
    .send({ ...v, physical: 12 });
  assert.equal(r.status, 200);
  assert.equal(await Audit.countDocuments({ action: 'variant.update' }), 1);
});
test('password reset is uniform, expiring, single use and revokes existing sessions', async () => {
  const c = await client();
  const known = await c.post('/auth/forgot', { email: c.email });
  const unknown = await c.post('/auth/forgot', { email: 'not-registered@example.test' });
  assert.deepEqual(known.body, unknown.body);
  const mail = JSON.parse(await readFile(root + '.data/reset-mail.json', 'utf8'));
  const token = new URL(mail.text.split(' ').at(-1)).searchParams.get('token');
  const guest = await client();
  assert.equal(
    (await guest.post('/auth/reset', { token, password: 'NewPassword!12345' })).status,
    200,
  );
  assert.equal(
    (await guest.post('/auth/reset', { token, password: 'AnotherPassword!123' })).status,
    400,
  );
  assert.equal((await c.agent.get('/api/v1/orders')).status, 401);
});
test('logout invalidates session and login rotates session identifier', async () => {
  const c = await client();
  await c.post('/auth/logout', {});
  assert.equal((await c.agent.get('/api/v1/orders')).status, 401);
  const s = await c.agent.get('/api/v1/auth/session');
  c.csrf = s.body.csrf;
  const login = await c.post('/auth/login', { email: c.email, password });
  assert.equal(login.status, 200);
  assert.notEqual(login.headers['set-cookie']?.[0], s.headers['set-cookie']?.[0]);
});
test('gateway redirect accepts only HTTPS on the exact active Midtrans host', () => {
  assert(validPaymentUrl('https://app.sandbox.midtrans.com/snap/v2/vtweb/token'));
  for (const url of [
    'http://app.sandbox.midtrans.com/x',
    'https://app.sandbox.midtrans.com.evil.test/x',
    'https://evil.test/x',
    'https://user@app.sandbox.midtrans.com/x',
    'javascript:alert(1)',
  ])
    assert(!validPaymentUrl(url));
});

test('unsupported payment channel cannot allocate inventory', async () => {
  const c = await client();
  const { r } = await order(c);
  const o = await status(r.body.number, 'settlement', {
    payment_type: 'credit_card',
    fraud_status: 'deny',
  });
  assert.equal(o?.payment, 'review');
  assert.equal(o?.reservation, 'held');
  assert.equal(await PaymentCase.countDocuments({ reason: 'PAYMENT_CHANNEL_REVIEW' }), 1);
});
test('expired password reset token is rejected', async () => {
  const c = await client();
  await c.post('/auth/forgot', { email: c.email });
  const mail = JSON.parse(await readFile(root + '.data/reset-mail.json', 'utf8'));
  const token = new URL(mail.text.split(' ').at(-1)).searchParams.get('token');
  await User.updateOne({ email: c.email }, { $set: { resetExpires: new Date(0) } });
  assert.equal((await c.post('/auth/reset', { token, password: 'NeverAccepted!123' })).status, 400);
});
test('zero maximum price means no priced products', async () => {
  const response = await request(app).get('/api/v1/products?max=0');
  assert.equal(response.status, 200);
  assert.equal(response.body.total, 0);
});
