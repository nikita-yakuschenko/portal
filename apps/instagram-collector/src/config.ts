import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

const thisDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(thisDir, "../../..");
loadDotenv({ path: resolve(repoRoot, ".env") });
loadDotenv({ path: resolve(process.cwd(), ".env"), override: false });

const schema = z.object({
  COLLECTOR_PORT: z.coerce.number().default(4100),
  COLLECTOR_HOST: z.string().default("0.0.0.0"),
  /** Тот же токен, что INSTAGRAM_COLLECTOR_TOKEN у API. Пустой — сервис не стартует */
  INSTAGRAM_COLLECTOR_TOKEN: z.string().default(""),
  /** Одновременных браузерных сборов: Chromium прожорлив, 1–2 — рабочий предел */
  COLLECTOR_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(1),
  COLLECTOR_NAV_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),
  COLLECTOR_CONTENT_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  /** Путь к storageState служебного аккаунта. Секрет: в образ и в git не кладётся */
  COLLECTOR_STORAGE_STATE: z.string().default(""),
  /** Куда складывать скриншот и trace неудачного сбора */
  COLLECTOR_TRACE_DIR: z.string().default("/tmp/collector-traces"),
  COLLECTOR_TRACE_TTL_MINUTES: z.coerce.number().int().positive().default(60),
  /**
   * Исходящий прокси для Chromium. Нужен там, где сам instagram.com
   * недоступен из сети сервера — это вопрос маршрутизации, а не обхода
   * защиты Instagram.
   */
  COLLECTOR_PROXY_URL: z.string().default(""),
  COLLECTOR_PROXY_USERNAME: z.string().default(""),
  COLLECTOR_PROXY_PASSWORD: z.string().default("")
});

const envForParse = Object.fromEntries(
  Object.entries(process.env).map(([key, value]) => [key, value === "" ? undefined : value])
);

const parsed = schema.parse(envForParse);

export const config = {
  port: parsed.COLLECTOR_PORT,
  host: parsed.COLLECTOR_HOST,
  token: parsed.INSTAGRAM_COLLECTOR_TOKEN,
  concurrency: parsed.COLLECTOR_CONCURRENCY,
  navTimeoutMs: parsed.COLLECTOR_NAV_TIMEOUT_MS,
  contentTimeoutMs: parsed.COLLECTOR_CONTENT_TIMEOUT_MS,
  storageStatePath: parsed.COLLECTOR_STORAGE_STATE,
  traceDir: parsed.COLLECTOR_TRACE_DIR,
  traceTtlMinutes: parsed.COLLECTOR_TRACE_TTL_MINUTES,
  proxy: parsed.COLLECTOR_PROXY_URL
    ? {
        server: parsed.COLLECTOR_PROXY_URL,
        ...(parsed.COLLECTOR_PROXY_USERNAME
          ? { username: parsed.COLLECTOR_PROXY_USERNAME }
          : {}),
        ...(parsed.COLLECTOR_PROXY_PASSWORD
          ? { password: parsed.COLLECTOR_PROXY_PASSWORD }
          : {})
      }
    : undefined
};
