export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "Oliu";

/** Zalo number for support (forgotten passwords, payment questions); NEXT_PUBLIC_ZALO overrides it. */
export const ZALO_PHONE = process.env.NEXT_PUBLIC_ZALO?.replace(/\D/g, "") || "0908928517";
/** Opens a Zalo chat with that number (in the Zalo app on phones, Zalo Web on computers). */
export const ZALO_URL = `https://zalo.me/${ZALO_PHONE}`;
/** "0908 928 517" */
export const ZALO_DISPLAY = ZALO_PHONE.replace(/^(\d{4})(\d{3})(\d+)$/, "$1 $2 $3");

/** Files changed within this many days get a "Mới" badge. */
export const NEW_DAYS = 7;
