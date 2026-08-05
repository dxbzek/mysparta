-- Cloud save: the first slice of the model in docs/05-database-schema.md.
--
-- Encodes that document's rules rather than restating them: UUID v7 keys (§1.8),
-- CHECKs as the last line of defence (§1.9), RLS on every table with the
-- anonymous key granted only the public read surface (§1.10), idempotency keys
-- persisted for every mutation (§1.11), and a schema-version column beside the
-- JSONB payload so any historical row stays parseable (§1.4).
--
-- Not applied anywhere. Run against whichever project the game gets.

create extension if not exists pgcrypto;

-- Time-ordered UUIDs give index locality on append-heavy tables. Swapped for
-- the native uuidv7() when the database reaches Postgres 18, no schema change.
create or replace function uuid_v7() returns uuid language plpgsql volatile as $$
declare
  unix_ts_ms bytea;
  uuid_bytes bytea;
begin
  unix_ts_ms := substring(int8send((extract(epoch from clock_timestamp()) * 1000)::bigint) from 3);
  uuid_bytes := unix_ts_ms || gen_random_bytes(10);
  uuid_bytes := set_byte(uuid_bytes, 6, (b'0111' || get_byte(uuid_bytes, 6)::bit(4))::bit(8)::int);
  uuid_bytes := set_byte(uuid_bytes, 8, (b'10' || get_byte(uuid_bytes, 8)::bit(6))::bit(8)::int);
  return encode(uuid_bytes, 'hex')::uuid;
end $$;

-- One row per account, created on first visit (anonymous-first auth).
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text unique,
  created_at timestamptz not null default now()
);

-- One row per champion. The columns the game queries are relational; the
-- client's own presentation state rides along as JSONB it alone interprets.
create table if not exists champions (
  id uuid primary key default uuid_v7(),
  profile_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  display_name text not null,
  seed bigint not null,
  omen text not null,
  epithet text not null,
  level smallint not null default 1,
  xp integer not null default 0,
  kleos integer not null default 1500,
  vigor smallint not null default 12,
  vigor_date date not null,
  wins integer not null default 0,
  losses integer not null default 0,
  total_fights integer not null default 0,
  stats jsonb not null,
  loadout jsonb not null,          -- weapons, skills, beasts
  presentation jsonb not null,     -- look, portrait, gear, quests
  save_schema smallint not null,
  -- Optimistic concurrency: bumped on every accepted push, so a save made on
  -- a second device cannot be silently overwritten by a stale first device.
  version integer not null default 0,
  updated_at timestamptz not null default now(),
  -- The canon, enforced where the API cannot fumble it (§1.9).
  constraint champions_level_range check (level between 1 and 50),
  constraint champions_vigor_range check (vigor between 0 and 12),
  constraint champions_kleos_floor check (kleos >= 1000),
  constraint champions_counts_nonneg check (wins >= 0 and losses >= 0 and total_fights >= 0),
  -- One champion per name per realm; the name IS the seed of the hunter.
  constraint champions_name_unique unique (lower(name))
);

create index if not exists champions_profile_idx on champions (profile_id);
-- The ladder reads this, so it is an index and not a sort.
create index if not exists champions_kleos_idx on champions (kleos desc);

-- Retries on a flaky mobile network must not double-write (§1.11).
create table if not exists idempotency_keys (
  key uuid primary key,
  profile_id uuid not null references profiles (id) on delete cascade,
  route text not null,
  response jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idempotency_created_idx on idempotency_keys (created_at);

/* ---------------------------------------------------------------- */
/* Row Level Security — defence in depth behind the API (§1.10)      */
/* ---------------------------------------------------------------- */

alter table profiles enable row level security;
alter table champions enable row level security;
alter table idempotency_keys enable row level security;

-- Clients never touch tables; all writes come through apps/api on the service
-- role, which bypasses RLS. These policies exist so that a leaked anonymous
-- key yields exactly the public share surface and nothing else.
drop policy if exists champions_public_read on champions;
create policy champions_public_read on champions
  for select using (true);

drop policy if exists profiles_self_read on profiles;
create policy profiles_self_read on profiles
  for select using (auth.uid() = id);

-- No anon insert/update/delete policy anywhere: absence is denial.

comment on table champions is
  'One champion per account slot. version = optimistic concurrency token for cloud save; presentation is client-owned JSONB.';
