import type { Viewer } from "./viewer";

/** /dang-ky shows "you haven't got a plan" above the plan card when opened with this. */
export const LOCKED_PLAN_PAGE = "/dang-ky?khoa=1";

/**
 * Sheets are for paying accounts only (no previews). Where to send anyone else instead of `returnTo`:
 * an account signed in on another device logs in again here; everyone else goes to the plan page.
 * null: the viewer may open it.
 */
export function lockedRedirect(viewer: Viewer | null, returnTo: string): string | null {
  if (viewer?.active) return null;
  if (viewer && !viewer.deviceOk) return `/dang-nhap?next=${encodeURIComponent(returnTo)}`;
  return LOCKED_PLAN_PAGE;
}
