-- Allawii Supabase schema (applied as the `init` migration).
-- Accounts live in auth.users (Supabase Auth); every table below is written
-- exclusively by the Express server through the service-role client, so RLS
-- is enabled with no policies: the anon key can read nothing.
-- Amounts are kobo integers and timestamps are ISO text — the shapes the
-- client already stores, so rows round-trip through JS without timezone drift.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text,
  university text,
  phone_number text,
  income_frequency text not null default 'monthly',
  typical_income_in_kobo bigint not null default 0,
  next_income_date text,
  is_demo boolean not null default false,
  bot_link_code text,
  bot_link_expires_at text,
  streak_dates jsonb not null default '[]'::jsonb,
  created_at text
);
-- Sign-in looks up `where email = ?` and every write lowercases first
-- (server/src/routes/auth.ts), so the index is on the column itself: an
-- expression index on lower(email) would not be usable by that filter.
create unique index if not exists profiles_email_key on public.profiles (email);
create index if not exists profiles_phone_idx on public.profiles (phone_number);
create index if not exists profiles_bot_link_code_idx on public.profiles (bot_link_code);

create table if not exists public.transactions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount_in_kobo bigint not null check (amount_in_kobo >= 0),
  category text not null,
  description text not null default '',
  date text not null,
  merchant text,
  payment_method text,
  budget_bucket text check (budget_bucket in ('obligations', 'essentials', 'future_you', 'enjoyment')),
  notes text,
  source text not null default 'manual',
  sync_status text not null default 'synced',
  updated_at text
);
create index if not exists transactions_user_date_idx on public.transactions (user_id, date desc);

create table if not exists public.savings_goals (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  target_amount_in_kobo bigint not null default 0,
  current_amount_in_kobo bigint not null default 0,
  target_date text,
  contribution_per_cycle_in_kobo bigint not null default 0,
  contribution_frequency text not null default 'monthly',
  progress integer not null default 0,
  is_paused boolean not null default false,
  contribution_dates jsonb not null default '[]'::jsonb,
  savings_type text not null default 'target',
  withdrawal_date text,
  created_at text,
  updated_at text
);
create index if not exists savings_goals_user_idx on public.savings_goals (user_id);

-- Added after launch: what a pot is for and when it is meant to be taken out.
-- Idempotent, so re-running this file upgrades an existing project in place.
alter table if exists public.savings_goals add column if not exists savings_type text not null default 'target';
alter table if exists public.savings_goals add column if not exists withdrawal_date text;

create table if not exists public.budget_plans (
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  name text not null default '',
  bucket text not null default 'essentials',
  allocated_in_kobo bigint not null default 0,
  updated_at text,
  primary key (user_id, category)
);

create table if not exists public.bmoni_accounts (
  id text primary key,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  bmoni_user_id text,
  partner_user_id text,
  profile jsonb,
  created_at text
);

create table if not exists public.round_up_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default false,
  round_up_to_in_kobo bigint not null default 5000,
  threshold_in_kobo bigint not null default 50000,
  target_goal_id text,
  target_wallet_address text,
  from_currency text not null default 'NGN',
  to_currency text not null default 'CNGN',
  last_sweep_at text
);

create table if not exists public.round_up_ledger (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_id text,
  original_amount_in_kobo bigint,
  rounded_up_in_kobo bigint,
  spare_change_in_kobo bigint,
  status text not null default 'accrued',
  created_at text,
  swept_at text,
  quote_data jsonb,
  transfer_data jsonb
);
create index if not exists round_up_ledger_user_idx on public.round_up_ledger (user_id, created_at);

create table if not exists public.bot_links (
  chat_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at text
);
-- The app asks "which chat is this user linked to?" as often as the reverse.
create index if not exists bot_links_user_idx on public.bot_links (user_id);

-- Service-role-only access: enable RLS, define no policies.
alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.savings_goals enable row level security;
alter table public.budget_plans enable row level security;
alter table public.bmoni_accounts enable row level security;
alter table public.round_up_settings enable row level security;
alter table public.round_up_ledger enable row level security;
alter table public.bot_links enable row level security;
