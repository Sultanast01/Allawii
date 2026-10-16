-- Run after schema.sql to confirm the shape the Express server expects.
-- Every table must show relrowsecurity = true and zero policies: the service-role
-- key is the only writer, and the anon key must be unable to read anything.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  (select count(*) from pg_policy p where p.polrelid = c.oid) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and c.relname in ('profiles', 'transactions', 'savings_goals', 'budget_plans',
                    'bmoni_accounts', 'round_up_settings', 'round_up_ledger', 'bot_links')
order by c.relname;

-- Expected hot paths. A sequential scan here means an index is missing.
explain (costs off) select 1 from public.profiles where email = 'a@b.c';
explain (costs off) select 1 from public.profiles where bot_link_code = '123456';
explain (costs off) select 1 from public.bot_links where user_id = gen_random_uuid();
explain (costs off) select 1 from public.transactions where user_id = gen_random_uuid() order by date desc;
