-- Lingo online multiplayer schema (Supabase PostgreSQL).
-- Apply via the Supabase SQL editor or `supabase db push`.
-- Server access uses the service-role key; anonymous clients get nothing.

create table if not exists public.lingo_matches (
  id uuid primary key,
  code text not null unique,
  format text not null check (format in ('quick-duel','five-word-battle')),
  status text not null check (status in
    ('waiting','ready','countdown','playing','finished','cancelled','expired','forfeited')),
  config_json text not null,
  targets_json text not null,
  host_token_hash text not null,
  guest_token_hash text,
  host_nickname text,
  guest_nickname text,
  host_guest_hash text not null,
  guest_guest_hash text,
  host_ready boolean not null default false,
  guest_ready boolean not null default false,
  countdown_ends_at timestamptz,
  match_started_at timestamptz,
  current_round_index integer not null default 0,
  round_started_at timestamptz,
  next_round_started_at timestamptz,
  host_deadline_at timestamptz,
  guest_deadline_at timestamptz,
  host_extensions_left integer not null default 0,
  guest_extensions_left integer not null default 0,
  host_extensions_used_round integer not null default 0,
  guest_extensions_used_round integer not null default 0,
  winner text check (winner in ('host','guest','draw')),
  end_reason text,
  result_json text,
  rematch_requested_host boolean not null default false,
  rematch_requested_guest boolean not null default false,
  rematch_of uuid,
  rematch_with_code text,
  version integer not null default 0,
  last_action_ids jsonb not null default '[]'::jsonb,
  last_action_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists lingo_matches_code_idx on public.lingo_matches (code);
create index if not exists lingo_matches_status_idx on public.lingo_matches (status);

create table if not exists public.lingo_match_rounds (
  id text primary key,
  match_id uuid not null references public.lingo_matches(id) on delete cascade,
  round_index integer not null,
  word text not null,
  started_at timestamptz,
  next_start_at timestamptz,
  base_deadline_at timestamptz,
  host_deadline_at timestamptz,
  guest_deadline_at timestamptz,
  host_outcome text not null check (host_outcome in ('playing','solved','failed','timeout')),
  guest_outcome text not null check (guest_outcome in ('playing','solved','failed','timeout')),
  host_score integer not null default 0,
  guest_score integer not null default 0,
  host_solved_at timestamptz,
  guest_solved_at timestamptz,
  host_extensions_used integer not null default 0,
  guest_extensions_used integer not null default 0,
  resolved_at timestamptz,
  unique (match_id, round_index)
);

create index if not exists lingo_rounds_match_idx on public.lingo_match_rounds (match_id);

create table if not exists public.lingo_round_submissions (
  id text primary key,
  match_id uuid not null references public.lingo_matches(id) on delete cascade,
  round_id text not null references public.lingo_match_rounds(id) on delete cascade,
  player text not null check (player in ('host','guest')),
  seq integer not null,
  word text not null,
  result_json text not null,
  created_at timestamptz not null default now(),
  unique (round_id, player, seq)
);

create index if not exists lingo_subs_round_idx on public.lingo_round_submissions (round_id);

create table if not exists public.lingo_match_events (
  id text primary key,
  match_id uuid not null references public.lingo_matches(id) on delete cascade,
  action_id text not null unique,
  type text not null,
  player text not null check (player in ('host','guest','system')),
  payload_json text not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists lingo_events_match_idx on public.lingo_match_events (match_id);

create table if not exists public.lingo_match_results (
  match_id uuid primary key references public.lingo_matches(id) on delete cascade,
  result_json text not null,
  created_at timestamptz not null default now()
);

-- Security: anonymous users get no access; the server uses the service-role key.
alter table public.lingo_matches enable row level security;
alter table public.lingo_match_rounds enable row level security;
alter table public.lingo_round_submissions enable row level security;
alter table public.lingo_match_events enable row level security;
alter table public.lingo_match_results enable row level security;
