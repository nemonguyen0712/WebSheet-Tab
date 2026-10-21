import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPendingOrder, paymentProvider, startCheckout } from "@/lib/payments";
import { PLANS, formatDate, formatDateTime, formatVnd, getPlan } from "@/lib/plans";
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
  const plan = PLANS[0];
  const pending = viewer ? await getPendingOrder(viewer.id) : null;

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <div className="rounded-lg bg-surface/85 px-4 py-4 text-center backdrop-blur-sm">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Đăng ký</h1>
        <p className="mt-2 text-muted">Xem toàn bộ kho Oliu, bài mới được cập nhật liên tục.</p>
      </div>
      {viewer?.active && viewer.paidUntil && (
        <p className="mt-4 rounded-lg bg-accent-soft px-3 py-2 text-center text-sm">
          Gói của bạn còn hạn đến <b>{formatDate(viewer.paidUntil)}</b>. Gia hạn thì 30 ngày mới được cộng nối tiếp vào hạn hiện tại.
        </p>
      )}
      {pending && (
        <p className="mt-4 rounded-lg bg-accent-soft px-3 py-2 text-center text-sm">
          Bạn có đơn <b>#{pending.order_code}</b> tạo lúc {formatDateTime(pending.created_at)} đang chờ thanh toán. Bấm nút bên
          dưới để mở lại đơn đó, không tạo đơn mới.
        </p>
      )}
      {loi && (
        <p className="mt-4 text-center text-sm text-red-600">Chưa tạo được đơn thanh toán, bạn thử lại sau ít phút nhé.</p>
      )}

      <form action={checkout} className="mt-8 rounded-2xl border border-accent bg-surface p-6 text-center ring-2 ring-accent/30">
        <input type="hidden" name="plan" value={plan.id} />
        <p className="text-4xl font-bold tracking-tight">
          {formatVnd(plan.price)}
          <span className="text-base font-normal text-muted"> / {plan.days} ngày</span>
        </p>
        <ul className="mx-auto mt-5 max-w-xs space-y-1.5 text-left text-sm text-muted">
          <li>✓ Xem toàn bộ PDF, ảnh sheet và tab Guitar Pro</li>
          <li>✓ Bài mới lên web ngay khi được cập nhật</li>
          <li>✓ Dùng trên 1 thiết bị (điện thoại, máy tính bảng hoặc máy tính)</li>
          <li>✓ Không tự gia hạn — hết hạn thì mua tiếp khi cần</li>
        </ul>
        <button type="submit" className="mt-6 h-12 w-full rounded-xl bg-accent font-medium text-accent-fg hover:opacity-90">
          {!viewer ? "Đăng nhập để mua" : pending ? "Tiếp tục thanh toán" : viewer.active ? "Gia hạn bằng VietQR" : "Thanh toán bằng VietQR"}
        </button>
        <p className="mt-3 text-xs text-muted">
          {paymentProvider() === "manual"
            ? "Quét mã bằng app ngân hàng bất kỳ, gói được kích hoạt sau khi mình kiểm tra tiền về."
            : "Quét mã bằng app ngân hàng bất kỳ, kích hoạt tự động sau khi chuyển khoản."}
        </p>
      </form>

      <p className="mt-6 text-center text-sm">
        <Link href="/" className="rounded-lg bg-surface/85 px-3 py-1.5 text-accent underline underline-offset-4 backdrop-blur-sm">
          Xem danh sách bài
        </Link>
      </p>
    </main>
  );
}
