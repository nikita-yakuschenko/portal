import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseDzenExport } from "../src/modules/social/dzen-parser.js";

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8"));
}

const exportPayload = fixture("dzen-channel-export.json");

describe("витрина канала Дзена", () => {
  const parsed = parseDzenExport(exportPayload);

  it("читает название, описание, аватар и сайт канала", () => {
    expect(parsed).not.toBeNull();
    expect(parsed?.displayName).toBe("Авангард Строй");
    expect(parsed?.biography).toContain("за городом");
    expect(parsed?.avatarUrl?.startsWith("https://")).toBe(true);
    expect(parsed?.website).toBe("https://avgst.ru?utm_source=dzen");
  });

  it("читает число подписчиков числом, а не строкой", () => {
    expect(parsed?.followersCount).toBe(47);
  });

  it("собирает публикации со ссылкой и обложкой", () => {
    expect(parsed?.media).toHaveLength(9);
    for (const item of parsed?.media ?? []) {
      expect(item.id).toBeTruthy();
      expect(item.permalink?.startsWith("https://dzen.ru/")).toBe(true);
      expect(item.thumbnailUrl?.startsWith("https://")).toBe(true);
    }
  });

  it("берёт обложку короткой заметки из вложения", () => {
    const brief = parsed?.media.find((item) => item.permalink?.includes("/b/"));
    expect(brief?.thumbnailUrl).toContain("get-zen_brief");
  });

  it("пропускает блоки-подборки: это не публикации", () => {
    const titles = (parsed?.media ?? []).map((item) => item.caption);
    expect(titles).not.toContain("Ролики");
    expect(titles).not.toContain("Видео");
  });

  it("не выдумывает дату и просмотры, когда площадка их не отдала", () => {
    for (const item of parsed?.media ?? []) {
      if (item.publishedAt !== undefined) {
        expect(Number.isNaN(Date.parse(item.publishedAt))).toBe(false);
      }
      if (item.views !== undefined) expect(typeof item.views).toBe("number");
    }
    const withoutDate = (parsed?.media ?? []).filter((item) => item.publishedAt === undefined);
    expect(withoutDate.length).toBeGreaterThan(0);
  });

  it("переводит секунды публикации в ISO", () => {
    const article = parsed?.media.find((item) => item.permalink?.endsWith("aenvwqKNXAXBQhMN"));
    expect(article?.publishedAt).toBe(new Date(1_776_939_140_000).toISOString());
  });
});

describe("отказы витрины Дзена", () => {
  it("отдаёт null, когда канала в ответе нет", () => {
    expect(parseDzenExport({ items: [] })).toBeNull();
    expect(parseDzenExport(null)).toBeNull();
    expect(parseDzenExport("<html>")).toBeNull();
  });

  it("отдаёт null, когда площадка не подтвердила канал", () => {
    expect(parseDzenExport({ channel: { status: "error", source: { title: "Кто-то" } } })).toBeNull();
  });

  it("не берёт публикацию без обложки", () => {
    const parsed = parseDzenExport({
      channel: { status: "ok", source: { title: "Канал", subscribers: 0 } },
      items: [{ item_type: "native", title: "Без картинки", share_link: "https://dzen.ru/a/xxx" }]
    });
    expect(parsed?.media).toEqual([]);
    expect(parsed?.followersCount).toBe(0);
  });

  it("не принимает http-ссылки за обложку", () => {
    const parsed = parseDzenExport({
      channel: { status: "ok", source: { title: "Канал" } },
      items: [
        {
          item_type: "native",
          share_link: "https://dzen.ru/a/xxx",
          image: "http://avatars.dzeninfra.ru/insecure"
        }
      ]
    });
    expect(parsed?.media).toEqual([]);
  });

  it("помечает ролики видео", () => {
    const parsed = parseDzenExport({
      channel: { status: "ok", source: { title: "Канал" } },
      items: [
        {
          item_type: "short_video",
          share_link: "https://dzen.ru/shorts/xxx",
          image: "https://avatars.dzeninfra.ru/cover"
        }
      ]
    });
    expect(parsed?.media[0]?.type).toBe("video");
  });
});
