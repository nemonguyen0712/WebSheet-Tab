import { formatPhone } from "@/lib/account";
import { isSameSiteSubresource, verifyFileToken } from "@/lib/file-token";
import { getTab, getTabBytes } from "@/lib/source";
import { type Stamp, stampImage, stampNotation, stampPdf } from "@/lib/stamp";
import type { TabFile } from "@/lib/types";
import { recordFileView } from "@/lib/views";
import { getViewer } from "@/lib/viewer";

/** The file as sent to the viewer: with their name stamped inside it. */
async function stampedFile(tab: TabFile, stamp: Stamp): Promise<{ data: Uint8Array; type: string }> {
  const bytes = await getTabBytes(tab);
  switch (tab.kind) {
    case "pdf":
      return { data: await stampPdf(bytes, stamp), type: "application/pdf" };
    case "image":
      return stampImage(bytes, stamp);
    case "notation":
      return { data: await stampNotation(bytes, stamp), type: "application/octet-stream" };
    default:
      return { data: bytes, type: "text/plain; charset=utf-8" };
  }
}

/**
 * Full sheet/tab file — subscribers only, through a short-lived link signed for their account and
 * device, only when loaded by our own page, within an hourly limit, and stamped with their name.
 * Read from the private Drive folder by the server.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer?.active) return new Response("Cần đăng ký để xem", { status: 403 });
  if (!isSameSiteSubresource(req)) return new Response("Không được truy cập trực tiếp", { status: 403 });
  if (!verifyFileToken(id, viewer, new URL(req.url).searchParams.get("t"))) {
    return new Response("Link đã hết hạn, tải lại trang để xem tiếp", { status: 403 });
  }

  const tab = await getTab(id);
  if (!tab) return new Response("Không tìm thấy file", { status: 404 });

  if (!(await recordFileView(viewer, tab.id))) {
    return new Response("Bạn đã mở quá nhiều file trong 1 giờ, vui lòng thử lại sau.", { status: 429 });
  }

  try {
    const stamp = { text: `${viewer.username} · ${formatPhone(viewer.phone)}`, userId: viewer.id };
    const { data, type } = await stampedFile(tab, stamp);
    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": type,
        // Personal content: never store in shared caches.
        "cache-control": "private, no-store",
        "content-disposition": "inline",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (err) {
    console.error("file", tab.name, err);
    return new Response("Không tải được file", { status: 502 });
  }
}
