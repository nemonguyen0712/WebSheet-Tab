import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { startCheckout } from "@/lib/payments";
import { PLANS, formatDate, formatVnd, getPlan } from "@/lib/plans";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Đăng ký" };

async function checkout(formData: FormData) {
  "use server";
  const plan = getPlan(String(formData.get("plan")));
  const viewer = await getViewer();
  if (!viewer) redirect("/dang-nhap?next=/dang-ky");
  if (!plan) redirect("/dang-ky");
  let url: string;
  try {
    url = await startCheckout(viewer, plan);
  } catch (err) {
    console.error("checkout", err);
    redirect("/dang-ky?loi=1");
  }
  redirect(url);
}

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ loi?: string }> }) {
  const { loi } = await searchParams;
  const viewer = await getViewer();
  const monthly = PLANS[0];

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">Chọn gói</h1>
      <p className="mt-2 text-center text-muted">
        Xem toàn bộ kho sheet/tab, bài mới được cập nhật liên tục. Thanh toán bằng chuyển khoản / quét mã VietQR, kích hoạt tự động.
      </p>
      {viewer?.active && viewer.paidUntil && (
        <p className="mx-auto mt-4 max-w-md rounded-lg bg-accent-soft px-3 py-2 text-center text-sm">
          Gói của bạn còn hạn đến <b>{formatDate(viewer.paidUntil)}</b>. Mua thêm sẽ được cộng dồn.
        </p>
      )}
      {loi && (
        <p className="mx-auto mt-4 max-w-md text-center text-sm text-red-600">
          Chưa tạo được đơn thanh toán, bạn thử lại sau ít phút nhé.
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {PLANS.map((plan) => {
          const saving = Math.round((1 - plan.price / ((plan.days / monthly.days) * monthly.price)) * 100);
          const best = plan.id === "12m";
          return (
            <form
              key={plan.id}
              action={checkout}
              className={`flex flex-col rounded-2xl border bg-surface p-5 ${best ? "border-accent ring-2 ring-accent/30" : "border-border"}`}
            >
              <input type="hidden" name="plan" value={plan.id} />
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">{plan.label}</h2>
                {saving > 0 && (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">-{saving}%</span>
                )}
              </div>
              <p className="mt-3 text-3xl font-bold tracking-tight">{formatVnd(plan.price)}</p>
              <p className="mt-1 h-5 text-sm text-muted">{plan.note}</p>
              <button
                type="submit"
                className={`mt-5 h-11 rounded-xl font-medium ${
                  best ? "bg-accent text-accent-fg hover:opacity-90" : "border border-border hover:border-accent"
                }`}
              >
                {viewer ? "Thanh toán" : "Đăng nhập để mua"}
              </button>
            </form>
          );
        })}
      </div>

      <ul className="mx-auto mt-8 max-w-md space-y-1.5 text-sm text-muted">
        <li>✓ Xem toàn bộ PDF, ảnh sheet và tab Guitar Pro</li>
        <li>✓ Bài mới lên web ngay khi được cập nhật</li>
        <li>✓ Dùng trên điện thoại, máy tính bảng, máy tính (tối đa 2 thiết bị)</li>
        <li>✓ Không tự gia hạn — hết hạn thì mua tiếp khi cần</li>
      </ul>
      <p className="mt-6 text-center text-sm">
        <Link href="/" className="text-accent underline underline-offset-4">
          Xem danh sách bài
        </Link>
      </p>
    </main>
  );
}
