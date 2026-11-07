"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { DEFAULT_PAUSE_MESSAGE, setPaymentPause } from "@/lib/payment-pause";
import { getViewer } from "@/lib/viewer";

/** /admin → Thanh toán: switch the bank-trouble pause on (with a message) or off. */
export async function togglePaymentPause(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) notFound();
  const on = formData.get("on") === "1";
  const message = String(formData.get("message") ?? "").trim().slice(0, 400) || DEFAULT_PAUSE_MESSAGE;
  const saved = await setPaymentPause(on ? { message, since: new Date().toISOString() } : null);
  revalidatePath("/", "layout");
  redirect(`/admin?tamdung=${saved ? (on ? "bat" : "tat") : "loi"}#thanh-toan`);
}
