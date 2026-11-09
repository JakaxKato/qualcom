# Cloud startup

Use the existing `/workspace/qualcom` checkout. The cloud task is already isolated; do not create a Git worktree unless explicitly requested.

The cloud configuration service returned `INVALID_ARGUMENT` for both draft reads and the save attempt. Persistence of `install_script` and `start_skill` is **unconfirmed**. The tested installation steps are retained in `scripts/cloud-install.sh`; this file records startup steps independently of cloud settings. No environment snapshot has been published.

From `/workspace/qualcom`:

1. Run `npm run db:up`. It starts/restarts the local Docker MongoDB replica set and checks for a writable primary. Existing data is preserved.
2. If a new database needs demo products, run `npm run seed`. This does not reset inventory or overwrite existing products.
3. Start `NODE_USE_ENV_PROXY=1 npm run dev:demo` as a persistent process. API: port 3001; storefront: port 5173. Keep `APP_ORIGIN=http://localhost:5173` for internal testing.
4. Start `NODE_USE_ENV_PROXY=1 NODE_ENV=test PAYMENT_PROVIDER=simulated npm run reconcile` as a separate persistent process.
5. Verify `curl -fsS http://localhost:5173/api/v1/health` and confirm `/api/v1/products` returns the seeded products. Do not treat a PID or port alone as readiness.

Live processes do not survive snapshots. Restart them in future tasks. The simulated payment adapter is strictly for tests; use normal `npm run dev` and `npm run reconcile` with merchant sandbox settings for real integration tests. Preserve inherited proxy variables and CA trust.

No cloud credentials are currently bound for Midtrans or SMTP. Midtrans sandbox needs the server key securely configured and network permission for `docs.midtrans.com`, `api.sandbox.midtrans.com`, `app.sandbox.midtrans.com`. The existing custom allowlist could not be read, so it was not replaced. See README.md for production gates and secure configuration. Never paste credentials into chat or tracked files.

Validate with `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`, and `npm run test:e2e`. Chromium is installed at `/usr/bin/chromium`. API tests use the dedicated test database; browser tests leave customer/orders in the demo database.
