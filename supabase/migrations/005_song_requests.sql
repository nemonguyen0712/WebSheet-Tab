-- Songs customers ask to be added (page /yeu-cau, handled in /admin). A few per calendar month per account;
-- a rejected request doesn't count, so the customer gets that request back.
create table if not exists public.song_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  section text not null default '' check (section in ('', 'solo', 'melody')),
  detail text not null default '',
  status text not null default 'pending' check (status in ('pending', 'done', 'rejected')),
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists song_requests_user_idx on public.song_requests (user_id, created_at desc);
create index if not exists song_requests_status_idx on public.song_requests (status, created_at);
alter table public.song_requests enable row level security;
