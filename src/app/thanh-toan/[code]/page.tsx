import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { bankAccount, bankQrUrl, bankTransferNote, getOrder, refreshOrder } from "@/lib/payments";
import { formatDate, formatDateTime, formatVnd, getPlan } from "@/lib/plans";
import { ZALO_URL } from "@/lib/site";
import { getViewer } from "@/lib/viewer";
import { OrderPoller } from "./OrderPoller";

export const metadata: Metadata = { title: "Thanh toán" };

export default async function PaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ huy?: string }>;
}) {
  const { code } = await params;
  const { huy } = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect(`/dang-nhap?next=/thanh-toan/${code}`);

  const found = await getOrder(Number(code));
  if (!found || found.user_id !== viewer.id) notFound();
  const order = await refreshOrder(found);
  const plan = getPlan(order.plan);
  const bank = bankAccount();
  const note = bankTransferNote(order, viewer.phone);

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <p className="text-sm text-muted">
          Đơn #{order.order_code} · tạo lúc {formatDateTime(order.created_at)}
        </p>
        <h1 className="mt-1 text-xl font-bold">
          Gói {plan?.label ?? order.plan} · {formatVnd(order.amount)}
        </h1>

        {order.status === "paid" && (
          <>
            <p className="mt-6 text-4xl">🎉</p>
            <p className="mt-2 font-semibold">Thanh toán thành công!</p>
            {viewer.paidUntil && (
              <p className="mt-1 text-muted">Bạn xem được toàn bộ kho Oliu đến {formatDate(viewer.paidUntil)}.</p>
            )}
            <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-xl bg-accent px-5 font-medium text-accent-fg">
              Vào xem bài
            </Link>
          </>
        )}

        {order.status === "cancelled" || (order.status === "pending" && huy) ? (
          <>
            <p className="mt-6 font-semibold">Đơn đã bị hủy</p>
            <Link href="/dang-ky" className="mt-4 inline-flex h-11 items-center rounded-xl border border-border px-5 hover:border-accent">
              Chọn lại gói
            </Link>
          </>
        ) : null}

        {order.status === "pending" && !huy && (
          <>
            <OrderPoller orderCode={order.order_code} />
            {order.provider === "payos" ? (
              order.checkout_url && (
                <a
                  href={order.checkout_url}
                  className="mt-6 inline-flex h-11 items-center rounded-xl bg-accent px-5 font-medium text-accent-fg"
                >
                  Mở trang thanh toán
                </a>
              )
            ) : (
              <>
                <p className="mt-4 text-sm text-muted">Quét mã bằng app ngân hàng bất kỳ (đã có sẵn số tiền và nội dung):</p>
                {/* eslint-disable-next-line @next/next/no-img-element -- VietQR card image */}
                <img
                  src={bankQrUrl(order.amount, note)}
                  alt={`Mã VietQR chuyển ${formatVnd(order.amount)}, nội dung ${note}`}
                  className="mx-auto mt-3 w-full max-w-[300px] rounded-lg border border-border bg-white p-2"
                />
                <dl className="mt-4 space-y-1 text-left text-sm">
                  <Row label="Ngân hàng" value={bank.bank} />
                  <Row label="Số tài khoản" value={bank.number} />
                  {bank.name && <Row label="Chủ tài khoản" value={bank.name} />}
                  <Row label="Số tiền" value={formatVnd(order.amount)} />
                  <Row label="Nội dung" value={note} highlight />
                </dl>
                {order.provider === "manual" ? (
                  <>
                    <p className="mt-3 text-sm text-muted">
                      Nội dung chuyển khoản là số điện thoại tài khoản của bạn, giữ nguyên để mình đối chiếu. Chuyển xong nhắn
                      Zalo cho mình, gói sẽ được kích hoạt sau khi mình kiểm tra tiền về.
                    </p>
                    <a
                      href={ZALO_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex h-11 items-center rounded-xl bg-[#0068ff] px-5 font-medium text-white hover:opacity-90"
                    >
                      Nhắn Zalo báo đã chuyển khoản
                    </a>
                  </>
                ) : (
                  <p className="mt-3 text-xs text-muted">Ghi đúng nội dung chuyển khoản để được kích hoạt tự động.</p>
                )}
              </>
            )}
            <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted">
              <span className="size-2 animate-pulse rounded-full bg-accent" />
              {order.provider === "manual"
                ? "Đang chờ xác nhận… trang sẽ tự cập nhật khi đơn được kích hoạt."
                : "Đang chờ xác nhận thanh toán… trang sẽ tự cập nhật."}
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between gap-4 rounded-lg bg-surface-2 px-3 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className={`font-mono ${highlight ? "font-bold text-accent" : ""}`}>{value}</dd>
    </div>
  );
}
