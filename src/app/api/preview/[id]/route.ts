import { blurredPreview, renderPdfFirstPage, trimmedNotation } from "@/lib/preview";
import { getTab, getTabBytes } from "@/lib/source";

/**
 * Preview for visitors without a subscription — only ever contains the first third:
 * a part-blurred JPEG for PDFs/images, or a shortened Guitar Pro file for notation.
 * (Text previews are rendered directly on the song page.)
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const tab = await getTab((await params).id);
  if (!tab) return new Response("Không tìm thấy file", { status: 404 });
  const cache = { "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" };

  try {
    if (tab.kind === "pdf" || tab.kind === "image") {
      const bytes = await getTabBytes(tab);
      const jpeg = await blurredPreview(tab.kind === "pdf" ? await renderPdfFirstPage(bytes) : bytes);
      return new Response(new Uint8Array(jpeg), { headers: { "content-type": "image/jpeg", ...cache } });
    }
    if (tab.kind === "notation") {
      const gp = await trimmedNotation(await getTabBytes(tab));
      return new Response(new Uint8Array(gp), { headers: { "content-type": "application/octet-stream", ...cache } });
    }
  } catch (err) {
    console.error("preview", tab.name, err);
    return new Response("Không tạo được bản xem trước", { status: 500 });
  }
  return new Response("Không có bản xem trước", { status: 404 });
}
