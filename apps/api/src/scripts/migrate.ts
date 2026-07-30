import "dotenv/config";

import { migrate } from "drizzle-orm/postgres-js/migrator";

import { db, sql } from "../db/client.js";

try {
  await migrate(db, {
    migrationsFolder: "drizzle"
  });
  await sql.end();
  process.exit(0);
} catch (error) {
  console.error(error);
  await sql.end();
  process.exit(1);
}
