// OpenNext adapter for Cloudflare Workers (https://opennext.js.org/cloudflare).
// No incremental cache: every page reads cookies, so nothing is prerendered or cached by Next itself;
// Drive listings are kept in memory instead (see src/lib/source.ts).
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
