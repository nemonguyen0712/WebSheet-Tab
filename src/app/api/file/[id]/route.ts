import { getTab, getTabBytes } from "@/lib/source";
import { getViewer } from "@/lib/viewer";

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  image: "application/octet-stream",
  notation: "application/octet-stream",
  text: "text/plain; charset=utf-8",
};

/** Full sheet/tab file — subscribers only. Read from the private Drive folder by the server. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer?.active) return new Response("Cần đăng ký để xem", { status: 403 });

  const tab = await getTab((await params).id);
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
