# Current-instance validation

Validated on 9 November 2026 with Node 24.22.1, npm 11.9.0, Docker MongoDB 8.0 (pinned image digest), and system Chromium.

- Frozen-lockfile reinstall (`npm ci`), repeatable MongoDB startup and non-destructive seed: passed.
- TypeScript checks, ESLint and production builds: passed.
- API integration tests: **24 passed, 0 failed, 0 skipped** against a real single-node MongoDB replica set.
- Playwright: **6 passed, 0 failed, 0 skipped**. Includes an end-to-end simulated payment, lost checkout response followed by refresh/retry (one order only), account session restoration, URL-based filtering, and layouts/assets at 320, 390 and 1440 pixels.
- Axe checks: no automated WCAG A/AA violations on homepage, catalog, product and account pages. This is not a complete WCAG conformance assessment.
- Production dependency audit: zero known vulnerabilities at the time of validation.
- Compiled Express server: health endpoint, nine catalog products, SPA route and demo robots rules verified.
- Reconciliation worker: a full tick completed.
- Production mode rejected the simulated payment adapter as expected.
- Current demo API and storefront started; health and catalog requests passed. Test reconciliation worker started separately.

All payment results above use the **test simulation adapter**. No merchant sandbox transaction, live payment, outbound SMTP delivery, deployment, new-task snapshot restoration, or environment publication has been verified.

The cloud configuration service returned `INVALID_ARGUMENT`. Draft read and save persistence remain unconfirmed. Repository instructions are available in `README.md`, `scripts/cloud-install.sh`, and `docs/CLOUD_START.md`.
