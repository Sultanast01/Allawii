# Moneva — Smart Student Finance Companion

Moneva helps a Nigerian university student answer one question at any moment: *what can I safely spend right now, and what happens if I don't?*

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
- Inflation-aware goals — each dated goal projects its likely cost at a user-set price-rise assumption
- "Can I afford it?" — verdict, trade-offs, and what the same money would become if saved
- What-if simulator — six scenarios, clearly marked as simulation only

**Guidance**
- AI Money Coach grounded in the user's actual numbers
- Spending insights, early warnings and personal patterns
- Allowance countdown and survival mode when a cycle runs dry
- Financial literacy hub — six lessons, each linked to the live plan
- Scam safety check — flags on a pasted message, in plain language
- Financial calendar — income, dues, deadlines and goal checks on one timeline
- Campus group contributions ledger (simulated, labelled)
- Savings streaks and milestones
- WhatsApp assistant preferences

**Trust & access**
- Text-size control that scales every screen, switch labels for screen readers, pinch-zoom enabled
- Export my data / delete my data from Profile
- Sandbox-only B Moni; partner key never reaches the browser

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite 6 |
| Styling | Tailwind CSS, navy/blue design system |
| State & storage | Zustand + `persist` (localStorage, key `moneva-storage-v2`) |
| Routing | React Router v6 |
| Backend | Express + TypeScript (`tsx`) |
| Storage | JSON file store (`server/data/moneva.json`) — swap for Postgres/Supabase in production |
| Auth | JWT + bcrypt |
| Financial API | B Moni Embedded API v1, sandbox |

## B Moni Integration

`server/src/services/bmoni.ts` calls `https://embedded-dev.bmoni.com/v1/*` with the `x-api-key` header. The key lives only in `server/.env`; the client authenticates to Moneva's own backend with a JWT.

Live endpoints, all reachable in `GET /api/bmoni/status` and the `/bmoni` screen:

- `POST /v1/users` — provision the synthetic demo customer (reused on later runs, matched by email or phone)
- `GET /v1/users/{bmoniUserId}` — profile, plus `/kyc/readiness` and `/onboarding/status`
- `GET /v1/users/{bmoniUserId}/bank-accounts/nigerian-banks` — 300+ banks
- `POST /v1/users/{bmoniUserId}/bank-accounts/verify-nigerian-account` — real NUBAN account-name resolution
- `GET /v1/users/{bmoniUserId}/exchange/rate/NGN/{to}` — live FX rate, plus `GET /v1/smart-wallets/supported-currencies`

Wallet creation and transfers are deliberately absent: B Moni's managed wallets require an EIP-191 owner-proof signature produced by the embedded SDK on the user's device. Faking it server-side would be inventing a financial action, so the screen says exactly what it does and does not do, and the account-name checker is presented as a pre-transfer safety step rather than a transfer.

## Demo Mode

"Explore demo" loads a synthetic Unilag scenario that matches the design mockups:

- ₦60,000 monthly allowance, ₦18,500 spent, ₦9,000 reserved for goals → ₦32,500 left, 12 days out, ₦2,708/day guide
- Goals: New laptop ₦150,000 (₦45,000 saved), Emergency fund ₦30,000 (₦18,000 saved)
- Obligations: room rent ₦15,000, departmental dues ₦3,000
- A pending plan update, two insights, five calendar events, two group ledgers, an 8-day streak

All figures are synthetic. Nothing in demo mode contacts a bank or moves money.

## Project Structure

```
moneva/
├── client/src/
│   ├── components/   Header, BottomNav
│   ├── context/      store.ts — state, budget engine, adaptive re-plan
│   ├── pages/        17 screens
│   ├── services/     api.ts — authenticated calls to the Moneva backend
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

## Safety Rules Held Throughout

- No partner API key, AI secret or privileged credential in the frontend bundle
- Budgeting needs no BVN, card PIN, password or identity documents
- A proposed, failed or pending transfer is never recorded as an expense
- Coach answers derive only from data the user entered — it cannot invent balances, income or obligations
- Offer, receipt and group data are labelled as illustrative or simulated

## License

MIT — built for the B Moni × TINC26 Hackathon
