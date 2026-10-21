export interface Plan {
  id: string;
  label: string;
  days: number;
  price: number;
}

/** Subscription plans. Edit the price here. */
export const PLANS: Plan[] = [{ id: "1m", label: "1 tháng", days: 30, price: 20_000 }];

export function getPlan(id: string) {
  return PLANS.find((p) => p.id === id) ?? null;
}

export function formatVnd(n: number) {
  return `${n.toLocaleString("vi-VN")}đ`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
}
