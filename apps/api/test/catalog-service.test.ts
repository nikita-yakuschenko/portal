import { describe, expect, it } from "vitest";

import { CatalogService, mapTildaProduct } from "../src/modules/catalog/catalog-service.js";
import { MockTildaClient } from "../src/modules/catalog/tilda-client.js";

describe("catalog service", () => {
  it("maps a Tilda product into normalized project", () => {
    const project = mapTildaProduct(
      {
        id: "house-54",
        title: "Зимний 54",
        description: "Описание",
        technology: "modular",
        price: 100,
        url: "https://example.com",
        images: ["https://example.com/main.jpg"]
      },
      "2026-07-30T00:00:00.000Z"
    );

    expect(project.source).toBe("tilda");
    expect(project.sourceUid).toBe("house-54");
    expect(project.details.packages.length).toBeGreaterThanOrEqual(0);
    expect(project.details.techDocs.length).toBeGreaterThan(0);
    expect(project.assets).toHaveLength(1);
    expect(project.slug).toContain("зимний-54");
  });

  it("creates and updates projects across sync runs", async () => {
    const service = new CatalogService(new MockTildaClient());

    const firstRun = await service.syncFromTilda();
    const secondRun = await service.syncFromTilda();

    expect(firstRun.created).toBe(2);
    expect(secondRun.updated).toBe(2);
    expect(service.listProjects()).toHaveLength(2);
  });
});
