-- Karogs online multiplayer schema (Supabase PostgreSQL).
-- Apply via the Supabase SQL editor or `supabase db push`.

create table if not exists public.multiplayer_games (
  id uuid primary key,
  code text not null unique,
  status text not null check (status in ('waiting','setup','playing','finished','abandoned')),
  host_token_hash text not null,
  guest_token_hash text,
  red_token_hash text,
  blue_token_hash text,
  red_nickname text,
  blue_nickname text,
  host_guest_hash text not null,
  guest_guest_hash text,
  state_json text not null,
  version integer not null default 0,
  ready_red boolean not null default false,
  ready_blue boolean not null default false,
  last_action_ids jsonb not null default '[]'::jsonb,
  last_action_at timestamptz not null default now(),
  winner text,
  end_reason text,
  rematch_of uuid,
  rematch_with_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists multiplayer_games_code_idx on public.multiplayer_games (code);

create table if not exists public.multiplayer_results (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null unique references public.multiplayer_games(id) on delete cascade,
  winner_side text not null,
  winner_guest_hash text,
  red_guest_hash text not null,
  blue_guest_hash text not null,
  red_nickname text,
  blue_nickname text,
  moves integer not null,
  duration_sec integer not null,
  end_reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists multiplayer_results_winner_idx
  on public.multiplayer_results (winner_guest_hash);

-- Server-verified public leaderboard (wins, then draws, then games).
create or replace function public.multiplayer_leaderboard(row_limit integer)
returns table (
  nickname text,
  wins bigint,
  losses bigint,
  draws bigint,
  games bigint
)
language sql
stable
as $$
  select
    coalesce(r.nickname, 'Anonīms') as nickname,
    sum(case when r.winner_side = r.side then 1 else 0 end) as wins,
    sum(case when r.winner_side <> r.side and r.winner_side <> 'draw' then 1 else 0 end) as losses,
    sum(case when r.winner_side = 'draw' then 1 else 0 end) as draws,
    count(*) as games
  from (
    select red_guest_hash as guest_hash, red_nickname as nickname, winner_side, 'red' as side
      from public.multiplayer_results
    union all
    select blue_guest_hash as guest_hash, blue_nickname as nickname, winner_side, 'blue' as side
      from public.multiplayer_results
  ) r
  group by r.guest_hash, r.nickname
  order by wins desc, games asc
  limit row_limit;
$$;

-- Security: anonymous users get no access. The server uses the service-role key.
alter table public.multiplayer_games enable row level security;
alter table public.multiplayer_results enable row level security;
