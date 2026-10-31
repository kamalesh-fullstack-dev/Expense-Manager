# Money Manager

A mobile-first personal finance PWA for logging expenses and income, tracking accounts, budgets, loans and recurring bills, and reviewing monthly reports. Built with Next.js, React, Prisma, SQLite and NextAuth.

## Setup

Create `.env`:

```
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="any-long-random-string"
```

Then:

```
npm install
npm run db:migrate
npx prisma generate --config prisma7.config.ts
npm run dev -- -p 3001
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm test` | Run unit tests |
| `npm run test:e2e` | Build, then run browser tests on a temporary database |
| `npx eslint .` | Lint |
| `npm run db:migrate` | Apply database migrations |

The service worker only runs in production builds, so test offline behaviour with `npm run build && npm start`.

## How money works

Amounts are stored as whole paise in BigInt columns. The API and UI use rupees, and `src/lib/money.ts` converts between them.

Account balances are stored totals. Every change that affects one updates the balance in the same database transaction as the record itself.
