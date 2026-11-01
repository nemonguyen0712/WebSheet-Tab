"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { parseVnd, vnLocalToIso } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";

async function requireAdmin() {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) notFound();
}

/** Records a donation seen in the bank app (transfer note UNG HO OLIU). */
export async function addDonation(formData: FormData) {
  await requireAdmin();
  const amount = parseVnd(String(formData.get("amount") ?? ""));
  const month = String(formData.get("month") ?? "");
  const back = `/admin?thang=${encodeURIComponent(month)}`;
  if (!amount) redirect(`${back}&tien=sai#tien`);
  const { error } = await createAdminClient()
    .from("donations")
    .insert({
      amount,
      donor: String(formData.get("donor") ?? "").trim().slice(0, 80),
      note: String(formData.get("note") ?? "").trim().slice(0, 200),
      received_at: vnLocalToIso(String(formData.get("received_at") ?? "")),
    });
  revalidatePath("/admin");
  redirect(`${back}&tien=${error ? "loi" : "ok"}#tien`);
}

export async function removeDonation(formData: FormData) {
  await requireAdmin();
  await createAdminClient().from("donations").delete().eq("id", Number(formData.get("id")));
  revalidatePath("/admin");
  redirect(`/admin?thang=${encodeURIComponent(String(formData.get("month") ?? ""))}&tien=xoa#tien`);
}
