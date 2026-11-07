import { config } from "./config.js";
import { buildApp } from "./app.js";
import { syncCmsCatalog } from "./modules/catalog/cms-sync.js";

const app = await buildApp();

// Каталог CMS меняется без вебхука, поэтому портал сам забирает его раз в две минуты.
const CATALOG_SYNC_MS = 2 * 60 * 1000;
let catalogSyncing = false;

async function pullCatalog() {
  if (catalogSyncing) return;
  catalogSyncing = true;
  try {
    const result = await syncCmsCatalog();
    app.log.info(
      { created: result.createdCount, updated: result.updatedCount, assets: result.assetsDiscovered, errors: result.errors.length },
      "каталог CMS подтянут"
    );
  } catch (error) {
    app.log.error(error, "каталог CMS не подтянулся");
  } finally {
    catalogSyncing = false;
  }
}

try {
  await app.listen({ port: config.port, host: "0.0.0.0" });
  void pullCatalog();
  setInterval(pullCatalog, CATALOG_SYNC_MS);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
