# Expense Tracker Project Plan

## Project goal
Build a mobile-first expense tracker PWA inspired by the workout tracker, but with a different finance-focused UI and experience. The product should feel clean, modern, premium, and designed for daily spending tracking and budget awareness.

## Current implementation status
The app is live at https://expense-manager-three-gamma.vercel.app, deployed from `main` on Vercel with Neon Postgres.

### Implemented features
- Auth flow with protected routes and login/signup
- Mobile-first Home for daily use, with a premium dark finance UI and Poppins font
- Expense add/edit/delete, with repeat chips and remembered defaults for quick entry
- Expense log (`/transactions`) with search, filters, sort and paging
- Category creation and custom category support
- Monthly budget creation, update, and delete flow
- Account balance tracking and transfer flow
- Debt tracking, entered as an amount per month with start and end dates
- Monthly reports with trend and category summaries, and a month in review
- Savings goals that set money aside in one or more accounts without moving it
- One display currency per user (₹, $, €, £ and others; no conversion)
- Page loaders and loading placeholders
- PWA-ready app shell and installable mobile layout

### Current tech stack (what the code runs on today)
- Next.js 16, React 19, TypeScript, Tailwind CSS, App Router
- Prisma 7 with Neon Postgres (`@prisma/adapter-neon`)
- Auth.js v5 (`next-auth@5` beta) with credentials and JWT sessions
- Hand-built charts, and a hand-written service worker in `public/sw.js`
- Node's test runner for unit tests, Playwright script for browser tests (`tests/e2e.mjs`)

See "Production stack" for how it is deployed.

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

### Home
Home is for daily use; analysis lives on Reports and budget setup on Budgets.
- total spending this month, budget, left, balance and EMI still due ✅
- budget alerts and savings used this month ✅
- coming up in the next 7 days (bills to log or skip, EMIs due) ✅
- last month's review link for the first week of each month ✅
- quick actions: Income, Recurring, Budget, Categories, Debt, Goals ✅
- latest 5 expenses with a link to the expense log ✅

### Navigation
- bottom nav: Home, Expenses, + (add expense), Reports, Accounts ✅
- edit and delete are shared icon buttons (`src/components/IconButtons.tsx`) ✅

### Expenses
- add, edit and delete expense ✅
- repeat chips for the most frequent recent expenses, and past-title suggestions ✅
- new expenses default to the category, payment method and account used last ✅
- expense log with search, category, account, date range, sort and paging ✅
- warning before an expense spends money set aside for a goal ✅

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
- month in review: spending against last month, biggest category changes, budgets over, savings rate, biggest expense ✅
- `/reports?month=YYYY-MM` opens a chosen month ✅

### Accounts
- account creation ✅
- balance tracking ✅
- transfer between accounts ✅
- money set aside for goals and money free, under each balance ✅
- display currency picker ✅

### Debt tracking
- loans entered as amount per month, due day, start and end date ✅
- balance worked out from the due dates still to come; the end date's month always counts ✅
- Pay EMI by hand, with parallel payments that can't overpay ✅
- monthly EMI summary and debt pressure indicator ✅

### Savings goals
- goals with a target and optional date, showing the amount needed a month ✅
- set money aside from one or more accounts; balances never change ✅
- only free money can be set aside; withdraw releases it ✅
- spending below the set-aside amount lowers the newest goal first, logged as "Spent from" ✅
- goals are only topped up by hand ✅

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
- SavingsGoal and GoalEntry (money set aside per goal and account)
- RateLimit (login and sign-up limits, shared across serverless instances)
- `User.currency` (display currency)

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
- push notifications for EMI and bill reminders a day before they are due (next; needs VAPID keys and a Vercel cron job)
- change password, and password reset (reset needs an email provider)
- security review and `npm audit` (16 moderate warnings, not yet reviewed)
- confirm `clientIp()` reads the right value behind Vercel
- test installing on real Android and iPhone devices
- split expenses, receipt photos, CSV import, motion polish
- postpone SMS import to a future phase

## Production stack (same as the Workout Tracker)
Money Manager should deploy the same way as `~/Desktop/Workout Tracker` (GitHub: `kamalesh-fullstack-dev/Workout-Tracker`). Read that project for working examples. All of the move below is done, and the app is live on Vercel.

### Target
| Area | Workout Tracker setup | Money Manager today |
| --- | --- | --- |
| Hosting | Vercel, deployed from GitHub | Same; every push to `main` deploys |
| Database | Neon Postgres | Neon Postgres |
| Prisma driver | `@prisma/adapter-neon` with `@neondatabase/serverless` and `ws` | Same |
| Prisma config | `prisma.config.ts`, migrations use `DIRECT_URL` | Same |
| Migrations | Run during the build | Same |
| Auth | Auth.js v5 (`next-auth@5` beta), `trustHost: true` | Same, in one `src/lib/auth.ts` because there is no proxy |
| PWA | Serwist (`@serwist/turbopack`, `src/app/sw.ts`) | Hand-written `public/sw.js` |
| Validation | Zod | Hand-written `src/lib/validation.ts` |
| Forms | React Hook Form | Plain React state |
| UI | shadcn, lucide-react, sonner | Custom Tailwind |
| Charts | Recharts | Hand-built |
| Unit tests | Vitest (`tests/unit`) | Node test runner (`src/lib/*.test.ts`) |
| Browser tests | `@playwright/test` (`tests/e2e`) | `tests/e2e.mjs` on a Neon `e2e` branch |

Move the rest over only when there is a reason to.

### Environment variables
Never commit real values. `.env.example` lists these names. Set them in Vercel too:
- `DATABASE_URL`: Neon pooled connection, used at runtime.
- `DIRECT_URL`: Neon direct connection, used only for Prisma migrations.
- `AUTH_SECRET`: generate with `openssl rand -base64 33`. Use a different value in Vercel from local `.env`. There is no fallback, so login fails without it.

### Deploying
Push to `main` and Vercel deploys it. The build runs `prisma migrate deploy` first, so a push with a new migration changes the production database before the new code goes live. Functions run in `iad1`, close to the Neon database in `us-east-2`.

## Working in this repo
- Run `npm test`, `npx eslint .` and `npm run test:e2e` before finishing a change.
- `npm run build` migrates the production database. To check a build without that, run `npx next build`.
- `npm run test:e2e` needs `E2E_DATABASE_URL` and `E2E_DIRECT_URL` pointing at the Neon `e2e` branch, and refuses to run against production. Set `E2E_SERVER_LOG` to a file path to keep the server's output when a run fails.
- From India, connecting to Neon can take longer than Node's 250ms per-address limit, which fails the connection. The e2e script raises it with `NODE_OPTIONS`; the same cause explains occasional failed requests in `npm run dev`.
- Keep the project outside OneDrive: its permission rules stop `next build` clearing old files.
- Money is stored as paise in BigInt `*Paise` columns. The API speaks rupees; convert with `src/lib/money.ts`.
- Each user has one display currency (`User.currency`). It changes the symbol only and never converts amounts. Show money with `formatCurrency`, and only add currencies with two decimals.
- Recurring items never post by themselves. The user logs or skips each occurrence.
- Savings goals earmark money that stays in its account (`GoalEntry` rows); they never change a balance. When a balance falls below what is set aside in it, `settleSavings` in `src/lib/savings.ts` takes the difference from the newest goals first. Goals are only topped up by hand.
- Loans are entered as an amount per month and dates. The form works out the balance from the due dates still to come; loan payments are still made by hand with Pay EMI.
- Apply migrations with `npm run db:migrate`. They use `DIRECT_URL`; the app uses `DATABASE_URL`.
- Expense dates are stored as UTC midnight of the chosen calendar day. Use `src/lib/dates.ts`, never `toISOString()`, for "today".
- `public/sw.js` must never cache pages or `/api/*`, because they hold private financial data. Bump `CACHE_NAME` when changing it.

## Important note
Keep the first version focused on core finance features. Build a clean, usable expense tracker before adding advanced SMS automation.

## Final recommendation
Build the app as a premium, mobile-first PWA using the same Next.js stack, with a budgeting-focused dashboard and account-aware finance flows instead of a workout-oriented experience. The project is now on track as a solid personal finance MVP and can continue into deeper PWA polish and future smart-import automation.
