import { describe, expect, it } from "vitest";

import {
  describeUnavailable,
  formatCount,
  formatPublishedAt,
  formatSubscribers,
  hasLiveProvider,
  proxiedMediaUrl
} from "@/lib/social-profile";
import type { SocialProfileSnapshot } from "@b2b/domain";

function snapshot(status: SocialProfileSnapshot["status"]): SocialProfileSnapshot {
  return {
    platform: "instagram",
    profileUrl: "https://www.instagram.com/brand/",
    username: "brand",
    media: [],
    source: "none",
    status,
    fetchedAt: new Date().toISOString(),
    expiresAt: new Date().toISOString()
  };
}

/** Intl разделяет число и единицу неразрывным пробелом */
function normalizeSpaces(value: string | undefined): string | undefined {
  return value?.replace(/ /g, " ");
}

describe("форматирование счётчиков", () => {
  it("сокращает крупные числа по-русски", () => {
    expect(normalizeSpaces(formatCount(11_700))).toBe("11,7 тыс.");
    expect(normalizeSpaces(formatCount(1_200))).toBe("1,2 тыс.");
    expect(normalizeSpaces(formatCount(2_100_000))).toBe("2,1 млн");
  });

  it("не сокращает малые числа", () => {
    expect(formatCount(306)).toBe("306");
    expect(formatCount(0)).toBe("0");
  });

  it("отсутствующий счётчик остаётся отсутствующим, а не нулём", () => {
    expect(formatCount(undefined)).toBeUndefined();
    expect(formatCount(Number.NaN)).toBeUndefined();
  });
});

describe("подписчики", () => {
  it("согласует слово с числом", () => {
    expect(formatSubscribers(1)).toBe("1 подписчик");
    expect(formatSubscribers(2)).toBe("2 подписчика");
    expect(formatSubscribers(47)).toBe("47 подписчиков");
    expect(formatSubscribers(21)).toBe("21 подписчик");
    expect(formatSubscribers(12)).toBe("12 подписчиков");
    expect(formatSubscribers(0)).toBe("0 подписчиков");
  });

  it("для сокращённой записи всегда множественное число", () => {
    expect(normalizeSpaces(formatSubscribers(11_700))).toBe("11,7 тыс. подписчиков");
    expect(normalizeSpaces(formatSubscribers(1_000))).toBe("1 тыс. подписчиков");
  });

  it("без счётчика не выдумывает строку", () => {
    expect(formatSubscribers(undefined)).toBeUndefined();
  });
});

describe("дата публикации", () => {
  it("показывает относительное время для свежих публикаций", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatPublishedAt(twoHoursAgo)).toBe("2 ч назад");
  });

  it("игнорирует мусор вместо даты", () => {
    expect(formatPublishedAt("не дата")).toBeUndefined();
    expect(formatPublishedAt(undefined)).toBeUndefined();
  });
});

describe("прокси медиа", () => {
  it("оборачивает внешний адрес в серверный прокси", () => {
    expect(proxiedMediaUrl("https://cdn4.telesco.pe/file/a.jpg")).toBe(
      "/api/public/social-media?url=https%3A%2F%2Fcdn4.telesco.pe%2Ffile%2Fa.jpg"
    );
  });

  it("без адреса не создаёт ссылку", () => {
    expect(proxiedMediaUrl(undefined)).toBeUndefined();
  });
});

describe("площадки с живыми данными", () => {
  it("различает площадки с провайдером и без", () => {
    expect(hasLiveProvider("telegram")).toBe(true);
    expect(hasLiveProvider("instagram")).toBe(true);
    expect(hasLiveProvider("dzen")).toBe(true);
    expect(hasLiveProvider("max")).toBe(false);
    expect(hasLiveProvider("vk")).toBe(false);
  });
});

describe("объяснение недоступности", () => {
  it("различает причины, а не показывает одну заглушку", () => {
    const titles = new Set(
      (["not_found", "login_required", "rate_limited", "challenge"] as const).map(
        (status) => describeUnavailable(snapshot(status)).title
      )
    );
    expect(titles.size).toBe(4);
  });

  it("для пустого снимка даёт нейтральное сообщение", () => {
    expect(describeUnavailable(null).title).toBe("Данные пока недоступны");
  });
});
