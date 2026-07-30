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
  TILDA_PUBLIC_KEY: z.string().default(""),
  TILDA_SECRET_KEY: z.string().default(""),
  TILDA_API_BASE: z.string().url().default("https://store.tildaapi.com/api/getproductslist/"),
  TILDA_MODULAR_STOREPARTUID: z.string().default(""),
  TILDA_MODULAR_RECID: z.string().default(""),
  TILDA_PANEL_STOREPARTUID: z.string().default(""),
  TILDA_PANEL_RECID: z.string().default(""),
  TILDA_SITE_BASE_URL: z.string().url().default("https://avgst.ru")
});

const parsedConfig = configSchema.parse(process.env);

export const config = {
  port: parsedConfig.PORT,
  databaseUrl: parsedConfig.DATABASE_URL,
  jwtSecret: parsedConfig.JWT_SECRET,
  apiBaseUrl: parsedConfig.API_BASE_URL,
  publicApiUrl: parsedConfig.NEXT_PUBLIC_API_URL,
  adminEmail: parsedConfig.ADMIN_EMAIL,
  adminPassword: parsedConfig.ADMIN_PASSWORD,
  adminFullName: parsedConfig.ADMIN_FULL_NAME,
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
  }
};
