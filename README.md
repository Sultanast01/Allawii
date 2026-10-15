# Allawii — Smart Student Finance Companion

Allawii helps a Nigerian university student answer one question at any moment: *what can I safely spend right now, and what happens if I don't?*

Built for the B Moni × TINC26 hackathon. Mobile-first, offline-first, sandbox-only — no real money moves anywhere in the app.

## Quick Start

```bash
npm run install:all   # root + client + server dependencies
cp server/.env.example server/.env   # then set BMONI_API_KEY to your sandbox key
npm run dev
```

- **Client**: http://localhost:5173
- **Server**: http://localhost:3001 (Vite proxies `/api` → `:3001`)

The app is usable with the server switched off — only the B Moni screens need it.

## What is real and what is simulated

| Area | Status |
|---|---|
| Safe-to-spend, daily guide, budget cycles | Real math on the user's own records |
| Adaptive re-plan after an unexpected expense | Real — generated from live figures, applied only on tap |
| Savings goals, contributions, streaks | Real, stored locally |
| B Moni sandbox identity, KYC readiness, banks, NUBAN name lookup, FX rate | **Live API calls** through the backend |
| Wallet funding / transfers | **Not implemented** — needs device-side key signing (see below) |
| Receipt scanning | Sample extraction — OCR is not wired up; every field is editable before save |
| Statistics and spending patterns | Real — every bar, share and finding is calculated from recorded transactions, with thin-data caveats shown |
| Savings streaks | Real — recomputed from contribution dates on every read |
| Round-Up Savings | Real accrual engine on local transactions; sweep requires deployed smart wallet (see below) |
| Student offers | Illustrative, with a stated disclaimer |
| AI Money Coach | Deterministic engine on local data. No external AI provider, so no personal finance data leaves the device |

## Features

**Money core**
- Student profile & personalisation — school, income frequency, next income date
- Smart allowance manager — remaining allowance, days left, daily guide
- Expense & income tracking — 17 categories, four budget buckets (obligations, essentials, future you, enjoyment)
- Smart transaction inbox — filter by type/category/bucket, CSV import
- Receipt scanning — review-then-save flow (sample data)
- Adaptive budgeting — an unexpected expense produces transparent, per-category trims capped at 40%, discretionary buckets first
- Flexible savings goals — adjust, pause, resume, delete; progress and streak
- Round-up savings — spare change from every expense accrues until a threshold, then sweeps into a B Moni smart wallet
- Inflation-aware goals — each dated goal projects its likely cost at a user-set price-rise assumption
- "Can I afford it?" — verdict, trade-offs, and what the same money would become if saved
- What-if simulator — six scenarios, clearly marked as simulation only

**Guidance**
- AI Money Coach grounded in the user's actual numbers
- Spending insights, early warnings and personal patterns
- Statistics — income and spending charted by weekday, day or month, with a date picker, from recorded transactions only
- Spending patterns — weekday rhythm, time of day, category mix, committed vs discretionary, repeats and computed findings
- Allowance countdown and survival mode when a cycle runs dry
- Financial literacy hub — six lessons, each linked to the live plan
- Scam safety check — flags on a pasted message, in plain language, with the rule list shown on screen
- Financial calendar — income, dues, deadlines and goal checks on one timeline
- Campus group contributions ledger (simulated, labelled)
- WhatsApp assistant preferences

**Streaks**

A streak counts the calendar days on which money was added to a goal — one step per day, whatever the size.

- `streak.contributionDates` (local `YYYY-MM-DD` keys) is the single source of truth; the counts are recomputed on every read, so a missed day decays the streak without a timer running
- One day of grace: not having saved *yet* today does not break yesterday's run
- Milestones at 3, 7, 14, 30, 60 and 90 days, earned from the longest run
- Streaks are progress markers only — no payout, no ranking, no data leaving the device

**Round-Up Savings**

Every expense is rounded up to the nearest increment (₦50, ₦100, etc.) and the spare change accrues in a local ledger. When the accrued amount reaches a configurable threshold, it can be swept into a B Moni smart wallet via exchange quote + transfer.

- Spare change calculation is real — runs on recorded expenses, rounds each up, sums the differences
- Accrual is persisted in `server/data/allowii.json` under `roundUpLedger`
- Sweep attempts `POST /v1/exchange/quote` (NGN → CNGN) then `POST /v1/transactions/transfer` to the deployed smart wallet
- **Requires**: B Moni identity (`/bmoni/connect`), deployed smart wallet (via browser wallet signing), accrued amount ≥ threshold
- Without a deployed wallet, the sweep endpoint returns a clear error rather than simulating success
- The B Moni sandbox does not emit webhooks to localhost, so round-up calculation is triggered manually via the UI ("Calculate spare change" button) rather than automatically on each transaction

**Trust & access**
- Text-size control that scales every screen, switch labels for screen readers, pinch-zoom enabled
- Export my data / delete my data from Profile
- Sandbox-only B Moni; partner key never reaches the browser

**Layout**

Mobile-first, with a real desktop shell rather than a stretched phone: at `lg` (1024px) a 256px navy sidebar replaces the bottom tab bar, pages become two- and three-column grids, reading and chat widths are capped so lines stay legible, and result panels stick while inputs scroll. The pinned demo figures are identical on both.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite 6 |
| Styling | Tailwind CSS, navy/blue design system |
| State & storage | Zustand + `persist` (localStorage, key `allowii-storage-v2`) |
| Routing | React Router v6 |
| Backend | Express + TypeScript (`tsx`) |
| Storage | JSON file store (`server/data/allowii.json`) — swap for Postgres/Supabase in production |
| Auth | JWT + bcrypt |
| Financial API | B Moni Embedded API v1, sandbox |

## B Moni Integration

`server/src/services/bmoni.ts` calls `https://embedded-dev.bmoni.com/v1/*` with the `x-api-key` header. The key lives only in `server/.env`; the client authenticates to Allowii's own backend with a JWT.

Live endpoints, all reachable in `GET /api/bmoni/status` and the `/bmoni` screen:

- `POST /v1/users` — provision the synthetic demo customer (reused on later runs, matched by email or phone)
- `GET /v1/users/{bmoniUserId}` — profile, plus `/kyc/readiness` and `/onboarding/status`
- `GET /v1/users/{bmoniUserId}/bank-accounts/nigerian-banks` — 300+ banks
- `POST /v1/users/{bmoniUserId}/bank-accounts/verify-nigerian-account` — real NUBAN account-name resolution
- `GET /v1/users/{bmoniUserId}/exchange/rate/NGN/{to}` — live FX rate, plus `GET /v1/smart-wallets/supported-currencies`
- `POST /v1/users/{bmoniUserId}/exchange/quote` — exchange quote for round-up sweep (NGN → CNGN)
- `POST /v1/users/{bmoniUserId}/transactions/transfer` — transfer converted funds into smart wallet

**Smart wallet deploy (web)**

Browsers cannot use the `bmoni_embedded_sdk` (it needs iOS Secure Enclave / Android Keystore). Instead the web app anchors a managed smart wallet to a browser wallet (MetaMask, WalletConnect, etc.):

1. User connects their browser wallet via `wagmi` + `viem` (injected connector).
2. Frontend calls `POST /api/bmoni/wallet/challenge` with the connected address and chosen currency (CNGN / USDB / EURe).
3. Backend fetches an owner-proof challenge from BMONI (`/v1/users/{id}/smart-wallets/owner-proof-challenges`) and returns the challenge hash.
4. Frontend prompts the user's browser wallet to sign the hash (`signMessageAsync`).
5. Frontend calls `POST /api/bmoni/wallet/deploy` with the signature.
6. Backend forwards the signed proof to BMONI (`/v1/users/{id}/smart-wallets/create-managed`) and the managed smart wallet is deployed on-chain.

The signature is always produced by the user's own browser wallet — the backend never fabricates a key or signs on the user's behalf.

## Auth & Onboarding

| Screen | Path | What it does |
|---|---|---|
| Welcome | `/welcome` | Choose: create an account, sign in, or enter demo |
| Sign up | `/signup` | Name, email, university (optional), password with live strength meter, terms consent |
| Login | `/login` | Email + password against the backend, "remember me" picks a 30-day or 8-hour JWT |
| Plan setup | `/setup` | Three steps after auth: income cycle, fixed obligations, starting split → builds the category plan |

Signup and login hit `POST /api/auth/register` and `POST /api/auth/login`; the returned JWT is stored under `allowii-token` and the plan setup mirrors the profile to `PUT /api/auth/profile`. The device is still the source of truth for the plan, so if that sync fails the screen says so instead of pretending.

Google and Apple buttons are present but disabled by design — OAuth needs credentials from a developer console that this build does not carry, and tapping them says exactly that. Password reset is likewise disclosed as unavailable rather than faked.

Onboarding asks for no BVN, card PIN, banking password or identity document; a budget profile needs only how much money arrives and how often.

## Demo Mode

"Explore demo" loads a synthetic Unilag scenario that matches the design mockups:

- ₦60,000 monthly allowance, ₦18,500 spent, ₦9,000 reserved for goals → ₦32,500 left, 12 days out, ₦2,708/day guide
- Goals: New laptop ₦150,000 (₦45,000 saved), Emergency fund ₦30,000 (₦18,000 saved)
- Obligations: room rent ₦15,000, departmental dues ₦3,000
- A pending plan update, two insights, five calendar events, two group ledgers, an 8-day streak

All figures are synthetic. Nothing in demo mode contacts a bank or moves money.

## Project Structure

```
allawii/
├── client/src/
│   ├── components/   Header, BottomNav, AuthLayout, AuthFields
│   ├── context/      store.ts — state, budget engine, adaptive re-plan, starter plan
│   ├── pages/        22 screens
│   ├── services/     api.ts — authenticated calls to the Allowii backend
│   ├── types/        domain models and category config
│   └── utils/        naira formatting, safe-to-spend math
└── server/src/
    ├── routes/       auth, transactions, bmoni
    ├── services/     bmoni.ts — sandbox proxy
    └── models/       database.ts — JSON store
```

## Environment Variables

```env
# server/.env
BMONI_BASE_URL=https://embedded-dev.bmoni.com
BMONI_API_KEY=<sandbox key only — never a production key, never in the client>
JWT_SECRET=<random secret>
PORT=3001
```

`server/.env` is git-ignored. Production credentials are not supported by this build.

## Moving the backend to Supabase

The app is already structured for this: the client talks to one backend (`client/src/services/api.ts` → `/api/*`), the B Moni key lives only on the server, and the whole plan also lives on-device via Zustand `persist`. Supabase replaces the account, the JWT and the JSON file — it does **not** replace the B Moni proxy.

1. **Create the project** in the Supabase dashboard, then note the Project URL and the `anon` public key. Generate a service-role key only if you keep writes on the Express server — it must never be prefixed `VITE_`.
2. **Install** `@supabase/supabase-js` in `client/` (direct-from-browser mode) or in `server/` (proxy mode), not both.
3. **Schema** — run this in the SQL editor:

```sql
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null, email text unique not null,
  school text, income_frequency text check (income_frequency in ('weekly','biweekly','monthly')),
  typical_income numeric(12,2) default 0, next_income_date date,
  text_scale numeric(3,2) default 1, inflation_rate integer default 15,
  created_at timestamptz default now()
);
create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  type text not null check (type in ('income','expense','transfer')),
  amount numeric(12,2) not null check (amount > 0),
  category text not null, description text not null,
  occurred_at timestamptz not null, merchant text, payment_method text,
  budget_bucket text not null check (budget_bucket in ('obligations','essentials','future_you','enjoyment')),
  source text not null default 'manual', receipt_url text, notes text,
  created_at timestamptz default now()
);
create table savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null, target_amount numeric(12,2) not null, current_amount numeric(12,2) not null default 0,
  target_date date, contribution_per_cycle numeric(12,2) not null,
  contribution_frequency text not null check (contribution_frequency in ('daily','weekly','monthly')),
  is_paused boolean not null default false, created_at timestamptz default now()
);
-- The streak is derived, so store the events it is computed from, never the count.
create table goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  goal_id uuid not null references savings_goals on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  contributed_on date not null default (now() at time zone 'utc')::date,
  created_at timestamptz default now()
);
create table obligations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null, amount numeric(12,2) not null, frequency text not null,
  category text not null, due_day integer, next_due_date date
);
create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null, event_date date not null, kind text not null, amount numeric(12,2), notes text
);
create table bmoni_accounts (
  user_id uuid primary key references auth.users on delete cascade,
  bmoni_user_id text, wallet_id text, status text, created_at timestamptz default now()
);
create index on transactions (user_id, occurred_at desc);
create index on goal_contributions (user_id, contributed_on);
```

4. **Row Level Security** — this is the whole point of moving. Enable it and add one policy per table, substituting the table name:

```sql
alter table transactions enable row level security;
create policy "own rows" on transactions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

   Repeat for `profiles`, `savings_goals`, `goal_contributions`, `obligations`, `calendar_events`, `bmoni_accounts`. Never expose a table without a policy; `bmoni_accounts` in particular should be readable only by its owner because it carries the sandbox identity.
5. **Auth swap** — delete `bcrypt`, `jsonwebtoken`, `middleware/auth.ts` and `POST /api/auth/*`. Supabase issues and refreshes its own JWT: `supabase.auth.signUp({ email, password, options: { data: { name } } })`, `signInWithPassword`, `signOut`. The disabled Google and Apple buttons become real with `signInWithOAuth({ provider: 'google' | 'apple' })` once those providers are enabled in Authentication → Providers. Password reset becomes `resetPasswordForEmail`, which is the honest version of the "not available" copy currently on the login screen.
6. **Env vars** — `client/.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (both public by design, protected by RLS). `server/.env` keeps `BMONI_API_KEY` and `JWT_SECRET` disappears; if the server writes to Supabase it needs `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS and therefore stays server-side only.
7. **Rewire `client/src/services/api.ts`** — replace `authedFetch('/api/transactions')` with typed Supabase queries (`from('transactions').eq('user_id', uid).order('occurred_at', { ascending: false })`). Keep the module as the only place that touches Supabase so the store's call sites do not change.
8. **Keep the B Moni proxy on Express** — `server/src/routes/bmoni.ts` must stay. The partner key cannot go in the browser, so the client calls the server for B Moni and Supabase for data. Verify in the Network tab that no request from the bundle carries `x-api-key`.
9. **Decide the source of truth** — recommended: device-first. Keep Zustand `persist` as the working copy, write through to Supabase, and reuse the existing `syncStatus` column (`'synced' | 'pending' | 'failed'`) as the retry queue. On sign-in, merge by `occurred_at`/`created_at` per id, newest wins. Streaks need no migration work: `readStreak()` already recomputes everything from the contribution dates, so a device that has been offline for a week self-corrects on first load.
10. **Migrate existing rows** — the local JSON store is one file: read `server/data/allowii.json`, map `userId` to the new `auth.uid()` for that email, insert. Do it once, from a script, with the service-role key, then delete the script.
11. **Test before trusting it** — sign in as user A and try to read user B's rows by id (must come back empty), check the RLS advisor in the dashboard, confirm the app still works with the network off, and confirm demo mode never touches Supabase.

## Safety Rules Held Throughout

- No partner API key, AI secret or privileged credential in the frontend bundle
- Budgeting needs no BVN, card PIN, password or identity documents
- A proposed, failed or pending transfer is never recorded as an expense
- Coach answers derive only from data the user entered — it cannot invent balances, income or obligations
- Offer, receipt and group data are labelled as illustrative or simulated

## License

MIT — built for the B Moni × TINC26 Hackathon
