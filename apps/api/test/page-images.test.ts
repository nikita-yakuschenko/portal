import { describe, expect, it } from "vitest";

import { mergeProjectImageUrls } from "../src/modules/catalog/page-images.js";

describe("page images merge", () => {
  it("keeps api gallery first and adds slider images up to cap", () => {
    const api = [
      "https://static.tildacdn.com/stor1111/a.jpg",
      "https://static.tildacdn.com/stor2222/b.jpg"
    ];
    const html = `
      li_img":"https://static.tildacdn.com/tild1111/1.jpg"
      li_img":"https://static.tildacdn.com/tild2222/2.jpg"
      li_img":"https://static.tildacdn.com/tild3333/3.jpg"
      li_img":"https://static.tildacdn.com/tild4444/4.jpg"
      li_img":"https://static.tildacdn.com/stor1111/-/resizeb/20x/a.jpg"
    `;

    const merged = mergeProjectImageUrls(api, html, 5);
    expect(merged[0]).toContain("a.jpg");
    expect(merged[1]).toContain("b.jpg");
    expect(merged.length).toBe(5);
  });
});
