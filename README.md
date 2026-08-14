# Receiptor App

The off-chain half of Receiptor: an SDK, merchant dashboard, and Stellar event
indexer for the `ReceiptLedger` Soroban contract.

```text
merchant browser ──> apps/web ──> indexer REST API ──> Postgres
       │                 │
       │                 └── read-only Soroban RPC
       └── server/worker uses @receiptor/sdk to record receipts

indexer ──polls──> Soroban RPC ReceiptRecorded events
```

## Workspace layout

- `packages/sdk` — `@receiptor/sdk`: contract client, canonical receipt hash,
  x402 receipt boundary, double-entry ledger helpers, and CSV export.
- `apps/web` — animated Next.js merchant workspace with Dashboard, Receipts,
  Settlements, Ledger, Reconciliation, Analytics, Export, and Settings views.
  It reads the indexer API, shows on-chain receipt counts, and exports ledger CSV.
- `indexer` — Soroban event poller, Drizzle/Postgres schema, and REST API.

The contract itself lives in the sibling `receiptor-contract` repository.

## Quick start

Requirements: Node 22+, pnpm 10+, and Postgres 16+ for the indexer.

```bash
pnpm install
cp .env.example .env.local
# Fill in RECEIPT_LEDGER_CONTRACT_ID and the other environment values.
pnpm --filter @receiptor/indexer migrate
pnpm typecheck
pnpm build
pnpm test

# Run the dashboard and indexer in separate terminals:
pnpm --filter @receiptor/web dev
pnpm --filter @receiptor/indexer dev
```

The web app is available at `http://localhost:3000`; the indexer API defaults
to `http://localhost:3001`.

## Indexer API

- `GET /health` — process health check.
- `GET /summary` — receipt and ledger-entry totals.
- `GET /receipts` — all indexed receipts.
- `GET /receipts/:hash` — one indexed receipt.
- `GET /settlements` — indexed token transfer settlements.
- `GET /ledger` — double-entry rows generated from receipts.
- `POST /receipts` — server-side receipt recording; the merchant secret never leaves the indexer.

The web workspace is a dark, responsive Stellar finance console with animated
navigation, live polling, receipt detail verification timelines, reconciliation
states, accounting summaries, and reduced-motion support.

The indexer stores its last processed ledger in `indexer_state` and uses
idempotent receipt/settlement keys so replaying a range is safe.

## Environment

`.env.example` contains the full variable list. Configure `ADMIN_USERNAME`,
`ADMIN_PASSWORD`, and a long random `SESSION_SECRET` for the admin login. Set
`WEB_ORIGIN=http://localhost:3000` for local browser requests and
`COOKIE_SECURE=true` when serving the indexer over HTTPS. `DATABASE_URL`,
`MERCHANT_SECRET_KEY`, `ADMIN_PASSWORD`, and `SESSION_SECRET` are server-only;
never expose them through a `NEXT_PUBLIC_*` variable or browser code.

The web app signs in through `POST /auth/login`, keeps the signed session in an
HttpOnly cookie, and sends credentials with every authenticated API request.
`GET /auth/session` checks the current session and `POST /auth/logout` clears it.
All receipt, settlement, ledger, and summary endpoints require the admin
session.

Amounts remain `bigint` in the SDK because the contract uses Soroban `i128` and
`u64` values. The indexer stores those values as decimal strings in Postgres.

The SDK verifies the official x402 `offer-receipt` signature and accepts the
facilitator settlement context separately because the signed x402 artifact does
not contain every field required by `ReceiptLedger`.
