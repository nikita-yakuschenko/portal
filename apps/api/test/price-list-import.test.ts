import { describe, expect, it } from "vitest";

import {
  findCatalogMatches,
  matchKeyFromName,
  normalizeProjectName
} from "../src/modules/catalog/price-list-import.js";

describe("price-list-import matching", () => {
  it("нормализует домокомплект и переносы", () => {
    expect(normalizeProjectName("Норвегия 103 \nдомокомплект")).toBe("норвегия 103");
  });

  it("сводит барн и барнхаус к одному семейству", () => {
    expect(matchKeyFromName("Барн 113").family).toBe("барн");
    expect(matchKeyFromName("Барнхаус 113").family).toBe("барн");
    expect(matchKeyFromName("Барн 113").area).toBe(113);
  });

  it("матчит укороченное имя Excel к каталогу", () => {
    const matches = findCatalogMatches("Барн 113", [
      { id: "1", name: "Барнхаус 113", technology: "modular" },
      { id: "2", name: "Барнхаус 115", technology: "modular" }
    ]);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.name).toBe("Барнхаус 113");
  });

  it("не матчит чужую площадь", () => {
    const matches = findCatalogMatches("Куб 100", [
      { id: "1", name: "Куб 50", technology: "modular" }
    ]);
    expect(matches).toHaveLength(0);
  });
});
