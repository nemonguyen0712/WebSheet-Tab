import { isSameSiteSubresource, verifyFileToken } from "@/lib/file-token";
import { getTab, getTabBytes } from "@/lib/source";
import { getViewer } from "@/lib/viewer";

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  image: "application/octet-stream",
  notation: "application/octet-stream",
  text: "text/plain; charset=utf-8",
};

/**
 * Full sheet/tab file — subscribers only, through a short-lived link signed for their account and
 * device, and only when loaded by our own page. Read from the private Drive folder by the server.
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

  try {
    const bytes = await getTabBytes(tab);
    const type = tab.kind === "image" && tab.mimeType.startsWith("image/") ? tab.mimeType : CONTENT_TYPES[tab.kind];
    return new Response(new Uint8Array(bytes), {
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
    return new Response("Không tải được file từ Google Drive", { status: 502 });
  }
}
