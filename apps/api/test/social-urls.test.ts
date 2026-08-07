import { describe, expect, it } from "vitest";

import {
  buildProfileUrl,
  normalizeUsername,
  parseSocialUrl,
  resolvePartnerSocialUrl
} from "../src/modules/social/social-urls.js";

describe("разбор ссылок соцсетей", () => {
  it("разбирает ссылку Telegram и приводит username к канону", () => {
    expect(parseSocialUrl("https://t.me/AVGStroy")).toEqual({
      platform: "telegram",
      username: "avgstroy",
      profileUrl: "https://t.me/avgstroy"
    });
  });

  it("считает t.me/s/name тем же профилем, что и t.me/name", () => {
    expect(parseSocialUrl("https://t.me/s/avgstroy")?.username).toBe("avgstroy");
  });

  it("разбирает Instagram с завершающим слэшем и query", () => {
    expect(parseSocialUrl("https://www.instagram.com/avgstroy/?hl=ru")).toEqual({
      platform: "instagram",
      username: "avgstroy",
      profileUrl: "https://www.instagram.com/avgstroy/"
    });
  });

  it("дописывает https к ссылке без протокола", () => {
    expect(parseSocialUrl("vk.com/avgst")?.platform).toBe("vk");
  });

  it("отклоняет http — провайдеры ходят только по https", () => {
    expect(parseSocialUrl("http://t.me/avgstroy")).toBeNull();
  });

  it("отклоняет неизвестный хост, чтобы не ходить по произвольным адресам", () => {
    expect(parseSocialUrl("https://evil.example.com/avgstroy")).toBeNull();
    expect(parseSocialUrl("https://t.me.evil.com/avgstroy")).toBeNull();
  });

  it("отклоняет служебные пути площадок", () => {
    expect(parseSocialUrl("https://www.instagram.com/p/Cabc123/")).toBeNull();
    expect(parseSocialUrl("https://t.me/joinchat/AAAA")).toBeNull();
    expect(parseSocialUrl("https://vk.com/video-1_2")).toBeNull();
  });

  it("отклоняет ссылку без имени профиля", () => {
    expect(parseSocialUrl("https://t.me/")).toBeNull();
    expect(parseSocialUrl("")).toBeNull();
  });

  it("нормализует username со срезанием @", () => {
    expect(normalizeUsername("telegram", "@AvgStroy")).toBe("avgstroy");
    expect(normalizeUsername("telegram", "тест")).toBeNull();
    expect(normalizeUsername("telegram", "ab")).toBeNull();
  });

  it("строит канонический URL для каждой площадки", () => {
    expect(buildProfileUrl("telegram", "avgstroy")).toBe("https://t.me/avgstroy");
    expect(buildProfileUrl("youtube", "avgst")).toBe("https://www.youtube.com/@avgst");
    expect(buildProfileUrl("dzen", "avgst")).toBe("https://dzen.ru/avgst");
  });
});

describe("ссылка партнёра из конфига сайта", () => {
  it("берёт поле, соответствующее платформе", () => {
    const config = {
      socialTelegram: "https://t.me/partner_one",
      socialInstagram: "https://instagram.com/partner_one_ig"
    };
    expect(resolvePartnerSocialUrl(config, "telegram")?.username).toBe("partner_one");
    expect(resolvePartnerSocialUrl(config, "instagram")?.username).toBe("partner_one_ig");
  });

  it("не подставляет чужую площадку, если партнёр перепутал поля", () => {
    const config = { socialTelegram: "https://instagram.com/someone" };
    expect(resolvePartnerSocialUrl(config, "telegram")).toBeNull();
  });

  it("возвращает null для незаполненной площадки, а не чужие данные", () => {
    const config = { socialTelegram: "https://t.me/partner_one" };
    expect(resolvePartnerSocialUrl(config, "vk")).toBeNull();
    expect(resolvePartnerSocialUrl(config, "instagram")).toBeNull();
  });

  it("данные двух партнёров не пересекаются", () => {
    const first = { socialTelegram: "https://t.me/partner_one" };
    const second = { socialTelegram: "https://t.me/partner_two" };
    expect(resolvePartnerSocialUrl(first, "telegram")?.username).toBe("partner_one");
    expect(resolvePartnerSocialUrl(second, "telegram")?.username).toBe("partner_two");
  });
});
