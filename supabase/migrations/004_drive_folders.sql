-- Google Drive folders added from /admin (besides DRIVE_FOLDER_ID in the server's environment).
-- Songs from every folder are listed together on the site.
-- section: 'solo' / 'melody' when the whole folder is that section; null when its subfolders named
-- Solo / Melody tell them apart.
create table if not exists public.drive_folders (
  id text primary key,
  label text not null default '',
  section text check (section in ('solo', 'melody')),
  created_at timestamptz not null default now()
);
-- For a table created before the section column existed.
alter table public.drive_folders add column if not exists section text check (section in ('solo', 'melody'));
alter table public.drive_folders enable row level security;
