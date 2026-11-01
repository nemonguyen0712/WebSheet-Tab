import { bankAccount, bankQrUrl } from "@/lib/payments";
import { DonateDialog } from "./DonateDialog";

/** What a donation's transfer says; banks drop accents, so it is written without. */
export const DONATE_NOTE = "UNG HO OLIU";
const AMOUNTS = [10_000, 20_000, 50_000, 100_000, null];

/**
 * "Ủng hộ Oliu": a floating button on every page (but the plan and payment pages, so its QR can't be mistaken
 * for a plan payment) that opens a VietQR for the same bank account, with a few amounts or "tuỳ tâm".
 * Any link to #ung-ho (the footer has one) opens it too.
 */
export function Donate() {
  const bank = bankAccount();
  return (
    <DonateDialog
      note={DONATE_NOTE}
      bank={{ bank: bank.bank, number: bank.number, name: bank.name }}
      options={AMOUNTS.map((amount) => ({ amount, qr: bankQrUrl(amount, DONATE_NOTE) }))}
    />
  );
}
