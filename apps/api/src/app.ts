import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import helmet from 'helmet';
import argon2 from 'argon2';
import nodemailer from 'nodemailer';
import { writeFile } from 'node:fs/promises';
import { z, ZodError } from 'zod';
import { config, root } from './config.js';
import {
  User,
  Product,
  Variant,
  Zone,
  Order,
  PaymentCase,
  Audit,
  Event,
  SimPayment,
  mongoose,
} from './models.js';
import { auth, permit, csrf, limit, AppError, randomToken, digest, verifyMfa } from './security.js';
import { quote, checkout, cartSchema, reconcile, fulfill } from './commerce.js';
import { validSignature } from './gateway.js';
const credentials = z
  .object({
    email: z
      .email()
      .max(200)
      .transform((s) => s.toLowerCase()),
    password: z.string().min(10).max(128),
    code: z.string().optional(),
  })
  .strict();
const variantInput = z
  .object({
    sku: z.string().regex(/^[A-Z0-9-]{2,60}$/),
    product: z.string().max(100),
    label: z.string().min(1).max(100),
    price: z.number().int().min(1).max(100000000),
    physical: z.number().int().min(0),
    shippingClass: z.enum(['small', 'medium', 'large']),
    image: z
      .string()
      .regex(/^\/images\/[\w.-]+$/)
      .optional(),
    attributes: z.record(z.string().max(40), z.string().max(100)),
  })
  .strict();
const productInput = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]{2,100}$/),
    name: z.string().min(2).max(120),
    category: z.enum(['kasur', 'bantal', 'furnitur']),
    description: z.string().min(10).max(3000),
    care: z.string().max(1000),
    image: z.string().regex(/^\/images\/[\w.-]+$/),
    alt: z.string().min(3).max(200),
    published: z.boolean(),
    featured: z.boolean(),
  })
  .strict();
const zoneInput = z
  .object({
    name: z.string().min(2),
    city: z
      .string()
      .min(2)
      .transform((v) => v.toLowerCase().trim()),
    postalPrefixes: z.array(z.string().regex(/^\d{1,5}$/)).min(1),
    active: z.boolean(),
    rates: z.record(z.enum(['small', 'medium', 'large']), z.number().int().min(0).max(10000000)),
  })
  .strict();
const present = (o: any) => ({
  number: o.number,
  items: o.items,
  address: o.address,
  subtotal: o.subtotal,
  shipping: o.shipping,
  total: o.total,
  payment: o.payment,
  fulfillment: o.fulfillment,
  reservation: o.reservation,
  tracking: o.tracking,
  createdAt: o.createdAt,
  paymentUrl: o.reservation === 'held' && !o.holdReason ? o.paymentUrl : undefined,
});
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.prod) app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      strictTransportSecurity: config.prod ? undefined : false,
    }),
  );
  app.use(express.json({ limit: '32kb' }));
  const store = MongoStore.create({ mongoUrl: config.db, collectionName: 'sessions', ttl: 86400 });
  app.locals.sessionStore = store;
  app.use(
    '/api/v1',
    session({
      name: 'rt.sid',
      secret: config.session,
      store,
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, secure: config.prod, sameSite: 'lax', maxAge: 86400000 },
    }),
  );
  const api = express.Router();
  app.use('/api/v1', api);
  api.use(csrf);
  api.get('/health', async (_req, res) => {
    await mongoose.connection.db!.admin().ping();
    res.json({ ok: true });
  });
  api.get('/config', (_req, res) =>
    res.json({
      brand: config.brand,
      demo: config.demo,
      support: config.support,
      payments: config.provider,
      checkout: config.checkout,
    }),
  );
  api.get('/auth/session', async (req, res) => {
    req.session.csrf ||= randomToken();
    const user = req.session.userId ? await User.findById(req.session.userId) : null;
    res.json({
      csrf: req.session.csrf,
      user:
        user && user.sessionVersion === req.session.version
          ? {
              id: user.id,
              name: user.name,
              email: user.email,
              permissions: user.permissions,
              mfa: !!req.session.mfa,
            }
          : null,
    });
  });
  api.use('/auth', limit('auth-ip', 40), limit('auth', 12));
  const signIn = async (req: express.Request, user: any) => {
    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((e) => (e ? reject(e) : resolve())),
    );
    req.session.userId = user.id;
    req.session.version = user.sessionVersion;
    req.session.mfa = user.permissions.length > 0;
    req.session.csrf = randomToken();
    await new Promise<void>((resolve, reject) =>
      req.session.save((e) => (e ? reject(e) : resolve())),
    );
  };
  api.post('/auth/register', async (req, res) => {
    const b = credentials.extend({ name: z.string().min(2).max(80) }).parse(req.body);
    const user = await User.create({
      email: b.email,
      name: b.name,
      password: await argon2.hash(b.password, { type: argon2.argon2id }),
      permissions: [],
    });
    await signIn(req, user);
    res.status(201).json({ ok: true });
  });
  api.post('/auth/login', async (req, res) => {
    const b = credentials.parse(req.body);
    const u = await User.findOne({ email: b.email }).select('+password +mfa');
    if (!u || !(await argon2.verify(u.password, b.password)))
      throw new AppError(401, 'INVALID_CREDENTIALS');
    if (u.permissions.length && !(await verifyMfa(u, b.code || '')))
      throw new AppError(401, 'MFA_REQUIRED');
    await signIn(req, u);
    res.json({ ok: true });
  });
  api.post('/auth/logout', auth, async (req, res) => {
    await new Promise<void>((resolve, reject) =>
      req.session.destroy((e) => (e ? reject(e) : resolve())),
    );
    res.clearCookie('rt.sid', { path: '/' }).json({ ok: true });
  });
  api.post('/auth/forgot', async (req, res) => {
    const { email } = z
      .object({ email: z.email().transform((v) => v.toLowerCase()) })
      .strict()
      .parse(req.body);
    const u = await User.findOne({ email });
    if (u) {
      const token = randomToken();
      await User.updateOne(
        { _id: u._id },
        { $set: { resetHash: digest(token), resetExpires: new Date(Date.now() + 900000) } },
      );
      const link = config.origin + '/reset?token=' + token;
      const message = {
        from: process.env.MAIL_FROM,
        to: email,
        subject: 'Atur ulang kata sandi Ruang Teduh',
        text: 'Tautan berlaku 15 menit: ' + link,
      };
      if (process.env.SMTP_URL) {
        try {
          await nodemailer.createTransport(process.env.SMTP_URL).sendMail(message);
        } catch {
          console.error('Password reset email delivery failed');
        }
      } else if (!config.prod) {
        await writeFile(root + '.data/reset-mail.json', JSON.stringify(message), { mode: 0o600 });
      }
    }
    res.json({ message: 'Jika email terdaftar, tautan pengaturan ulang akan dikirim.' });
  });
  api.post('/auth/reset', async (req, res) => {
    const b = z
      .object({ token: z.string().length(64), password: z.string().min(10).max(128) })
      .strict()
      .parse(req.body);
    const password = await argon2.hash(b.password, { type: argon2.argon2id });
    const u = await User.findOneAndUpdate(
      { resetHash: digest(b.token), resetExpires: { $gt: new Date() } },
      {
        $set: { password },
        $unset: { resetHash: 1, resetExpires: 1 },
        $inc: { sessionVersion: 1 },
      },
    );
    if (!u) throw new AppError(400, 'RESET_EXPIRED');
    res.json({ ok: true });
  });
  api.use('/products', limit('catalog', 120));
  api.get('/products', async (req, res) => {
    const q = z
      .object({
        q: z.string().max(100).optional(),
        category: z.enum(['kasur', 'bantal', 'furnitur']).optional(),
        sort: z.enum(['featured', 'price-asc', 'price-desc', 'name']).default('featured'),
        min: z.coerce.number().min(0).optional(),
        max: z.coerce.number().min(0).optional(),
        stock: z.enum(['true']).optional(),
        page: z.coerce.number().int().min(1).default(1),
        size: z.string().max(100).optional(),
        firmness: z.string().max(100).optional(),
        thickness: z.string().max(100).optional(),
        fill: z.string().max(100).optional(),
        height: z.string().max(100).optional(),
        material: z.string().max(100).optional(),
        finish: z.string().max(100).optional(),
        dimensions: z.string().max(100).optional(),
      })
      .strict()
      .parse(req.query);
    const variantFilter: Record<string, unknown> = {};
    if (q.min !== undefined || q.max !== undefined)
      variantFilter.price = {
        ...(q.min !== undefined ? { $gte: q.min } : {}),
        ...(q.max !== undefined ? { $lte: q.max } : {}),
      };
    if (q.stock) variantFilter.available = { $gt: 0 };
    for (const key of [
      'size',
      'firmness',
      'thickness',
      'fill',
      'height',
      'material',
      'finish',
      'dimensions',
    ] as const) {
      if (q[key]) variantFilter['attributes.' + key] = q[key];
    }
    const sort: Record<string, 1 | -1> =
      q.sort === 'price-asc'
        ? { price: 1, slug: 1 }
        : q.sort === 'price-desc'
          ? { price: -1, slug: 1 }
          : q.sort === 'name'
            ? { name: 1, slug: 1 }
            : { featured: -1, name: 1, slug: 1 };
    const escapedSearch = q.q?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const [result] = await Product.aggregate([
      {
        $match: {
          published: true,
          ...(q.category ? { category: q.category } : {}),
          ...(q.q ? { name: { $regex: escapedSearch, $options: 'i' } } : {}),
        },
      },
      {
        $lookup: {
          from: 'variants',
          localField: 'slug',
          foreignField: 'product',
          pipeline: [
            {
              $addFields: {
                available: { $subtract: ['$physical', { $add: ['$held', '$allocated'] }] },
              },
            },
            { $match: variantFilter },
            { $project: { physical: 0, held: 0, allocated: 0 } },
          ],
          as: 'variants',
        },
      },
      { $match: { 'variants.0': { $exists: true } } },
      {
        $addFields: {
          price: { $min: '$variants.price' },
          available: { $sum: '$variants.available' },
        },
      },
      { $sort: sort },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          products: [{ $skip: (q.page - 1) * 9 }, { $limit: 9 }],
        },
      },
    ]).option({ maxTimeMS: 5000 });
    res.json({ total: result.metadata[0]?.total || 0, page: q.page, products: result.products });
  });
  api.get('/products/:slug', async (req, res) => {
    const p = await Product.findOne({ slug: req.params.slug, published: true }).lean();
    if (!p) throw new AppError(404, 'PRODUCT_NOT_FOUND');
    const variants = await Variant.find({ product: p.slug }).lean();
    res.json({
      ...p,
      variants: variants.map((v) => ({ ...v, available: v.physical - v.held - v.allocated })),
    });
  });
  api.post('/checkout/quote', auth, limit('checkout', 30), async (req, res) =>
    res.json(await quote(cartSchema.parse(req.body))),
  );
  api.post('/orders', auth, limit('checkout', 30), async (req, res) => {
    const b = cartSchema.extend({ quoteHash: z.string().length(64) }).parse(req.body);
    const key = z.string().uuid().parse(req.get('idempotency-key'));
    res.status(201).json(present(await checkout(req.session.userId!, key, b)));
  });
  api.get('/orders', auth, async (req, res) =>
    res.json(
      (await Order.find({ userId: req.session.userId }).sort({ createdAt: -1 }).limit(100)).map(
        present,
      ),
    ),
  );
  api.get('/orders/:number', auth, async (req, res) => {
    const o = await Order.findOne({ number: req.params.number, userId: req.session.userId });
    if (!o) throw new AppError(404, 'ORDER_NOT_FOUND');
    res.json(present(o));
  });
  api.post('/orders/:number/check', auth, limit('check', 10), async (req, res) => {
    const o = await Order.findOne({ number: req.params.number, userId: req.session.userId });
    if (!o) throw new AppError(404, 'ORDER_NOT_FOUND');
    await reconcile(o.gatewayRef);
    res.json(present(await Order.findById(o.id)));
  });
  api.post('/webhooks/midtrans', async (req, res) => {
    const b = z
      .object({
        order_id: z.string().max(100),
        status_code: z.string().regex(/^\d{3}$/),
        gross_amount: z.string().regex(/^\d+(\.00)?$/),
        signature_key: z.string().max(128),
      })
      .passthrough()
      .parse(req.body);
    if (!validSignature(b)) throw new AppError(401, 'INVALID_SIGNATURE');
    const o = await Order.findOne({ gatewayRef: b.order_id });
    if (!o) throw new AppError(404, 'ORDER_NOT_FOUND');
    const e = await Event.create({
      order: b.order_id,
      kind: 'midtrans',
      status: 'queued',
      nextAttempt: new Date(),
    });
    try {
      await reconcile(b.order_id);
      e.status = 'done';
      await e.save();
    } catch {
      /* Durable event is retried by job. */
    }
    res.json({ ok: true });
  });
  if (config.provider === 'simulated' && process.env.NODE_ENV === 'test')
    api.post('/testing/orders/:number/pay', auth, async (req, res) => {
      const o = await Order.findOne({ number: req.params.number, userId: req.session.userId });
      if (!o) throw new AppError(404, 'ORDER_NOT_FOUND');
      await SimPayment.updateOne(
        { order_id: o.gatewayRef },
        { $set: { transaction_status: 'settlement' } },
      );
      await reconcile(o.gatewayRef);
      res.json({ ok: true });
    });
  api.use('/admin', auth);
  api.get('/admin/products', permit('catalog'), async (_req, res) =>
    res.json({ products: await Product.find(), variants: await Variant.find() }),
  );
  api.put('/admin/products/:slug', permit('catalog'), async (req, res) => {
    const b = productInput.parse(req.body);
    if (b.slug !== req.params.slug) throw new AppError(400, 'SLUG_MISMATCH');
    if (b.published && !(await Variant.exists({ product: b.slug })))
      throw new AppError(409, 'VARIANT_REQUIRED');
    const s = await mongoose.startSession();
    try {
      await s.withTransaction(async () => {
        await Product.updateOne({ slug: b.slug }, { $set: b }, { upsert: true, session: s });
        await Audit.create(
          [{ actor: req.session.userId, action: 'product.update', target: b.slug, details: b }],
          { session: s },
        );
      });
    } finally {
      await s.endSession();
    }
    res.json({ ok: true });
  });
  api.put('/admin/variants/:sku', permit('catalog'), async (req, res) => {
    const b = variantInput.parse(req.body);
    if (b.sku !== req.params.sku) throw new AppError(400, 'SKU_MISMATCH');
    if (!(await Product.exists({ slug: b.product }))) throw new AppError(404, 'PRODUCT_NOT_FOUND');
    const s = await mongoose.startSession();
    try {
      await s.withTransaction(async () => {
        const v = await Variant.findOne({ sku: b.sku }).session(s);
        if (v && b.physical < v.held + v.allocated) throw new AppError(409, 'STOCK_BELOW_RESERVED');
        if (v && v.product !== b.product) throw new AppError(409, 'SKU_PRODUCT_IMMUTABLE');
        await Variant.updateOne({ sku: b.sku }, { $set: b }, { upsert: true, session: s });
        await Audit.create(
          [{ actor: req.session.userId, action: 'variant.update', target: b.sku, details: b }],
          { session: s },
        );
      });
    } finally {
      await s.endSession();
    }
    res.json({ ok: true });
  });
  api.get('/admin/zones', permit('catalog'), async (_req, res) => res.json(await Zone.find()));
  api.put('/admin/zones/:name', permit('catalog'), async (req, res) => {
    const b = zoneInput.parse(req.body);
    if (b.name !== req.params.name) throw new AppError(400, 'ZONE_MISMATCH');
    const s = await mongoose.startSession();
    try {
      await s.withTransaction(async () => {
        await Zone.updateOne(
          { name: b.name },
          { $set: b, $inc: { version: 1 } },
          { upsert: true, session: s },
        );
        await Audit.create(
          [{ actor: req.session.userId, action: 'zone.update', target: b.name, details: b }],
          { session: s },
        );
      });
    } finally {
      await s.endSession();
    }
    res.json({ ok: true });
  });
  api.get('/admin/orders', permit('operations'), async (_req, res) =>
    res.json((await Order.find().sort({ createdAt: -1 }).limit(100)).map(present)),
  );
  api.post('/admin/orders/:number/fulfill', permit('operations'), async (req, res) => {
    const b = z
      .object({
        status: z.enum(['ready', 'shipped', 'delivered']),
        tracking: z.string().min(3).max(100).optional(),
      })
      .strict()
      .parse(req.body);
    await fulfill(String(req.params.number), req.session.userId!, b.status, b.tracking);
    res.json({ ok: true });
  });
  api.get('/admin/cases', permit('finance'), async (_req, res) =>
    res.json(await PaymentCase.find().sort({ createdAt: -1 }).limit(100)),
  );
  api.post('/admin/cases/:id', permit('finance'), async (req, res) => {
    const b = z
      .object({
        owner: z.string().min(2).max(100),
        note: z.string().min(5).max(1000),
        status: z.enum(['open', 'investigating', 'closed']),
      })
      .strict()
      .parse(req.body);
    if (!mongoose.isValidObjectId(req.params.id)) throw new AppError(400, 'INVALID_ID');
    const s = await mongoose.startSession();
    try {
      await s.withTransaction(async () => {
        const result = await PaymentCase.updateOne(
          { _id: req.params.id },
          {
            $set: { owner: b.owner, status: b.status },
            $push: { notes: { actor: req.session.userId, text: b.note, at: new Date() } },
          },
          { session: s },
        );
        if (!result.matchedCount) throw new AppError(404, 'CASE_NOT_FOUND');
        await Audit.create(
          [{ actor: req.session.userId, action: 'case.update', target: req.params.id, details: b }],
          { session: s },
        );
      });
    } finally {
      await s.endSession();
    }
    res.json({ ok: true });
  });
  api.post('/admin/orders/:number/reconcile', permit('finance'), async (req, res) => {
    const o = await Order.findOne({ number: req.params.number });
    if (!o) throw new AppError(404, 'ORDER_NOT_FOUND');
    await reconcile(o.gatewayRef);
    res.json({ ok: true });
  });
  api.get('/admin/audit', permit('finance'), async (_req, res) =>
    res.json(await Audit.find().sort({ createdAt: -1 }).limit(200)),
  );
  api.use((_req, _res) => {
    throw new AppError(404, 'NOT_FOUND');
  });
  app.get('/robots.txt', (_req, res) =>
    res
      .type('text')
      .send(
        config.demo
          ? 'User-agent: *\nDisallow: /\n'
          : 'User-agent: *\nDisallow: /admin\nDisallow: /akun\nDisallow: /pesanan\nSitemap: ' +
              config.origin +
              '/sitemap.xml\n',
      ),
  );
  app.get('/sitemap.xml', async (_req, res) => {
    const products = await Product.find({ published: true }).select('slug').lean();
    const paths = config.demo
      ? []
      : ['/', '/katalog', '/panduan', ...products.map((p) => '/produk/' + p.slug)];
    const escape = (s: string) =>
      s
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
    res
      .type('application/xml')
      .send(
        '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
          paths.map((p) => '<url><loc>' + escape(config.origin + p) + '</loc></url>').join('') +
          '</urlset>',
      );
  });
  app.use(express.static(root + 'apps/web/dist'));
  app.get('/{*path}', (_req, res) => res.sendFile(root + 'apps/web/dist/index.html'));
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ZodError)
      return res.status(400).json({
        error: 'INVALID_INPUT',
        fields: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    if (err instanceof AppError)
      return res.status(err.status).json({ error: err.code, details: err.details });
    if (err.code === 11000) return res.status(409).json({ error: 'ALREADY_EXISTS' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'INVALID_JSON' });
    if (err.type === 'entity.too.large')
      return res.status(413).json({ error: 'PAYLOAD_TOO_LARGE' });
    console.error('Request failed:', err.name, err.code || 'INTERNAL');
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  });
  return app;
}
