import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  parseCompactNumber,
  parseTelegramFeedPage,
  parseTelegramProfilePage
} from "../src/modules/social/telegram-parser.js";

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");
}

const channelHtml = fixture("telegram-channel.html");
const profileHtml = fixture("telegram-profile-no-feed.html");
const notFoundHtml = fixture("telegram-not-found.html");

describe("счётчики Telegram", () => {
  it("раскрывает компактную запись в число", () => {
    expect(parseCompactNumber("1.2K")).toBe(1200);
    expect(parseCompactNumber("4.75K")).toBe(4750);
    expect(parseCompactNumber("2.1M")).toBe(2_100_000);
    expect(parseCompactNumber("1,234")).toBe(1234);
    expect(parseCompactNumber("306")).toBe(306);
  });

  it("возвращает undefined вместо нуля, когда счётчика нет", () => {
    expect(parseCompactNumber(undefined)).toBeUndefined();
    expect(parseCompactNumber("")).toBeUndefined();
    expect(parseCompactNumber("подписчики")).toBeUndefined();
  });
});

describe("страница канала t.me/s/{username}", () => {
  const parsed = parseTelegramFeedPage(channelHtml);

  it("читает название, описание и аватар", () => {
    expect(parsed).not.toBeNull();
    expect(parsed?.displayName).toContain("Авангард Строй");
    expect(parsed?.biography).toBeTruthy();
    expect(parsed?.avatarUrl?.startsWith("https://")).toBe(true);
  });

  it("читает число подписчиков числом, а не строкой", () => {
    expect(typeof parsed?.followersCount).toBe("number");
    expect(parsed?.followersCount).toBeGreaterThan(0);
  });

  it("собирает публикации с картинкой, ссылкой и датой", () => {
    expect(parsed?.media.length).toBeGreaterThan(0);
    for (const item of parsed?.media ?? []) {
      expect(item.id).toBeTruthy();
      expect(item.thumbnailUrl?.startsWith("https://")).toBe(true);
      expect(item.permalink?.startsWith("https://t.me/")).toBe(true);
      expect(item.publishedAt).toBeTruthy();
    }
  });

  it("для видео отдаёт сам файл: превью Telegram размыто намеренно", () => {
    const videos = (parsed?.media ?? []).filter((item) => item.type === "video");
    expect(videos.length).toBeGreaterThan(0);
    for (const item of videos) {
      expect(item.videoUrl?.startsWith("https://")).toBe(true);
      expect(item.videoUrl).toMatch(/\.mp4/);
    }
  });

  it("берёт пропорции кадра из разметки, а не режет под общий формат", () => {
    for (const item of parsed?.media ?? []) {
      if (item.aspectRatio === undefined) continue;
      expect(item.aspectRatio).toBeGreaterThanOrEqual(0.3);
      expect(item.aspectRatio).toBeLessThanOrEqual(3.5);
    }
    // В канале есть вертикальные видео 3:4 — их формат должен отличаться от фото
    const ratios = new Set(
      (parsed?.media ?? []).map((item) => item.aspectRatio).filter((value) => value !== undefined)
    );
    expect(ratios.size).toBeGreaterThan(1);
  });

  it("не выдумывает поля, которых нет в разметке", () => {
    for (const item of parsed?.media ?? []) {
      if (item.views !== undefined) expect(typeof item.views).toBe("number");
    }
  });

  it("отдаёт свежие публикации первыми", () => {
    const dates = (parsed?.media ?? [])
      .map((item) => (item.publishedAt ? Date.parse(item.publishedAt) : Number.NaN))
      .filter((value) => Number.isFinite(value));
    const sorted = [...dates].sort((a, b) => b - a);
    expect(dates).toEqual(sorted);
  });
});

describe("страница профиля t.me/{username}", () => {
  it("читает профиль без публичной ленты и не придумывает публикации", () => {
    const parsed = parseTelegramProfilePage(profileHtml);
    expect(parsed).not.toBeNull();
    expect(parsed?.displayName).toBeTruthy();
    expect(parsed?.media).toEqual([]);
  });

  it("отдаёт null для несуществующего профиля", () => {
    expect(parseTelegramProfilePage(notFoundHtml)).toBeNull();
  });

  it("не принимает страницу профиля за ленту канала", () => {
    expect(parseTelegramFeedPage(profileHtml)).toBeNull();
    expect(parseTelegramFeedPage(notFoundHtml)).toBeNull();
  });
});
