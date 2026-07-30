import { describe, expect, it } from "vitest";

import type { CrmConnection } from "@b2b/domain";

import { AmoCrmAdapter, Bitrix24Adapter } from "../src/modules/crm/adapters.js";

describe("crm adapters", () => {
  it("validates amocrm credentials", async () => {
    const adapter = new AmoCrmAdapter();
    const connection: CrmConnection = {
      id: "1",
      partnerId: "1",
      provider: "amocrm",
      portalUrl: "https://example.amocrm.ru",
      credentials: {
        clientId: "id",
        clientSecret: "secret",
        refreshToken: "token"
      },
      isEnabled: true,
      createdAt: "2026-07-30T00:00:00.000Z"
    };

    await expect(adapter.validateConnection(connection)).resolves.toBe(true);
  });

  it("rejects incomplete bitrix credentials", async () => {
    const adapter = new Bitrix24Adapter();
    const connection: CrmConnection = {
      id: "1",
      partnerId: "1",
      provider: "bitrix24",
      portalUrl: "https://example.bitrix24.ru",
      credentials: {},
      isEnabled: true,
      createdAt: "2026-07-30T00:00:00.000Z"
    };

    await expect(adapter.validateConnection(connection)).resolves.toBe(false);
  });
});
