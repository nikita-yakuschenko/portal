import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

const thisDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(thisDir, "../../..");
loadDotenv({ path: resolve(repoRoot, ".env") });
loadDotenv({ path: resolve(process.cwd(), ".env"), override: false });

const configSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1).default("postgresql://postgres:postgres@localhost:5436/b2b_portal"),
  JWT_SECRET: z.string().min(8).default("change-me-secret"),
  API_BASE_URL: z.string().url().default("http://localhost:4000"),
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:4000"),
  ADMIN_EMAIL: z.email().default("admin@avgst.local"),
  ADMIN_PASSWORD: z.string().min(8).default("ChangeMe123!"),
  ADMIN_FULL_NAME: z.string().min(2).default("AVGST Admin"),
  /** Общий дилерский вход на время переезда с Tilda: один логин на всех */
  DEALER_EMAIL: z.email().default("dealer@avgst.ru"),
  DEALER_PASSWORD: z.string().min(8).default("avgst_dealer_25"),
  PARTNER_EMAIL: z.email().default("partner@avgst.local"),
  PARTNER_PASSWORD: z.string().min(8).default("ChangeMe123!"),
  PARTNER_FULL_NAME: z.string().min(2).default("Демо Партнёр"),
  PARTNER_COMPANY_NAME: z.string().min(2).default("Демо Дилер"),
  PARTNER_REGION: z.string().min(2).default("Нижний Новгород"),
  TILDA_PUBLIC_KEY: z.string().default(""),
  TILDA_SECRET_KEY: z.string().default(""),
  TILDA_API_BASE: z.string().url().default("https://store.tildaapi.com/api/getproductslist/"),
  TILDA_MODULAR_STOREPARTUID: z.string().default(""),
  TILDA_MODULAR_RECID: z.string().default(""),
  TILDA_PANEL_STOREPARTUID: z.string().default(""),
  TILDA_PANEL_RECID: z.string().default(""),
  TILDA_SITE_BASE_URL: z.string().url().default("https://avgst.ru"),
  // Снимки публичных профилей соцсетей: TTL и лимиты outbound-запросов
  SOCIAL_PROFILE_TTL_MINUTES: z.coerce.number().int().positive().default(20),
  SOCIAL_FETCH_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  SOCIAL_MEDIA_MAX_BYTES: z.coerce.number().int().positive().default(8 * 1024 * 1024),
  // auto — пробуем Meta API, затем collector; off — Instagram отключён
  INSTAGRAM_PROVIDER: z.enum(["auto", "off"]).default("auto"),
  META_APP_ID: z.string().default(""),
  META_APP_SECRET: z.string().default(""),
  META_ACCESS_TOKEN: z.string().default(""),
  META_IG_BUSINESS_ID: z.string().default(""),
  INSTAGRAM_COLLECTOR_URL: z.string().default(""),
  INSTAGRAM_COLLECTOR_TOKEN: z.string().default("")
});

// Dokploy часто прокидывает пустые строки вместо отсутствия ключа —
// Zod .default() тогда не срабатывает. Пустое → undefined.
const envForParse = Object.fromEntries(
  Object.entries(process.env).map(([key, value]) => [key, value === "" ? undefined : value])
);
const parsedConfig = configSchema.parse(envForParse);

export const config = {
  port: parsedConfig.PORT,
  databaseUrl: parsedConfig.DATABASE_URL,
  jwtSecret: parsedConfig.JWT_SECRET,
  apiBaseUrl: parsedConfig.API_BASE_URL,
  publicApiUrl: parsedConfig.NEXT_PUBLIC_API_URL,
  adminEmail: parsedConfig.ADMIN_EMAIL,
  adminPassword: parsedConfig.ADMIN_PASSWORD,
  adminFullName: parsedConfig.ADMIN_FULL_NAME,
  dealerEmail: parsedConfig.DEALER_EMAIL,
  dealerPassword: parsedConfig.DEALER_PASSWORD,
  partnerEmail: parsedConfig.PARTNER_EMAIL,
  partnerPassword: parsedConfig.PARTNER_PASSWORD,
  partnerFullName: parsedConfig.PARTNER_FULL_NAME,
  partnerCompanyName: parsedConfig.PARTNER_COMPANY_NAME,
  partnerRegion: parsedConfig.PARTNER_REGION,
  tilda: {
    publicKey: parsedConfig.TILDA_PUBLIC_KEY,
    secretKey: parsedConfig.TILDA_SECRET_KEY,
    apiBase: parsedConfig.TILDA_API_BASE,
    siteBaseUrl: parsedConfig.TILDA_SITE_BASE_URL,
    sources: [
      {
        key: "modular",
        storepartuid: parsedConfig.TILDA_MODULAR_STOREPARTUID,
        recid: parsedConfig.TILDA_MODULAR_RECID,
        catalogPath: "/catalog/modulnye-doma"
      },
      {
        key: "panel",
        storepartuid: parsedConfig.TILDA_PANEL_STOREPARTUID,
        recid: parsedConfig.TILDA_PANEL_RECID,
        catalogPath: "/catalog/panelno-karkasnye-doma"
      }
    ].filter((source) => source.storepartuid && source.recid)
  },
  social: {
    profileTtlMinutes: parsedConfig.SOCIAL_PROFILE_TTL_MINUTES,
    fetchTimeoutMs: parsedConfig.SOCIAL_FETCH_TIMEOUT_MS,
    mediaMaxBytes: parsedConfig.SOCIAL_MEDIA_MAX_BYTES,
    instagram: {
      provider: parsedConfig.INSTAGRAM_PROVIDER,
      metaAppId: parsedConfig.META_APP_ID,
      metaAppSecret: parsedConfig.META_APP_SECRET,
      metaAccessToken: parsedConfig.META_ACCESS_TOKEN,
      metaBusinessId: parsedConfig.META_IG_BUSINESS_ID,
      collectorUrl: parsedConfig.INSTAGRAM_COLLECTOR_URL,
      collectorToken: parsedConfig.INSTAGRAM_COLLECTOR_TOKEN
    }
  }
};
