-- Better Us: no-login private two-person setup for Sammy and Shreya
-- Run this in Supabase SQL Editor after creating the project.
-- This version does NOT use Supabase Auth. Anyone with the app URL can read/write,
-- so keep the Vercel URL private.

create extension if not exists pgcrypto;

create table if not exists public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  couple_id text not null default 'sammy-shreya-private',
  person_key text not null check (person_key in ('sammy', 'shreya')),
  entry_date date not null,
  meals jsonb not null default '{}'::jsonb,
  habits jsonb not null default '{}'::jsonb,
  reflection jsonb not null default '{}'::jsonb,
  score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (couple_id, person_key, entry_date)
);

create table if not exists public.message_cards (
  id uuid primary key default gen_random_uuid(),
  couple_id text not null default 'sammy-shreya-private',
  author_key text not null check (author_key in ('sammy', 'shreya')),
  author_name text not null,
  message_text text not null,
  audience text not null default 'both' check (audience in ('both', 'me', 'partner')),
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists daily_entries_touch_updated_at on public.daily_entries;
create trigger daily_entries_touch_updated_at
before update on public.daily_entries
for each row execute function public.touch_updated_at();

alter table public.daily_entries enable row level security;
alter table public.message_cards enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.daily_entries to anon, authenticated;
grant select, insert on public.message_cards to anon, authenticated;

drop policy if exists "daily_select_private_pair_public" on public.daily_entries;
create policy "daily_select_private_pair_public"
on public.daily_entries for select
to anon, authenticated
using (couple_id = 'sammy-shreya-private');

drop policy if exists "daily_insert_private_pair_public" on public.daily_entries;
create policy "daily_insert_private_pair_public"
on public.daily_entries for insert
to anon, authenticated
with check (
  couple_id = 'sammy-shreya-private'
  and person_key in ('sammy', 'shreya')
);

drop policy if exists "daily_update_private_pair_public" on public.daily_entries;
create policy "daily_update_private_pair_public"
on public.daily_entries for update
to anon, authenticated
using (
  couple_id = 'sammy-shreya-private'
  and person_key in ('sammy', 'shreya')
)
with check (
  couple_id = 'sammy-shreya-private'
  and person_key in ('sammy', 'shreya')
);

drop policy if exists "messages_select_private_pair_public" on public.message_cards;
create policy "messages_select_private_pair_public"
on public.message_cards for select
to anon, authenticated
using (couple_id = 'sammy-shreya-private');

drop policy if exists "messages_insert_private_pair_public" on public.message_cards;
create policy "messages_insert_private_pair_public"
on public.message_cards for insert
to anon, authenticated
with check (
  couple_id = 'sammy-shreya-private'
  and author_key in ('sammy', 'shreya')
);
