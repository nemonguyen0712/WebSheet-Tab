export interface Plan {
  id: string;
  label: string;
  days: number;
  price: number;
  note?: string;
}

/** Subscription plans. Edit prices here. */
export const PLANS: Plan[] = [
  { id: "1m", label: "1 tháng", days: 30, price: 20_000 },
  { id: "3m", label: "3 tháng", days: 90, price: 49_000, note: "~16k/tháng" },
  { id: "12m", label: "12 tháng", days: 365, price: 159_000, note: "~13k/tháng" },
];

export function getPlan(id: string) {
  return PLANS.find((p) => p.id === id) ?? null;
}

export function formatVnd(n: number) {
  return `${n.toLocaleString("vi-VN")}đ`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
}
