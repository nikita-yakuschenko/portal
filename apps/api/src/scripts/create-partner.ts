/**
 * Создать партнёра напрямую в БД (логин + пароль).
 *
 *   npm run create-partner -w @b2b/api -- --email=partner@avgst.local --password=Secret123!
 *
 * DATABASE_URL — из .env или окружения (прод / локаль).
 */
import { StoreTildaClient } from "../modules/catalog/tilda-client.js";
import { PortalService } from "../modules/portal/portal-service.js";
import { sql } from "../db/client.js";

function argValue(flag: string): string | undefined {
  const prefix = `${flag}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (hit) {
    return hit.slice(prefix.length);
  }
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith("--")) {
    return process.argv[idx + 1];
  }
  return undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

const email = argValue("--email");
const password = argValue("--password");

if (!email || !password) {
  console.error(
    "Usage: npm run create-partner -w @b2b/api -- --email=user@domain --password=Secret123! [--name=...] [--company=...] [--region=...] [--phone=...] [--reset-password]"
  );
  process.exit(1);
}

if (password.length < 8) {
  console.error("Пароль должен быть не короче 8 символов.");
  process.exit(1);
}

const portalService = new PortalService(new StoreTildaClient());

try {
  const result = await portalService.createPartnerAccount({
    email,
    password,
    fullName: argValue("--name"),
    companyName: argValue("--company"),
    region: argValue("--region"),
    phone: argValue("--phone"),
    resetPassword: hasFlag("--reset-password")
  });

  if (result.created) {
    console.log("Создан партнёр:");
  } else if (result.passwordReset) {
    console.log("Пароль обновлён для существующего партнёра:");
  }

  console.log(`  email:     ${result.email}`);
  console.log(`  partnerId: ${result.partnerId}`);
  console.log(`  userId:    ${result.userId}`);
  console.log("Вход: https://b2b.avgst.ru/login → кабинет /partner (сайт и домен настроишь там).");
  process.exitCode = 0;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
