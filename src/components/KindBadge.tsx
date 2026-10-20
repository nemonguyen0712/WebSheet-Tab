import { KIND_LABELS } from "@/lib/kinds";
import type { TabKind } from "@/lib/types";

const STYLES: Record<TabKind, string> = {
  pdf: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  notation: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  text: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  image: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
};

/** Short names used on the song list. */
const SHORT: Record<TabKind, string> = {
  pdf: "PDF",
  notation: "GP",
  text: "Tab chữ",
  image: "Ảnh",
};

export function KindBadge({ kind, ext, count }: { kind: TabKind; ext?: string; count?: number }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STYLES[kind]}`}
      title={KIND_LABELS[kind]}
    >
      {ext || SHORT[kind]}
      {count !== undefined && count > 1 && <span className="ml-0.5 opacity-70">×{count}</span>}
    </span>
  );
}
