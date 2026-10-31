# Money Manager

A mobile-first personal finance PWA for logging expenses and income, tracking accounts, budgets, loans and recurring bills, and reviewing monthly reports. Built with Next.js, React, Prisma, Neon Postgres and Auth.js.

## Setup

Create `.env`:

```
DATABASE_URL="neon-pooled-connection"
DIRECT_URL="neon-direct-connection"
E2E_DATABASE_URL="neon-test-branch-pooled-connection"
E2E_DIRECT_URL="neon-test-branch-direct-connection"
AUTH_SECRET="generate with: openssl rand -base64 33"
```

Then:

```
npm install
npm run db:migrate
npm run dev -- -p 3001
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm test` | Run unit tests |
| `npm run test:e2e` | Build, then run browser tests on the Neon test branch |
| `npx eslint .` | Lint |
| `npm run db:migrate` | Apply database migrations |

The service worker only runs in production builds, so test offline behaviour with `npm run build && npm start`.

## How money works

Amounts are stored as whole paise in BigInt columns. The API and UI use rupees, and `src/lib/money.ts` converts between them.

Account balances are stored totals. Every change that affects one updates the balance in the same database transaction as the record itself.
