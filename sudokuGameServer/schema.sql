-- Run this once in the Supabase SQL editor.
-- The Flask server uses the publishable key, so the anon role must be able to read and write rooms.

create table if not exists public.rooms (
  id text primary key,
  code text not null unique,
  name text not null,
  is_public boolean not null default true,
  require_both boolean not null default false,
  difficulty text not null,
  host_id text not null,
  players jsonb not null default '[]'::jsonb,
  max_players integer not null default 5,
  round integer not null default 0,
  puzzle jsonb
);

create unique index if not exists rooms_name_lower_idx on public.rooms (lower(name));

grant select, insert, update, delete on public.rooms to anon, authenticated;

alter table public.rooms disable row level security;
