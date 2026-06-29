-- Couple Health Habit Tracker
-- Run this once in Supabase SQL Editor after creating your Supabase project.
-- Then enable Authentication and add your Vercel site URL under Auth > URL Configuration.

create extension if not exists pgcrypto;

create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text unique not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  couple_id uuid references public.couples(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  entry_date date not null,
  meals jsonb not null default '{}'::jsonb,
  habits jsonb not null default '{}'::jsonb,
  score integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, entry_date)
);

-- Helper function used by RLS policies. SECURITY DEFINER prevents recursive profile policies.
create or replace function public.current_user_couple_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select p.couple_id from public.profiles p where p.id = auth.uid() limit 1;
$$;

grant execute on function public.current_user_couple_id() to authenticated;

alter table public.couples enable row level security;
alter table public.profiles enable row level security;
alter table public.daily_entries enable row level security;

-- Couples: users can read only their own couple. Creation/joining happens through RPC functions below.
drop policy if exists "Users can read own couple" on public.couples;
create policy "Users can read own couple"
on public.couples for select
to authenticated
using (id = public.current_user_couple_id());

-- Profiles: each user can create/update their profile; members of same couple can read each other.
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Couple members can read profiles" on public.profiles;
create policy "Couple members can read profiles"
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or couple_id = public.current_user_couple_id()
);

-- Daily entries: users can insert/update only their own rows, and read both partners' rows for their couple.
drop policy if exists "Users can insert own entries" on public.daily_entries;
create policy "Users can insert own entries"
on public.daily_entries for insert
to authenticated
with check (
  user_id = auth.uid()
  and couple_id = public.current_user_couple_id()
);

drop policy if exists "Users can update own entries" on public.daily_entries;
create policy "Users can update own entries"
on public.daily_entries for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and couple_id = public.current_user_couple_id()
);

drop policy if exists "Couple members can read entries" on public.daily_entries;
create policy "Couple members can read entries"
on public.daily_entries for select
to authenticated
using (couple_id = public.current_user_couple_id());

-- Safe onboarding helpers. These functions avoid exposing all couple invite codes to the browser.
create or replace function public.create_couple_with_profile(display_name text, invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_couple_id uuid;
  cleaned_code text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  cleaned_code := upper(regexp_replace(trim(invite_code), '[^A-Z0-9]', '', 'g'));
  if cleaned_code is null or length(cleaned_code) < 4 then
    raise exception 'Invite code must be at least 4 letters/numbers';
  end if;

  insert into public.couples(invite_code, created_by)
  values (cleaned_code, auth.uid())
  returning id into new_couple_id;

  insert into public.profiles(id, display_name, couple_id)
  values (auth.uid(), coalesce(nullif(trim(display_name), ''), 'Partner'), new_couple_id)
  on conflict (id) do update set display_name = excluded.display_name, couple_id = excluded.couple_id;

  return new_couple_id;
end;
$$;

create or replace function public.join_couple_with_profile(display_name text, invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_couple_id uuid;
  cleaned_code text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  cleaned_code := upper(regexp_replace(trim(invite_code), '[^A-Z0-9]', '', 'g'));

  select id into target_couple_id
  from public.couples
  where couples.invite_code = cleaned_code
  limit 1;

  if target_couple_id is null then
    raise exception 'Invite code not found';
  end if;

  insert into public.profiles(id, display_name, couple_id)
  values (auth.uid(), coalesce(nullif(trim(display_name), ''), 'Partner'), target_couple_id)
  on conflict (id) do update set display_name = excluded.display_name, couple_id = excluded.couple_id;

  return target_couple_id;
end;
$$;

grant execute on function public.create_couple_with_profile(text, text) to authenticated;
grant execute on function public.join_couple_with_profile(text, text) to authenticated;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_entries_updated_at on public.daily_entries;
create trigger set_entries_updated_at
before update on public.daily_entries
for each row execute function public.set_updated_at();
