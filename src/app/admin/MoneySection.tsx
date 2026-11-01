import Link from "next/link";
import { ConfirmButton } from "@/components/ConfirmButton";
import { DONATE_NOTE } from "@/components/Donate";
import { monthRangeVN } from "@/lib/money";
import { formatDateTime, formatVnd } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/server";
import { addDonation, removeDonation } from "./money-actions";

const MESSAGES: Record<string, string> = {
  ok: "Đã ghi khoản ủng hộ.",
  xoa: "Đã xoá khoản ủng hộ.",
  sai: "Số tiền không đúng: nhập như 50000, 50.000 hoặc 50k.",
  loi: "Chưa lưu được. Đã chạy supabase/migrations/006_donations.sql trong Supabase chưa?",
};

interface Entry {
  key: string;
  kind: "plan" | "donation";
  amount: number;
  at: string;
  who: string;
  detail: string;
  donationId?: number;
}

/**
 * Quản lý tiền: one month's money in, split into plan payments (paid orders, recorded when an order is confirmed)
 * and donations (recorded here by hand, since they go straight to the bank account).
 */
export async function MoneySection({ month, message }: { month?: string; message?: string }) {
  const range = monthRangeVN(month);
  const admin = createAdminClient();
  const [orders, donations] = await Promise.all([
    admin
      .from("orders")
      .select("order_code, amount, paid_at, profiles(username)")
      .eq("status", "paid")
      .gte("paid_at", range.start)
      .lt("paid_at", range.end)
      .order("paid_at", { ascending: false }),
    admin
      .from("donations")
      .select("id, amount, donor, note, received_at")
      .gte("received_at", range.start)
      .lt("received_at", range.end)
      .order("received_at", { ascending: false }),
  ]);
  const tableMissing = Boolean(donations.error);

  const entries: Entry[] = [
    ...(orders.data ?? []).map((o) => ({
      key: `o${o.order_code}`,
      kind: "plan" as const,
      amount: o.amount as number,
      at: o.paid_at as string,
      who: (o.profiles as unknown as { username: string } | null)?.username ?? "?",
      detail: `Đơn #${o.order_code}`,
    })),
    ...(donations.data ?? []).map((d) => ({
      key: `d${d.id}`,
      kind: "donation" as const,
      amount: d.amount as number,
      at: d.received_at as string,
      who: (d.donor as string) || "Ẩn danh",
      detail: d.note as string,
      donationId: d.id as number,
    })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  const plans = entries.filter((e) => e.kind === "plan").reduce((s, e) => s + e.amount, 0);
  const gifts = entries.filter((e) => e.kind === "donation").reduce((s, e) => s + e.amount, 0);

  return (
    <section id="tien" className="scroll-mt-20 rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Quản lý tiền · tháng {range.label}</h2>
        <nav className="flex items-center gap-1 text-sm">
          <Link href={`/admin?thang=${range.prev}#tien`} className="rounded-md border border-border px-2 py-1 hover:border-accent">
            ← Tháng trước
          </Link>
          {!range.isCurrent && (
            <Link href={`/admin?thang=${range.next}#tien`} className="rounded-md border border-border px-2 py-1 hover:border-accent">
              Tháng sau →
            </Link>
          )}
        </nav>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Total label="Mua gói" value={plans} count={entries.filter((e) => e.kind === "plan").length} tone="bg-[#dfede3] text-[#245c3b]" />
        <Total label="Ủng hộ" value={gifts} count={entries.filter((e) => e.kind === "donation").length} tone="bg-[#fbe9d6] text-[#8a4b12]" />
        <Total label="Tổng tiền vào" value={plans + gifts} count={entries.length} tone="bg-surface-2 text-fg" />
      </div>

      {message && MESSAGES[message] && <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-sm">{MESSAGES[message]}</p>}
      {tableMissing && (
        <p className="mt-3 rounded-lg bg-[#fbe7e4] px-3 py-2 text-sm text-[#8a2d22]">
          Chưa tạo bảng ủng hộ: mở Supabase → SQL Editor, chạy file <code>supabase/migrations/006_donations.sql</code>.
        </p>
      )}

      <details className="mt-3 rounded-xl border border-border p-3 text-sm" open={!entries.some((e) => e.kind === "donation")}>
        <summary className="cursor-pointer font-medium">+ Ghi khoản ủng hộ</summary>
        <p className="mt-1 text-xs text-muted">
          Thấy trong app ngân hàng một khoản nội dung “{DONATE_NOTE}” thì ghi vào đây. Tiền mua gói không cần ghi: đơn đã xác nhận được
          tính tự động.
        </p>
        <form action={addDonation} className="mt-2 grid gap-2 sm:grid-cols-[8rem_1fr_1fr_11rem_auto]">
          <input type="hidden" name="month" value={range.key} />
          <input name="amount" required placeholder="Số tiền (50k)" inputMode="numeric" autoComplete="off" className={input} />
          <input name="donor" placeholder="Người ủng hộ (không bắt buộc)" maxLength={80} autoComplete="off" className={input} />
          <input name="note" placeholder="Ghi chú (không bắt buộc)" maxLength={200} autoComplete="off" className={input} />
          <input name="received_at" type="datetime-local" title="Thời gian nhận (để trống = bây giờ)" className={input} />
          <button className="h-9 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:bg-deep">Lưu</button>
        </form>
      </details>

      {entries.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-2 font-normal">Thời gian</th>
                <th className="py-2 font-normal">Loại</th>
                <th className="py-2 font-normal">Từ</th>
                <th className="py-2 font-normal">Ghi chú</th>
                <th className="py-2 text-right font-normal">Số tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((e) => (
                <tr key={e.key}>
                  <td className="py-2 tabular-nums text-muted">{formatDateTime(e.at)}</td>
                  <td className="py-2">
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${
                        e.kind === "plan" ? "bg-[#dfede3] text-[#245c3b]" : "bg-[#fbe9d6] text-[#8a4b12]"
                      }`}
                    >
                      {e.kind === "plan" ? "Mua gói" : "Ủng hộ"}
                    </span>
                  </td>
                  <td className="py-2">{e.who}</td>
                  <td className="py-2 text-muted">{e.detail}</td>
                  <td className="py-2 text-right tabular-nums font-medium">
                    {formatVnd(e.amount)}
                    {e.donationId && (
                      <form action={removeDonation} className="inline">
                        <input type="hidden" name="id" value={e.donationId} />
                        <input type="hidden" name="month" value={range.key} />
                        <ConfirmButton
                          message={`Xoá khoản ủng hộ ${formatVnd(e.amount)} của ${e.who}?`}
                          className="ml-2 text-xs font-normal text-muted underline underline-offset-2 hover:text-[#b33a28]"
                        >
                          Xoá
                        </ConfirmButton>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">Tháng này chưa có khoản tiền nào.</p>
      )}
    </section>
  );
}

const input = "h-9 min-w-0 rounded-lg border border-border bg-bg px-3 text-sm";

function Total({ label, value, count, tone }: { label: string; value: number; count: number; tone: string }) {
  return (
    <div className={`rounded-xl p-3 ${tone}`}>
      <p className="text-xs opacity-80">
        {label} · {count} khoản
      </p>
      <p className="mt-0.5 text-xl font-bold tracking-tight">{formatVnd(value)}</p>
    </div>
  );
}
