# Allawii — Smart Student Finance Companion

Allawii helps a Nigerian university student answer one question at any moment: *what can I safely spend right now, and what happens if I don't?*

Built for the B Moni × TINC26 hackathon. Mobile-first, offline-first, sandbox-only — no real money moves anywhere in the app.

## Quick Start

```bash
npm run install:all   # root + client + server dependencies
cp server/.env.example server/.env   # add the Supabase keys + your BotFather token
npm run dev                           # client :5173, server :3001, Telegram assistant in-process
node server/e2e-supabase.mjs          # 23 checks against the live Supabase project
```

The `e2e-supabase.mjs` run needs `BOT_API_KEY` in the environment and a server listening on
`:3001`; it registers throwaway users, exercises auth + sync + the assistant contract, and confirms
one user can never read another's rows.

The Telegram assistant runs inside the API process — `npm run dev` is the only command. On boot the
server logs `Telegram assistant: live as @your_bot`; without `TELEGRAM_BOT_TOKEN` it logs
`offline` and everything else keeps working. Message the bot `/start` to use it.

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
| Telegram assistant | Real — it runs inside this server, over the same Supabase ledger the app syncs. Insights are deterministic (no LLM) |

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
- Telegram assistant — message the bot to check balance, record money in or out, see goals and budgets

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
| Storage | Supabase Postgres (via `server/src/models/database.ts`) |
| Auth | Supabase Auth (email + password; sessions proxied by the backend) |
| Financial API | B Moni Embedded API v1, sandbox |

## B Moni Integration

`server/src/services/bmoni.ts` calls `https://embedded-dev.bmoni.com/v1/*` with the `x-api-key` header. The key lives only in `server/.env`; the client authenticates to Allawii's own backend with its Supabase session token.

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

## Telegram Assistant

The assistant is part of this server: it long-polls Telegram from the same process that serves the API and talks to the same Supabase ledger as the app, so a spend logged on Telegram is on the next app sync. Money logic lives in one place (`server/src/services/bot-gateway.ts`) and the bot only formats replies.

| Piece | File | Role |
| --- | --- | --- |
| Bot loop | `server/src/bot/index.ts` | long-polling, `/start` and `/link`, replies, inline buttons, daily budget nudges |
| Telegram transport | `server/src/bot/telegram.ts` | `getMe`/`sendMessage`/`answerCallbackQuery`/`getUpdates` over `fetch` - no bot SDK |
| Intent parsing | `server/src/bot/intents.ts` | "1.5k", "3 days", and what a sentence is a purchase of |
| Money abilities | `server/src/services/bot-gateway.ts` | summary, expense, goal contribution, budget transfer, link codes - naira in, kobo stored |
| HTTP mirror | `server/src/routes/bot.ts` | `/api/bot/*` behind `BOT_API_KEY`, for anyone who still runs the [standalone bot repo](https://github.com/Sultanast01/allawii-bot) against this server |
| Linking | `server/src/routes/bot.ts` + Profile screen | `/api/bot/user/link-code` mints a one-time 6-digit code; the user sends `/link 123456` to the bot |
| Ledger sync | `server/src/routes/sync.ts` + `client/src/services/sync.ts` | last-write-wins merge, tombstones, server-only rows never destroyed |

What the bot understands: "I spent 1500 on lunch", "save 2000", "What's my balance?", "What's my safe spend today?", "How are my budgets?", "My savings goals", "can I afford 6000?"

### Turning it on

1. Create a bot with [@BotFather](https://t.me/BotFather) and keep the token.
2. In `server/.env`: set `TELEGRAM_BOT_TOKEN`. `TELEGRAM_BOT_USERNAME` is only a placeholder - the app shows the `@username` Telegram reports for that token. `npm run dev` then starts the assistant with the API; with no token it logs `offline` and the rest of the server is unaffected.
3. In the app: **Profile -> Telegram assistant -> Generate link code**, then send `/link <code>` to the bot. The code is single-use and expires in 15 minutes; `GET /api/bot/user/status` reports the link state and whether the assistant is live.

Long-polling means the server needs no public host, tunnel or webhook. Only one process may poll a token at a time - if you run the standalone bot repo against this server instead, leave `TELEGRAM_BOT_TOKEN` unset here so the in-process assistant stays offline.

**Identity rule:** the bot only sees a `userId` after the user proves possession of a code minted inside their authenticated app session. Unknown codes get "did not work", expired codes get an explicit error - no ledger detail is ever named for an unlinked chat.

## Auth & Onboarding

| Screen | Path | What it does |
|---|---|---|
| Welcome | `/welcome` | Choose: create an account, sign in, or enter demo |
| Sign up | `/signup` | Name, email, university (optional), password with live strength meter, terms consent |
| Login | `/login` | Email + password against Supabase Auth (through the backend); the session token lasts an hour and refreshes transparently |
| Plan setup | `/setup` | Three steps after auth: income cycle, fixed obligations, starting split → builds the category plan |

Signup and login hit `POST /api/auth/register` and `POST /api/auth/login`; the backend creates and verifies the account in **Supabase Auth** (`auth.admin.createUser` with `email_confirm`, then `signInWithPassword`) and returns the Supabase session — access token, refresh token, expiry — which the client stores under `allowii-token`. Every API call sends that access token; the server checks it with `supabase.auth.getUser()`, and a 401 triggers one transparent `POST /api/auth/refresh`. The plan setup mirrors the profile to `PUT /api/auth/profile`. The device is still the source of truth for the plan, so if that sync fails the screen says so instead of pretending.

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
    ├── bot/          index.ts — the Telegram assistant loop; telegram.ts — Bot API over fetch
    ├── routes/       auth, transactions, bmoni, round-up, bot (HTTP mirror), sync
    ├── services/     bmoni.ts — sandbox proxy; sync.ts — ledger merge; bot-gateway.ts — the assistant's money abilities
    ├── lib/          supabase.ts — service-role + anon-key clients
    └── models/       database.ts — Supabase Postgres repository
```

## Environment Variables

```env
# server/.env
BMONI_BASE_URL=https://embedded-dev.bmoni.com
# B Moni partner key — the shared sandbox key from B Moni's API reference.
# Sandbox-only, dev base URL only; never a production key, never in the client.
BMONI_API_KEY=pk_a025cacbf33a_76fb864113f3540909de5b1da39cc146906e35b1c6d4d1e4
PORT=3001

# Supabase (Project Settings → API)
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon public key — used for sign-in and token verification>
SUPABASE_SERVICE_ROLE_KEY=<service role secret — server-side only, bypasses RLS>

# Telegram assistant (see "Telegram Assistant")
TELEGRAM_BOT_TOKEN=<BotFather token — the assistant runs in this process>
TELEGRAM_BOT_USERNAME=<optional placeholder; the app shows the username Telegram reports>
BOT_API_KEY=<long random string, only for the /api/bot/* HTTP mirror>
DEMO_PASSWORD=<password for the auto-seeded demo persona>
```

`server/.env` is git-ignored. Production credentials are not supported by this build.

## Supabase Backend

The Express server is the only gateway to Supabase: accounts live in `auth.users`, all app data lives in Postgres tables reached through the service-role client (`server/src/lib/supabase.ts`), and every table has RLS enabled with **no policies** - the anon key can read nothing, and the service-role key never leaves the server. The B Moni proxy is unchanged: the partner key still only exists server-side.

Schema (applied as the `init` migration; source of truth in `server/supabase/schema.sql`):

| Table | Carries |
| --- | --- |
| `profiles` | name, email, university, phone, income cycle, bot link code, streak dates - id references `auth.users` |
| `transactions` | the ledger; amounts in kobo, dates as ISO text, `source` includes `telegram` |
| `savings_goals` | goals with `contribution_dates` for the streak |
| `budget_plans` | the app's category split, mirrored on sync so the bot can report spend vs limit |
| `bmoni_accounts` | sandbox identity per user (owner-readable only) |
| `round_up_settings` / `round_up_ledger` | round-up engine state |
| `bot_links` | Telegram `chat_id` -> `user_id` after a code link |

Amounts are kobo `bigint`s and timestamps are ISO `text` - the same shapes the client already stores, so rows round-trip without timezone drift. Signup auto-confirms the auth user server-side (`email_confirm: true`), so the project needs no email provider for the demo; enabling one later is a Supabase dashboard setting, not a code change.

## Safety Rules Held Throughout

- No partner API key, AI secret or privileged credential in the frontend bundle
- Budgeting needs no BVN, card PIN, password or identity documents
- A proposed, failed or pending transfer is never recorded as an expense
- Coach answers derive only from data the user entered — it cannot invent balances, income or obligations
- Offer, receipt and group data are labelled as illustrative or simulated

## License

MIT — built for the B Moni × TINC26 Hackathon
