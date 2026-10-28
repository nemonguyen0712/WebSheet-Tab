import { createAdminClient, supabaseConfigured } from "./supabase/server";

/**
 * The Drive folders songs are read from: DRIVE_FOLDER_ID in the server's environment (one or more, comma-separated)
 * plus the ones added in /admin (table drive_folders, supabase/migrations/004_drive_folders.sql).
 */
export interface DriveFolder {
  id: string;
  label: string;
  /** "env": set on the server, edited there; "admin": added in /admin, removable there. */
  source: "env" | "admin";
}

/** A folder ID from its ID or any Drive folder URL; null if it doesn't look like one. */
export function folderIdFrom(input: string): string | null {
  const s = input.trim().replace(/["']/g, "");
  const id = /\/folders\/([\w-]+)/.exec(s)?.[1] ?? /[?&]id=([\w-]+)/.exec(s)?.[1] ?? s;
  return /^[\w-]{10,}$/.test(id) ? id : null;
}

function envFolders(): DriveFolder[] {
  return (process.env.DRIVE_FOLDER_ID ?? "")
    .split(/[,;\s]+/)
    .map(folderIdFrom)
    .filter((id): id is string => Boolean(id))
    .map((id) => ({ id, label: "", source: "env" as const }));
}

/** Kept a minute per server process (or Worker isolate); /admin clears it on changes. */
const LIST_TTL_MS = 60_000;
let cached: { expires: number; value: Promise<{ folders: DriveFolder[]; tableMissing: boolean }> } | null = null;

export function forgetDriveFolders() {
  cached = null;
}

export function listDriveFolders(): Promise<{ folders: DriveFolder[]; tableMissing: boolean }> {
  if (cached && cached.expires > Date.now()) return cached.value;
  const value = (async () => {
    const env = envFolders();
    if (!supabaseConfigured()) return { folders: env, tableMissing: false };
    const { data, error } = await createAdminClient().from("drive_folders").select("id, label").order("created_at");
    // Before the migration is run the table doesn't exist: keep going with the environment's folders.
    const added = (data ?? []).map((f) => ({ id: f.id as string, label: (f.label as string) ?? "", source: "admin" as const }));
    const seen = new Set(env.map((f) => f.id));
    return { folders: [...env, ...added.filter((f) => !seen.has(f.id))], tableMissing: Boolean(error) };
  })();
  cached = { expires: Date.now() + LIST_TTL_MS, value };
  value.catch(() => (cached = null));
  return value;
}
