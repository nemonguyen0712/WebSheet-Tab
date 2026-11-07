import { getPaymentPause } from "@/lib/payment-pause";

/** Red warning under the header on every page while payments are paused (/admin → Thanh toán). */
export async function PaymentPauseBanner() {
  const pause = await getPaymentPause();
  if (!pause) return null;
  return <PauseNotice message={pause.message} className="rounded-none border-x-0 border-t-0 px-4" />;
}

/** The same warning as a box, for the plan, payment and donation views. */
export function PauseNotice({ message, className = "" }: { message: string; className?: string }) {
  return (
    <div role="alert" className={`flex gap-2.5 rounded-lg border border-[#e3a59d] bg-[#fdecea] px-3 py-2.5 text-sm text-[#7a2419] ${className}`}>
      <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 3 2 20h20L12 3z" strokeLinejoin="round" />
        <path d="M12 10v4M12 17h.01" strokeLinecap="round" />
      </svg>
      <p className="mx-auto max-w-5xl flex-1">
        <b>Tạm ngưng thanh toán.</b> {message}
      </p>
    </div>
  );
}
