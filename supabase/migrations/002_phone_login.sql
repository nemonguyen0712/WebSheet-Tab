-- Switch accounts from email (Google login) to username / phone number + password.
-- Run once in Supabase → SQL Editor if you already ran an earlier schema.sql.
alter table public.profiles drop column if exists email;
alter table public.profiles add column if not exists phone text not null unique;
alter table public.profiles add column if not exists username text not null unique
  check (username ~ '^[a-z0-9._]{3,20}$');
