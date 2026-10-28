-- Google Drive folders added from /admin (besides DRIVE_FOLDER_ID in the server's environment).
-- Songs from every folder are listed together on the site.
create table if not exists public.drive_folders (
  id text primary key,
  label text not null default '',
  created_at timestamptz not null default now()
);
alter table public.drive_folders enable row level security;
