# Ruang Teduh

An Indonesian furniture storefront built in the previously empty `qualcom` repository. React + Vite, Express, TypeScript, Mongoose, and a MongoDB replica set. The current brand, nine products, prices, Jakarta shipping zone, and original SVG illustrations are **demo content**.

## Run locally

Requirements: Node.js 22.21+ (validated on 24.22.1), npm, Docker, and Chromium for browser tests.

```sh
npm ci
npm run db:up
npm run seed
npm run dev
```

The web server uses port 5173 and proxies `/api/v1` to the API on port 3001. Use `localhost` as the hostname to match the default `APP_ORIGIN`. MongoDB is bound only to loopback on port 27017. `db:up` starts a single-node replica set and waits for an elected primary. This unauthenticated local database is for development only.

`npm run dev` leaves payment creation disabled. For a fully interactive **test checkout with no real payment**, run:

```sh
npm run dev:demo
```

This explicitly sets `NODE_ENV=test` and `PAYMENT_PROVIDER=simulated`. The simulation endpoint exists only in this configuration and is rejected in production. The order screen provides a clearly labeled simulation action. To run the reconciliation worker in the same test mode in another terminal:

```sh
NODE_ENV=test PAYMENT_PROVIDER=simulated npm run reconcile
```

For normal sandbox operation use `npm run reconcile`. Add `-- --once` to the API workspace command to process one batch: `npm run reconcile -w apps/api -- --once`.

No customer or administrator credentials are seeded. Register a customer through the store. Development session and MFA encryption keys are generated once into the ignored `.data/dev-secrets.json`, with restrictive permissions. Set explicit keys for hosted environments. Do not copy the local keys into production.

## Configuration

Copy `.env.example` to `.env` at the repository root if you need overrides. Never commit `.env` or `.data`.

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Replica-set database URI. Production needs authenticated, encrypted access with minimum privileges. |
| `APP_ORIGIN` | Exact browser origin for CSRF and gateway callbacks; HTTPS in production. |
| `SESSION_SECRET` | Operator-supplied random secret of at least 32 characters in production. |
| `MFA_ENCRYPTION_KEY` | 32 random bytes encoded as 64 hexadecimal characters. Encrypts admin TOTP secrets. |
| `PAYMENT_PROVIDER` | `disabled`, `midtrans`, or `simulated` (test environment only). |
| `MIDTRANS_ENV` | `sandbox` or `production`. Defaults to sandbox. |
| `MIDTRANS_SERVER_KEY` | Backend merchant credential. Never expose in a Vite variable. |
| `MIDTRANS_CHANNELS` | Comma-separated merchant-enabled payment channels. Default: `bank_transfer,qris`. |
| `SMTP_URL`, `MAIL_FROM` | Password-reset mail transport and sender. Required in production. |
| `BRAND_NAME`, `SUPPORT_EMAIL` | Store identity and confirmed support contact. |
| `DEMO_MODE` | Defaults to `true`; production requires `false`. Replace all seed content before switching. |
| `CHECKOUT_ENABLED` | Set `false` and restart API to pause new checkouts; webhook and reconciliation continue. |
| `NODE_USE_ENV_PROXY` | Set to `1` when Node fetch must use a managed HTTPS proxy (Node 22.21+). Preserve the environment CA trust. |

Production SMTP uses SMTPS (`smtps://`, normally port 465) with verified TLS. In a managed cloud environment, authorize the chosen SMTP host and transport through environment settings. Development without SMTP writes the most recent reset message to ignored `.data/reset-mail.json` (mode 0600); it is never returned by the public API or logged. That file contains a short-lived token and should be treated as sensitive.

## Admin setup

Supply `ADMIN_EMAIL`, `ADMIN_PASSWORD` (14+ characters), and `ADMIN_MFA_SECRET` (a randomly generated base32 TOTP secret, 32+ characters) through a secure operator environment, then run:

```sh
npm run admin:create
```

Configure the same TOTP secret in the operator's authenticator first. The bootstrap command refuses to overwrite an existing account. No credentials or TOTP secret are printed. Expand “Masuk sebagai admin” on the login form to enter the code. The bootstrap admin receives catalog, operations, and finance permissions; every admin API checks its specific permission and MFA session. TOTP codes cannot be replayed within their time step.

The panel supports draft products, publication, variants, physical stock, zone rates, fulfillment, payment-case notes/ownership, and immutable audit viewing. Create a product draft, add a variant using its slug, then publish. Image fields reference reviewed local assets in `apps/web/public/images`; uploads are deliberately not exposed. Customer payment state cannot be manually set by an admin.

## Transaction behavior

- Quotes are calculated entirely on the server. Mixed shipping classes are charged once per class, summed. The demo Jakarta prefixes are 10–14, with Rp20,000 / Rp75,000 / Rp150,000 for small / medium / large.
- A quote hash binds the address, items, prices, shipping breakdown and rule version. Changed prices or shipping require confirmation again.
- A MongoDB transaction atomically creates the order and holds inventory. Available quantity is physical minus held minus allocated.
- An account-scoped idempotency key binds the request. Duplicate requests reuse the durable order and gateway reference, including uncertain gateway attempts.
- The gateway call runs outside the database transaction. A timeout leaves the attempt uncertain; it never silently creates another payable reference.
- Webhooks verify a constant-time SHA-512 signature, enqueue a durable event, then fetch the status directly from Midtrans. Order reference, amount and transaction ID must match before allocation.
- Duplicate and stale pending notifications do not finalize stock twice or regress a paid order. Verified closure releases held stock once. Unknown / 404 status never releases inventory based on elapsed time alone.
- Late payments, mismatched amounts/IDs, refunds, chargebacks and conflicting outcomes open cases and hold fulfillment. Refunds do not return shipped goods to inventory.
- Fulfillment is separate: unprocessed → ready → shipped → delivered. Shipping requires verified payment, allocated stock, no hold, and a tracking/handover reference.

Indexes are initialized by API/worker startup using Mongoose `init()`: unique slug, SKU, public order number, gateway reference, transaction ID, and account/idempotency key. Sessions and rate-limit counters share MongoDB. The stock and audit changes use the same database transaction. The worker retries queued events with bounded backoff and polls pending orders every minute.

## Midtrans sandbox validation

The adapter is implemented but **merchant sandbox transactions have not been executed**. The current cloud environment has no merchant credentials and blocks Midtrans documentation/API destinations.

Before sandbox validation, authorize `docs.midtrans.com`, `api.sandbox.midtrans.com`, and `app.sandbox.midtrans.com` in environment settings; set the sandbox server key securely. For production, separately authorize `api.midtrans.com` and `app.midtrans.com` and supply production credentials. Do not weaken TLS checks.

1. Set `PAYMENT_PROVIDER=midtrans`, `MIDTRANS_ENV=sandbox`, the merchant-enabled channels, and the sandbox server key. Set a reachable HTTPS `APP_ORIGIN` for your staging environment.
2. Configure the merchant HTTPS notification URL as `<APP_ORIGIN>/api/v1/webhooks/midtrans`. Route web and API through the same HTTPS origin. Run the worker continuously.
3. Register a test customer, choose a variant, quote shipping, and confirm checkout. Open the validated Midtrans redirect from the order page.
4. Complete a sandbox payment on each enabled channel. Confirm the backend reads the status, allocates once, and allows fulfillment. A browser success redirect alone must do nothing.
5. Exercise abandon, expiry, webhook retry, GET Status 404 before method selection, and network timeout. Confirm channel-specific expiry behavior before setting production reservation rules. Current ambiguous 404 handling conservatively retains inventory and opens a case for review.
6. Verify card fraud rules if enabling `credit_card`, merchant refunds and disputes, actual mail delivery, and notifications through your staging TLS endpoint.

Reference URLs from the supplied requirements: [Snap](https://docs.midtrans.com/docs/snap-snap-integration-guide), [notifications](https://docs.midtrans.com/docs/https-notification-webhooks), [transaction cycle](https://docs.midtrans.com/docs/transaction-status-cycle), [Snap expiry](https://docs.midtrans.com/reference/expire-a-snap-session). Access to current documentation must be restored before merchant certification.

## Validation

```sh
npm run typecheck
npm run lint
npm run build
npm test
npm run test:e2e
npm audit --omit=dev
```

API tests use a separate `ruang_teduh_test` database and delete only test collections. They exercise real MongoDB transactions with a simulated gateway. Browser tests start a demo API and Vite, create a test customer and an order, verify payment status, restore catalog URL filters, and inspect 320/390/1440px layouts. They use the development database, so they leave labeled test accounts/orders and consume demo inventory. Use a separate development database if preserving demo stock is important. Re-running seed is non-destructive and does not reset stock, orders, or edits.

Playwright uses `/usr/bin/chromium` when present, or `CHROMIUM_PATH` when supplied. Otherwise install Playwright's browser with `npx playwright install chromium`. Screenshots and reports are ignored under `test-results` and `playwright-report`.

`npm run build` produces `apps/api/dist` and `apps/web/dist`. In a configured production deployment, `node apps/api/dist/server.js` serves both the API and built SPA on the same origin. Run `node apps/api/dist/job.js` as a separate supervised process. Build output is not committed.

## Scope and release gates

Implemented: catalog, variants, cart, customer sessions/reset, server quotes, transactional checkout, gateway adapter and test simulation, order history, admin MFA/permissions, catalog/inventory/shipping administration, audited fulfillment, payment cases and reconciliation.

Before live commerce, the owner must supply real branding/catalog photography and verified product facts, merchant credentials and channels, shipping/tax policy, contact details, and approved privacy/returns/warranty text. The original reference images were not attached; the current illustrations are generated by `scripts/assets.py` and can be freely replaced with licensed product photos.

Production operations remain a separate release step: validate real SMTP/Midtrans delivery, backups and restore, monitoring/alerts, MFA recovery and role-management procedures, data retention, security review, load/performance testing, and operator UAT. Payment cases currently support reconciliation and audited triage; closing a case does not clear the financial hold. Finance must follow a reviewed remediation process for mismatches, 404 uncertainty, late payment and refund cases; the panel intentionally cannot force an order to “paid”. Catalog filtering and pagination use a MongoDB aggregation with bounded results; review query performance against the production data set. No claim of production readiness or WCAG certification is made from local checks alone.

## Cloud task startup

Use the existing `/workspace/qualcom` checkout. Each cloud task is already isolated; do not create a Git worktree unless explicitly requested. Dependencies and files can be retained in a snapshot, but processes must restart. Run `npm run db:up`, check `/api/v1/health` after starting the API, and run the worker separately in the same payment mode. Keep credentials outside tracked files. No deployment or publication is performed by these commands.
