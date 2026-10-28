export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "Oliu";

/**
 * Zalo number for support (forgotten passwords, payment questions). The ZALO_PHONE variable overrides it, read
 * when a page is rendered, so changing it in Cloudflare takes effect without a rebuild (a NEXT_PUBLIC_ variable
 * would be baked in at build time). Server components only: client components get it as a prop.
 */
export function zalo() {
  const phone = process.env.ZALO_PHONE?.replace(/\D/g, "") || "0908928517";
  return {
    phone,
    /** Opens a Zalo chat with that number (in the Zalo app on phones, Zalo Web on computers). */
    url: `https://zalo.me/${phone}`,
    /** "0908 928 517" */
    display: phone.replace(/^(\d{4})(\d{3})(\d+)$/, "$1 $2 $3"),
  };
}

/** Files changed within this many days get a "Mới" badge. */
export const NEW_DAYS = 7;
