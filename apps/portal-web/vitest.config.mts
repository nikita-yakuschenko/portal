import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Тесты чистых функций витрины: перспектива мокапа и форматирование данных */
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node"
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url))
    }
  }
});
