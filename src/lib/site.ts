export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "Oliutab";

/** Zalo number for support (forgotten passwords, payment questions); hidden when not set. */
const zalo = process.env.NEXT_PUBLIC_ZALO?.replace(/\D/g, "");
export const ZALO_URL = zalo ? `https://zalo.me/${zalo}` : null;

/** Files changed within this many days get a "Mới" badge. */
export const NEW_DAYS = 7;
