interface CloudflareEnv {
  DB: D1Database;
  MATERIALS_BUCKET: R2Bucket;
  APP_NAME: string;
  AUTH_MODE: "cloudflare-access" | "development";
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  DEV_AUTH_EMAIL?: string;
  R2_PUBLIC_BASE_URL?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
}

export {};
