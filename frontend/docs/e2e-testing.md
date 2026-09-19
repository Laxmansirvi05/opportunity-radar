# End-to-End Testing

Opportunity Radar uses Playwright for browser-level smoke and user-flow checks.

## Local run

Start the app in one terminal:

```bash
npm run dev
```

Then run the Chromium suite:

```bash
npm run test:e2e
```

For the interactive Playwright runner:

```bash
npm run test:e2e:ui
```

## Custom app URL

Playwright defaults to `http://localhost:3000`. To test another running instance, set `PLAYWRIGHT_BASE_URL`:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3001 npm run test:e2e
```

## Full verification

Run the unit checks and E2E suite together with:

```bash
npm run check:all
```

In CI, Playwright automatically uses a single worker, enables retries, and rejects accidental `test.only` usage.
