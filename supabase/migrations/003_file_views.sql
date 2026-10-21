-- Log of full-file views: rate limiting per account and spotting accounts that download in bulk.
-- Run once in Supabase → SQL Editor.
create table if not exists public.file_views (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  file_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists file_views_user_idx on public.file_views (user_id, created_at desc);
create index if not exists file_views_time_idx on public.file_views (created_at desc);
alter table public.file_views enable row level security;

-- Admin page: who viewed the most since a given time.
create or replace function public.file_view_stats(p_since timestamptz)
returns table (user_id uuid, username text, phone text, views bigint, files bigint)
language sql
security definer
set search_path = public
as $$
  select v.user_id, p.username, p.phone, count(*), count(distinct v.file_id)
    from public.file_views v
    join public.profiles p on p.id = v.user_id
   where v.created_at >= p_since
   group by v.user_id, p.username, p.phone
   order by count(distinct v.file_id) desc
   limit 20;
$$;
revoke all on function public.file_view_stats(timestamptz) from public, anon, authenticated;
grant execute on function public.file_view_stats(timestamptz) to service_role;
