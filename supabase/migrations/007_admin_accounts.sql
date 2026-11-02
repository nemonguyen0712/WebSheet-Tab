-- Admins granted from /admin → Cấp tài khoản (besides the phone numbers in ADMIN_PHONES on the server).
alter table public.profiles add column if not exists is_admin boolean not null default false;
