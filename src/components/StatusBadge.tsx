export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    paid: ["Đã thanh toán", "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"],
    pending: ["Chờ thanh toán", "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"],
    cancelled: ["Đã hủy", "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300"],
  };
  const [label, cls] = map[status] ?? [status, ""];
  return <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}
