/**
 * Пересчёт публичных slug проектов (barnhouse-115 и т.п.).
 * Запуск: npx tsx src/scripts/refresh-project-slugs.ts
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });

import { eq } from "drizzle-orm";

import { db } from "../db/client.js";
import { catalogProjects } from "../db/schema.js";
import { projectSlug } from "../lib/slug.js";

async function main() {
  const rows = await db
    .select({ id: catalogProjects.id, name: catalogProjects.name, slug: catalogProjects.slug })
    .from(catalogProjects);

  const used = new Set<string>();
  let updated = 0;

  for (const row of rows) {
    let next = projectSlug(row.name);
    if (used.has(next)) {
      let n = 2;
      while (used.has(`${next}-${n}`)) n += 1;
      next = `${next}-${n}`;
    }
    used.add(next);

    if (next === row.slug) continue;
    await db.update(catalogProjects).set({ slug: next }).where(eq(catalogProjects.id, row.id));
    updated += 1;
    console.log(`${row.name} → ${next}`);
  }

  console.log(`Готово. Обновлено: ${updated} из ${rows.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
