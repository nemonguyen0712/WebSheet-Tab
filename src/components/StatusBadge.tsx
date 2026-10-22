export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    paid: ["Đã thanh toán", "bg-[#dfede3] text-[#245c3b]"],
    pending: ["Chờ thanh toán", "bg-[#f5e9d3] text-[#8a5f1e]"],
    cancelled: ["Đã hủy", "bg-[#ede7d7] text-[#5e6b60]"],
    expired: ["Hết hạn", "bg-[#ede7d7] text-[#5e6b60]"],
  };
  const [label, cls] = map[status] ?? [status, ""];
  return <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}
