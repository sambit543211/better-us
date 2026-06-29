-- Better Us: private two-person setup for Sammy and Shreya
-- Run this in Supabase SQL Editor after creating the project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  couple_id text not null default 'sammy-shreya-private',
  persona text not null check (persona in ('sammy', 'shreya')),
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists daily_entries_touch_updated_at on public.daily_entries;
create trigger daily_entries_touch_updated_at
before update on public.daily_entries
for each row execute function public.touch_updated_at();

create or replace function public.current_persona()
returns text as $$
  select persona from public.profiles where id = auth.uid() limit 1;
$$ language sql stable security definer set search_path = public;

alter table public.profiles enable row level security;
alter table public.daily_entries enable row level security;
alter table public.message_cards enable row level security;

drop policy if exists "profiles_select_private_pair" on public.profiles;
create policy "profiles_select_private_pair"
on public.profiles for select
to authenticated
using (couple_id = 'sammy-shreya-private');

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (id = auth.uid() and couple_id = 'sammy-shreya-private');

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid() and couple_id = 'sammy-shreya-private');

drop policy if exists "daily_select_private_pair" on public.daily_entries;
create policy "daily_select_private_pair"
on public.daily_entries for select
to authenticated
using (couple_id = 'sammy-shreya-private');

drop policy if exists "daily_insert_own_persona" on public.daily_entries;
create policy "daily_insert_own_persona"
on public.daily_entries for insert
to authenticated
with check (couple_id = 'sammy-shreya-private' and person_key = public.current_persona());

drop policy if exists "daily_update_own_persona" on public.daily_entries;
create policy "daily_update_own_persona"
on public.daily_entries for update
to authenticated
using (couple_id = 'sammy-shreya-private' and person_key = public.current_persona())
with check (couple_id = 'sammy-shreya-private' and person_key = public.current_persona());

drop policy if exists "messages_select_private_pair" on public.message_cards;
create policy "messages_select_private_pair"
on public.message_cards for select
to authenticated
using (couple_id = 'sammy-shreya-private');

drop policy if exists "messages_insert_own_persona" on public.message_cards;
create policy "messages_insert_own_persona"
on public.message_cards for insert
to authenticated
with check (couple_id = 'sammy-shreya-private' and author_key = public.current_persona());
