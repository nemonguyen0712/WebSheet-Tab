/** Helpers for /admin → Quản lý tiền: plan payments (paid orders) and donations, per month in Vietnam time. */

const VN = 7 * 3_600_000;

/** A month ("2026-11", default: this month in Vietnam) as an ISO time range, with its neighbours for paging. */
export function monthRangeVN(key?: string) {
  const now = new Date(Date.now() + VN);
  const m = /^(\d{4})-(\d{2})$/.exec(key ?? "");
  const year = m ? Number(m[1]) : now.getUTCFullYear();
  const month = m ? Number(m[2]) - 1 : now.getUTCMonth(); // 0-based
  const keyOf = (y: number, mo: number) => {
    const d = new Date(Date.UTC(y, mo, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  return {
    key: keyOf(year, month),
    label: `${String(month + 1).padStart(2, "0")}/${year}`,
    start: new Date(Date.UTC(year, month, 1) - VN).toISOString(),
    end: new Date(Date.UTC(year, month + 1, 1) - VN).toISOString(),
    prev: keyOf(year, month - 1),
    next: keyOf(year, month + 1),
    isCurrent: year === now.getUTCFullYear() && month === now.getUTCMonth(),
  };
}

/** "50000", "50.000", "50,000đ", "50k" → 50000; null if it isn't a positive amount. */
export function parseVnd(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/[\s.,đvnd]/g, "");
  const m = /^(\d+)(k|tr)?$/.exec(s);
  if (!m) return null;
  const n = Number(m[1]) * (m[2] === "k" ? 1_000 : m[2] === "tr" ? 1_000_000 : 1);
  return n > 0 && n <= 1_000_000_000 ? n : null;
}

/** A datetime-local value ("2026-11-01T20:15"), read as Vietnam time; now if empty or invalid. */
export function vnLocalToIso(input: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(input.trim());
  if (!m) return new Date().toISOString();
  const [, y, mo, d, h, mi] = m.map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi) - VN).toISOString();
}
