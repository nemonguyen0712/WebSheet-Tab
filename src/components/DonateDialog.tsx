"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Pages where a second QR would be confused with paying for a plan, the one-screen login page (no room) and /admin. */
const HIDDEN_ON = [/^\/dang-ky/, /^\/thanh-toan/, /^\/dang-nhap/, /^\/admin/];
const HASH = "#ung-ho";

function vnd(n: number) {
  return `${n.toLocaleString("vi-VN")}đ`;
}

export function DonateDialog({
  note,
  bank,
  options,
  pauseMessage,
}: {
  /** Set while payments are paused (bank trouble): the dialog says not to transfer now. */
  pauseMessage: string | null;
  note: string;
  bank: { bank: string; number: string; name: string };
  options: { amount: number | null; qr: string }[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState(1); // 20.000đ
  const closeButton = useRef<HTMLButtonElement>(null);

  // A link to #ung-ho anywhere (footer) opens the dialog, on load or on click.
  useEffect(() => {
    const sync = () => window.location.hash === HASH && setOpen(true);
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function close() {
    setOpen(false);
    if (window.location.hash === HASH) history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  if (HIDDEN_ON.some((re) => re.test(pathname))) return null;
  const option = options[pick];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 inline-flex h-11 items-center gap-2 rounded-full border border-[#c9a464]/60 bg-[#14231a] pr-4 pl-3 text-sm font-semibold text-[#f0d9a8] shadow-lg transition hover:-translate-y-0.5 hover:bg-[#1c3324]"
        aria-haspopup="dialog"
      >
        <svg viewBox="0 0 24 24" className="size-5 text-[#e2a06a]" fill="currentColor" aria-hidden>
          <path d="M12 21s-7.5-4.6-9.6-9.2C1 8.6 3 5 6.5 5c2 0 3.6 1.1 4.5 2.6C11.9 6.1 13.5 5 15.5 5 19 5 21 8.6 19.6 11.8 17.5 16.4 12 21 12 21z" />
        </svg>
        Ủng hộ Oliu
      </button>

      {open && (
        // Centered when it fits; on a short screen the overlay scrolls instead of cutting the top off.
        <div className="notice-popup fixed inset-0 z-50 overflow-y-auto bg-black/55 backdrop-blur-sm">
          <div className="flex min-h-full items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && close()}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="donate-title"
            className="notice-card w-full max-w-sm rounded-2xl border border-[#c9a464]/50 bg-[#14231a] p-4 text-center text-[#f1e6cc] shadow-2xl sm:p-5"
          >
            <h2 id="donate-title" className="font-display text-2xl font-bold text-[#e2c58f]">
              Ủng hộ Oliu
            </h2>
            <p className="mt-1 text-xs text-[#b9aa8a]">Cảm ơn bạn đã tiếp thêm động lực để Oliu soạn thêm nhiều tab/sheet!</p>

            {pauseMessage && (
              <p role="status" className="mt-3 rounded-lg border border-[#c9a464]/50 bg-[#c9a464]/15 px-3 py-2 text-left text-xs text-[#f0d9a8]">
                <b>Tạm dừng nhận thanh toán.</b> {pauseMessage}
              </p>
            )}
            <div className="mt-3 grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Số tiền">
              {options.map((o, i) => (
                <button
                  key={o.amount ?? "free"}
                  type="button"
                  role="radio"
                  aria-checked={i === pick}
                  onClick={() => setPick(i)}
                  className={`h-9 rounded-lg text-xs font-semibold ${
                    i === pick ? "bg-[#c9a464] text-[#17130c]" : "bg-black/25 text-[#e9d9b4] hover:bg-black/40"
                  }`}
                >
                  {o.amount ? `${o.amount / 1000}k` : "Tuỳ tâm"}
                </button>
              ))}
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element -- VietQR card image */}
            <img
              key={option.qr}
              src={option.qr}
              alt={`Mã VietQR ủng hộ Oliu${option.amount ? ` ${vnd(option.amount)}` : ""}, nội dung ${note}`}
              className="mx-auto mt-3 w-full max-w-[200px] rounded-lg bg-white p-1.5"
            />
            <dl className="mt-3 space-y-1 text-left text-xs">
              <Row label="Ngân hàng" value={bank.bank} />
              <Row label="Số tài khoản" value={bank.number} />
              <Row label="Chủ tài khoản" value={bank.name} />
              <Row label="Số tiền" value={option.amount ? vnd(option.amount) : "Tuỳ tâm (nhập trong app)"} />
              <Row label="Nội dung" value={note} />
            </dl>

            <div className="mt-3 rounded-xl border border-[#c9a464]/30 bg-[#c9a464]/10 px-3 py-2.5 text-sm leading-relaxed text-[#f0d9a8]">
              <p className="font-semibold">💛 Oliu xin chân thành cảm ơn bạn!</p>
              <p className="mt-0.5 text-xs text-[#d8c9a6]">
                Mỗi khoản ủng hộ, dù nhỏ, đều giúp Oliu duy trì máy chủ và ra thêm tab/sheet mới mỗi tuần. Chúc bạn tập đàn thật vui!
              </p>
            </div>

            <button
              ref={closeButton}
              type="button"
              onClick={close}
              className="mt-3 h-10 w-full rounded-xl border border-[#c9a464]/50 text-sm font-semibold text-[#e2c58f] hover:bg-black/25"
            >
              Đóng
            </button>
          </div>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 rounded-lg bg-black/25 px-3 py-1">
      <dt className="text-[#b9aa8a]">{label}</dt>
      <dd className="font-mono text-[#f1e6cc]">{value}</dd>
    </div>
  );
}
