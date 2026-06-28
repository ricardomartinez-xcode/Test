import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * PSCV Room is primarily dynamic. No incremental cache is enabled until the
 * D1/R2 parity suite is complete, avoiding stale academic data during cutover.
 */
export default defineCloudflareConfig({});
