import { formatPhone } from "@/lib/account";
import { isSameSiteSubresource, verifyFileToken } from "@/lib/file-token";
import { getTab, getTabBytes } from "@/lib/source";
import { type Stamp, stampImage, stampNotation, stampPdf } from "@/lib/stamp";
import type { TabFile } from "@/lib/types";
import { recordFileView } from "@/lib/views";
import { getViewer } from "@/lib/viewer";

/**
 * Stamping is the memory-hungry step (~15 MB for a scaled-down sheet picture), so within one server process or
 * Worker isolate (128 MB) files are stamped one at a time: viewers opening sheets together wait a moment
 * instead of adding up.
 */
let stampQueue: Promise<unknown> = Promise.resolve();
function oneAtATime<T>(task: () => Promise<T>): Promise<T> {
  const run = stampQueue.then(task, task);
  stampQueue = run.catch(() => {});
  return run;
}

function audioMimeType(tab: TabFile) {
  if (tab.ext === "mp3") return "audio/mpeg";
  if (tab.ext === "wav") return "audio/wav";
  if (tab.ext === "m4a") return "audio/mp4";
  if (tab.ext === "ogg") return "audio/ogg";
  return tab.mimeType || "audio/mpeg";
}

/** The file as sent to the viewer: with their name stamped inside it (or raw audio). */
async function stampedFile(tab: TabFile, stamp: Stamp): Promise<{ data: Uint8Array; type: string }> {
  const bytes = await getTabBytes(tab);
  if (tab.kind === "text") return { data: bytes, type: "text/plain; charset=utf-8" };
  if (tab.kind === "audio") return { data: bytes, type: audioMimeType(tab) };
  return oneAtATime(() => stampBytes(tab, bytes, stamp));
}

async function stampBytes(tab: TabFile, bytes: Uint8Array, stamp: Stamp): Promise<{ data: Uint8Array; type: string }> {
  switch (tab.kind) {
    case "pdf":
      return { data: await stampPdf(bytes, stamp), type: "application/pdf" };
    case "image":
      return stampImage(bytes, stamp, `${tab.id}@${tab.modifiedTime ?? ""}`);
    case "notation":
      return { data: await stampNotation(bytes, stamp), type: "application/octet-stream" };
    default:
      return { data: bytes, type: "text/plain; charset=utf-8" };
  }
}

/**
 * Full sheet/tab or audio file — subscribers only, through a short-lived link signed for their account and
 * device, only when loaded by our own page, within an hourly limit, and stamped with their name.
 * Read from the private Drive folder by the server. Supports HTTP Range requests for audio streaming.
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

  const rangeHeader = req.headers.get("range");
  const isRangeSeek = Boolean(rangeHeader && !rangeHeader.startsWith("bytes=0-"));
  if (!isRangeSeek && !(await recordFileView(viewer, tab.id))) {
    return new Response("Bạn đã mở quá nhiều file trong 1 giờ, vui lòng thử lại sau.", { status: 429 });
  }

  try {
    const stamp = { text: `${viewer.username} · ${formatPhone(viewer.phone)}`, userId: viewer.id };
    const { data, type } = await stampedFile(tab, stamp);

    // Support HTTP Range requests (206 Partial Content) for audio playback and seeking
    if (rangeHeader) {
      const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
      if (match) {
        const total = data.length;
        let start = match[1] ? Number(match[1]) : 0;
        let end = match[2] ? Number(match[2]) : total - 1;

        if (isNaN(start)) {
          start = total - end;
          end = total - 1;
        }

        start = Math.max(0, start);
        end = Math.min(total - 1, end);

        if (start > end || start >= total) {
          return new Response("Range Not Satisfiable", {
            status: 416,
            headers: { "content-range": `bytes */${total}` },
          });
        }

        const chunk = data.subarray(start, end + 1);
        return new Response(new Uint8Array(chunk), {
          status: 206,
          headers: {
            "content-type": type,
            "content-range": `bytes ${start}-${end}/${total}`,
            "content-length": String(chunk.length),
            "accept-ranges": "bytes",
            "cache-control": "private, no-store",
            "content-disposition": "inline",
            "x-content-type-options": "nosniff",
          },
        });
      }
    }

    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": type,
        "content-length": String(data.length),
        "accept-ranges": "bytes",
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
