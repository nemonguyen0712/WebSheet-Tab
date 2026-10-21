import { KIND_LABELS } from "@/lib/kinds";
import type { TabKind } from "@/lib/types";

/** Same tag colors as Nhật Anh Music's condition grades. */
const STYLES: Record<TabKind, string> = {
  pdf: "bg-[#f7e2de] text-[#8c2f20]",
  notation: "bg-[#dfede3] text-[#245c3b]",
  text: "bg-[#ede7d7] text-[#5e6b60]",
  image: "bg-[#f5e9d3] text-[#8a5f1e]",
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
