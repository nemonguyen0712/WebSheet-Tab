-- Donations ("Ủng hộ Oliu", transfer note UNG HO OLIU). They go straight to the bank account, so the admin
-- records them in /admin → Quản lý tiền, next to plan payments (paid orders).
create table if not exists public.donations (
  id bigint generated always as identity primary key,
  amount int not null check (amount > 0),
  donor text not null default '',
  note text not null default '',
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists donations_time_idx on public.donations (received_at desc);
alter table public.donations enable row level security;
