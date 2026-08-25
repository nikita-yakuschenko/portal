import { describe, expect, it } from "vitest";

import { consumeRateLimit } from "../src/modules/social/rate-limit.js";

describe("consumeRateLimit", () => {
  it("пропускает до лимита и блокирует дальше", () => {
    const key = `test:${Date.now()}:${Math.random()}`;
    expect(consumeRateLimit(key, 2, 60_000)).toBe(true);
    expect(consumeRateLimit(key, 2, 60_000)).toBe(true);
    expect(consumeRateLimit(key, 2, 60_000)).toBe(false);
  });
});
