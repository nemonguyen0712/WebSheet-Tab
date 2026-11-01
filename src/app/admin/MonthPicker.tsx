"use client";

import { useRouter } from "next/navigation";

/** Months to choose from ("2026-11"), newest first; picking one reloads Quản lý tiền for it. */
export function MonthPicker({ months, value }: { months: string[]; value: string }) {
  const router = useRouter();
  const years = [...new Set(months.map((m) => m.slice(0, 4)))];
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-muted">Xem tháng</span>
      <select
        value={value}
        onChange={(e) => router.push(`/admin?thang=${e.target.value}#tien`, { scroll: false })}
        className="h-9 rounded-lg border border-border bg-bg px-2 text-sm"
      >
        {years.map((y) => (
          <optgroup key={y} label={`Năm ${y}`}>
            {months
              .filter((m) => m.startsWith(y))
              .map((m) => (
                <option key={m} value={m}>
                  Tháng {m.slice(5)}/{y}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
