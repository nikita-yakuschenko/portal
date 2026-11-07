import { syncCmsCatalog } from "../modules/catalog/cms-sync.js";
import { sql } from "../db/client.js";

try {
  const result = await syncCmsCatalog();
  console.log(JSON.stringify(result));
  await sql.end();
  process.exit(result.errors.length ? 1 : 0);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  await sql.end();
  process.exit(1);
}
