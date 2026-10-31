# Expense Tracker Project Plan

## Project goal
Build a mobile-first expense tracker PWA inspired by the workout tracker, but with a different finance-focused UI and experience. The product should feel clean, modern, premium, and designed for daily spending tracking and budget awareness.

## Current implementation status
This project is now in a working MVP stage with the core financial flows implemented and validated.

### Implemented features
- Auth flow with protected routes and login/signup
- Mobile-first dashboard with premium dark finance UI
- Expense add/edit/delete flow
- Category creation and custom category support
- Monthly budget creation, update, and delete flow
- Account balance tracking and transfer flow
- Debt tracking and EMI summary
- Monthly reports with trend and category summaries
- Account balance mix and reports sections
- PWA-ready app shell and installable mobile layout

### Current tech stack (what the code runs on today)
- Next.js 16, React 19, TypeScript, Tailwind CSS, App Router
- Prisma 7 with SQLite (`@prisma/adapter-better-sqlite3`), local development only
- NextAuth v4 with credentials and JWT sessions
- Hand-built charts, and a hand-written service worker in `public/sw.js`
- Node's test runner for unit tests, Playwright script for browser tests (`tests/e2e.mjs`)

The app is not deployed yet. See "Production stack" for where it is going.

## Core objective
Create a personal expense tracker that helps a user:
- log expenses quickly
- categorize spending
- track monthly totals
- see budget health
- review spending trends
- access the app like a mobile app on their phone

## UI direction
Make the app look different from the workout tracker.

### Design style
- more premium finance app aesthetic
- less sporty / fitness-driven
- more polished and minimal
- mobile-first dashboard
- card-based analytics layout
- dark mode default or premium neutral theme
- strong emphasis on totals, budgets, and spending charts

### Visual palette
Use a finance-oriented palette such as:
- dark background with slate or navy tones
- green for income/healthy trends
- red/orange for spending and warnings
- blue/violet for cards and highlights
- soft neutral surfaces for readability

## App structure
### Auth
- login ✅
- signup ✅
- protected routes ✅
- user-specific data ✅

### Dashboard
- total spending this month ✅
- monthly income summary ✅ (placeholder/income area ready for expansion)
- available budget ✅
- recent expenses ✅
- category breakdown card ✅
- spending trend chart ✅
- quick action buttons ✅

### Expenses
- add expense form ✅
- edit expense ✅
- delete expense ✅
- search by name or category ✅
- filter by date range ✅ (month-based filters)
- sort transactions ✅ (through date ordering and filters)

### Categories
- Food ✅
- Transport ✅
- Shopping ✅
- Bills ✅
- Health ✅
- Entertainment ✅
- Travel ✅
- Utilities ✅
- Miscellaneous ✅
- custom category creation ✅
- custom category deletion ✅

### Budgeting
- monthly budget per category ✅
- spending progress indicators ✅
- warnings when budgets are exceeded ✅
- total budget remaining ✅
- delete budget entry ✅

### Reports
- monthly spending overview ✅
- category summary ✅
- trend line chart ✅
- highest-cost merchants ✅
- account balance mix ✅
- transfer summary ✅

### Accounts
- account creation ✅
- balance tracking ✅
- transfer between accounts ✅
- account snapshot on dashboard ✅

### Debt tracking
- debt creation and tracking ✅
- monthly EMI summary ✅
- debt pressure indicator ✅

## Data model
### User
- id
- name
- email
- password hash

### Expense
- id
- userId
- title
- amount
- categoryId
- date
- merchant
- notes
- paymentMethod
- createdAt
- updatedAt

### Category
- id
- name
- color
- userId or global defaults

### Budget
- id
- userId
- categoryId
- amount
- month

### Added models
- Income
- RecurringExpense

## User flows
1. User logs in
2. User views monthly dashboard
3. User adds an expense
4. User chooses category, date, and amount
5. User sees updated totals and charts
6. User filters reports by month or category
7. User monitors budget usage

## PWA requirements
The app should behave like a mobile app:
- installable on phone home screen
- responsive layout
- mobile-friendly forms
- offline-safe shell where possible
- app-like experience without needing a native app

## SMS auto-import plan
This is a future phase, not the first version.

### Recommended approach
- not full auto-save from browser-only PWA
- optional Android/native SMS integration later
- parse bank or UPI transaction messages
- convert into suggested expense draft
- require user review/approval before saving

### Why this approach
- safer than fully automatic logging
- works around browser and platform restrictions
- gives the user control over expense entries

## Project phases
### Phase 1: Foundation
- project setup ✅
- auth ✅
- database schema ✅
- category system ✅
- expense CRUD ✅

### Phase 2: Dashboard and analytics
- summary cards ✅
- recent transactions ✅
- charts ✅
- filters ✅
- budgets ✅
- account/debt tracking ✅

### Phase 3: PWA polish
- mobile UI refinement ✅
- installability 🔄 (manifest, PNG icons and service worker done; still needs testing on a real phone over HTTPS)
- offline support ✅ (offline page and cached build assets; private data is never cached)
- dark mode styling ✅

### Phase 4: Smart import
- SMS parsing layer ⏳
- transaction suggestion flow ⏳
- review and approve logic ⏳

## Acceptance criteria
The MVP is successful when:
- user can sign in ✅
- user can add expenses ✅
- user can edit/delete expenses ✅
- user can categorize spending ✅
- dashboard shows totals and recent activity ✅
- monthly totals update correctly ✅
- app works well on mobile ✅
- design feels distinct from workout tracker and more finance-oriented ✅

## Known remaining work
- password reset (needs an email provider)
- real push notifications for reminders (reminders are in-app only)
- move to Neon Postgres and deploy on Vercel (see "Production stack")
- test installing on real Android and iPhone devices
- split expenses, motion polish
- postpone SMS import to a future phase

## Production stack (same as the Workout Tracker)
Money Manager should deploy the same way as `~/Desktop/Workout Tracker` (GitHub: `kamalesh-fullstack-dev/Workout-Tracker`). Read that project for working examples. None of the changes below are made yet.

### Target
| Area | Workout Tracker setup | Money Manager today |
| --- | --- | --- |
| Hosting | Vercel, deployed from GitHub | Not deployed |
| Database | Neon Postgres | SQLite |
| Prisma driver | `@prisma/adapter-neon` with `@neondatabase/serverless` and `ws` | `@prisma/adapter-better-sqlite3` |
| Prisma config | `prisma.config.ts`, migrations use `DIRECT_URL` | `prisma7.config.ts`, uses `DATABASE_URL` |
| Migrations | Run during the build | Run by hand with `npm run db:migrate` |
| Auth | Auth.js v5 (`next-auth@5` beta), `trustHost: true` | NextAuth v4 |
| PWA | Serwist (`@serwist/turbopack`, `src/app/sw.ts`) | Hand-written `public/sw.js` |
| Validation | Zod | Hand-written `src/lib/validation.ts` |
| Forms | React Hook Form | Plain React state |
| UI | shadcn, lucide-react, sonner | Custom Tailwind |
| Charts | Recharts | Hand-built |
| Unit tests | Vitest (`tests/unit`) | Node test runner (`src/lib/*.test.ts`) |
| Browser tests | `@playwright/test` (`tests/e2e`) | `tests/e2e.mjs` |

Only hosting, database, Prisma, migrations and auth are needed to go live. Move the rest over only when there is a reason to.

### Environment variables
Never commit real values. Add a `.env.example` with these names, and set them in Vercel too:
- `DATABASE_URL`: Neon pooled connection, used at runtime.
- `DIRECT_URL`: Neon direct connection, used only for Prisma migrations.
- `AUTH_SECRET`: generate with `openssl rand -base64 33`. This replaces `NEXTAUTH_SECRET` and `NEXTAUTH_URL`. Never deploy the `development-secret-change-me` value from local `.env`.

### Migration steps
1. Create a separate Neon project for Money Manager. Do not share the Workout Tracker database.
2. Set `provider = "postgresql"` in `prisma/schema.prisma`.
3. Delete `prisma/migrations` and generate a new baseline for Postgres. The existing migrations are SQLite-specific. Local data does not need moving, because it holds no financial records yet.
4. Replace the Prisma adapter in `src/lib/prisma.ts` using the pattern in the Workout Tracker's `src/lib/db.ts`:
   ```ts
   import { PrismaNeon } from "@prisma/adapter-neon";
   import { neonConfig } from "@neondatabase/serverless";
   import ws from "ws";

   neonConfig.webSocketConstructor = ws;
   const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
   ```
5. Rename `prisma7.config.ts` to `prisma.config.ts`, and point its datasource at `DIRECT_URL`. Remove `--config prisma7.config.ts` from scripts and docs.
6. Update `package.json` scripts:
   ```json
   "build": "prisma migrate deploy && next build",
   "postinstall": "prisma generate"
   ```
7. Upgrade to Auth.js v5, following the Workout Tracker's `src/lib/auth.ts` and `src/lib/auth.config.ts`, including `trustHost: true`.
8. Import the GitHub repo into Vercel, add the environment variables, and deploy from `main`.

### Code to change for Postgres and Vercel
- Search: SQLite `contains` ignores case for ASCII, but Postgres does not. Add `mode: "insensitive"` in `src/lib/expense-filter.ts`.
- Rate limiting: `src/lib/rate-limit.ts` keeps counts in memory, which does not carry across Vercel serverless instances. Move it to the database or a shared store.
- Client IP: confirm `clientIp()` in `src/lib/api.ts` reads the right value behind Vercel.
- Tests: `tests/e2e.mjs` creates a temporary SQLite file. Point it at a Neon test branch or a local Postgres instead. It must never run against the production database.
- Metadata: `metadataBase` in `src/app/layout.tsx` reads `NEXTAUTH_URL`, so give it a replacement when that variable goes away.

## Working in this repo
- Run `npm test`, `npx eslint .` and `npm run test:e2e` before finishing a change.
- Money is stored as paise in BigInt `*Paise` columns. The API speaks rupees; convert with `src/lib/money.ts`.
- Recurring items never post by themselves. The user logs or skips each occurrence.
- Prisma commands need `--config prisma7.config.ts`. Apply migrations with `npm run db:migrate`.
- Expense dates are stored as UTC midnight of the chosen calendar day. Use `src/lib/dates.ts`, never `toISOString()`, for "today".
- `public/sw.js` must never cache pages or `/api/*`, because they hold private financial data. Bump `CACHE_NAME` when changing it.

## Important note
Keep the first version focused on core finance features. Build a clean, usable expense tracker before adding advanced SMS automation.

## Final recommendation
Build the app as a premium, mobile-first PWA using the same Next.js stack, with a budgeting-focused dashboard and account-aware finance flows instead of a workout-oriented experience. The project is now on track as a solid personal finance MVP and can continue into deeper PWA polish and future smart-import automation.
