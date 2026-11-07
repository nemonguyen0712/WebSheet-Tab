import { ConfirmButton } from "@/components/ConfirmButton";
import { DEFAULT_PAUSE_MESSAGE, getPaymentPause } from "@/lib/payment-pause";
import { formatDateTime } from "@/lib/plans";
import { togglePaymentPause } from "./pause-actions";

const MESSAGES: Record<string, string> = {
  bat: "Đã bật: khách thấy cảnh báo và không tạo đơn mới được (máy chủ ở nơi khác có thể chậm khoảng 1 phút).",
  tat: "Đã tắt: thanh toán hoạt động lại bình thường.",
  loi: "Chưa lưu được: không kết nối được bộ nhớ Cloudflare KV (binding CACHE).",
};

/** /admin → Thanh toán: the "bank is down" switch. */
export async function PauseSection({ status }: { status?: string }) {
  const pause = await getPaymentPause();
  return (
    <section
      id="thanh-toan"
      className={`scroll-mt-20 rounded-2xl border p-5 ${pause ? "border-[#e3a59d] bg-[#fdecea]" : "border-border bg-surface"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">
          Thanh toán:{" "}
          {pause ? (
            <span className="text-[#b33a28]">ĐANG TẠM NGƯNG (ngân hàng lỗi)</span>
          ) : (
            <span className="text-[#2f7a50]">hoạt động bình thường</span>
          )}
        </h2>
        {pause && <span className="text-xs text-muted">Bật lúc {formatDateTime(pause.since)}</span>}
      </div>
      {status && MESSAGES[status] && <p className="mt-2 rounded-lg bg-white/60 px-3 py-2 text-sm">{MESSAGES[status]}</p>}

      <form action={togglePaymentPause} className="mt-3 space-y-2">
        {pause ? (
          <>
            <input type="hidden" name="on" value="0" />
            <p className="text-sm">
              Khách đang thấy: <i>“{pause.message}”</i>
            </p>
            <button className="h-10 rounded-lg bg-[#2f7a50] px-4 text-sm font-semibold text-white hover:opacity-90">
              Ngân hàng ổn rồi: mở lại thanh toán
            </button>
          </>
        ) : (
          <>
            <input type="hidden" name="on" value="1" />
            <p className="text-sm text-muted">
              Khi ngân hàng lỗi: bật lên để mọi trang hiện cảnh báo đỏ, nút mua gói bị khoá, mã QR thanh toán và ủng hộ báo khách chưa
              nên chuyển khoản. Gói khách đã mua vẫn dùng bình thường.
            </p>
            <textarea
              name="message"
              rows={2}
              maxLength={400}
              defaultValue={DEFAULT_PAUSE_MESSAGE}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
            />
            <ConfirmButton
              message="Bật tạm ngưng thanh toán? Khách sẽ thấy cảnh báo và không mua gói được cho tới khi bạn tắt."
              className="h-10 rounded-lg bg-[#b33a28] px-4 text-sm font-semibold text-white hover:opacity-90"
            >
              Ngân hàng đang lỗi: tạm ngưng thanh toán
            </ConfirmButton>
          </>
        )}
      </form>
    </section>
  );
}
