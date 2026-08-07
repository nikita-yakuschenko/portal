import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  classifyPage,
  parseHumanCount,
  parseProfileDom,
  parseProfileJson
} from "../src/parsers.js";

const webProfileInfo = JSON.parse(
  readFileSync(fileURLToPath(new URL("./fixtures/web-profile-info.json", import.meta.url)), "utf8")
);

describe("разбор JSON профиля", () => {
  const parsed = parseProfileJson(webProfileInfo);

  it("читает профиль и счётчики числами", () => {
    expect(parsed?.username).toBe("partner_demo");
    expect(parsed?.displayName).toBe("Партнёр Демо");
    expect(parsed?.followersCount).toBe(11700);
    expect(parsed?.followingCount).toBe(128);
    expect(parsed?.postsCount).toBe(342);
    expect(parsed?.category).toBe("Строительная компания");
    expect(parsed?.website).toBe("https://partner-demo.ru");
  });

  it("различает типы публикаций", () => {
    expect(parsed?.media.map((item) => item.type)).toEqual(["image", "video", "carousel"]);
  });

  it("собирает permalink и дату публикации", () => {
    const first = parsed?.media[0];
    expect(first?.permalink).toBe("https://www.instagram.com/p/Cxx001/");
    expect(first?.publishedAt).toBe(new Date(1786000000 * 1000).toISOString());
    expect(first?.caption).toBe("Сдали дом в Кстово");
  });

  it("не подставляет ноль вместо отсутствующих просмотров", () => {
    expect(parsed?.media[0]?.views).toBeUndefined();
    expect(parsed?.media[1]?.views).toBe(5400);
  });

  it("отклоняет ответ без пользователя вместо пустого успеха", () => {
    expect(parseProfileJson({ data: {} })).toBeNull();
    expect(parseProfileJson({ message: "checkpoint_required" })).toBeNull();
    expect(parseProfileJson(null)).toBeNull();
    expect(parseProfileJson("<html>login</html>")).toBeNull();
  });
});

describe("разбор счётчиков из текста", () => {
  it("понимает английские и русские сокращения", () => {
    expect(parseHumanCount("11.7K")).toBe(11700);
    expect(parseHumanCount("2.1M")).toBe(2_100_000);
    expect(parseHumanCount("11,7 тыс.")).toBe(11700);
    expect(parseHumanCount("1,234")).toBe(1234);
    expect(parseHumanCount("342")).toBe(342);
  });

  it("возвращает undefined на мусоре", () => {
    expect(parseHumanCount(undefined)).toBeUndefined();
    expect(parseHumanCount("подписчики")).toBeUndefined();
  });
});

describe("разбор DOM как запасной путь", () => {
  it("достаёт счётчики из og:description и публикации из ссылок", () => {
    const parsed = parseProfileDom(
      {
        metaDescription: "11.7K Followers, 128 Following, 342 Posts - See photos",
        ogTitle: "Партнёр Демо (@partner_demo)",
        ogImage: "https://scontent.cdninstagram.com/avatar.jpg",
        headerTitle: "Партнёр Демо",
        biography: "Строим дома",
        postLinks: [
          { href: "/p/Cxx001/", imageUrl: "https://scontent.cdninstagram.com/1.jpg", alt: "Дом" },
          { href: "/reel/Cxx002/", imageUrl: "https://scontent.cdninstagram.com/2.jpg" }
        ]
      },
      "partner_demo"
    );

    expect(parsed?.followersCount).toBe(11700);
    expect(parsed?.postsCount).toBe(342);
    expect(parsed?.media).toHaveLength(2);
    expect(parsed?.media[0]?.permalink).toBe("https://www.instagram.com/p/Cxx001/");
    expect(parsed?.media[1]?.type).toBe("video");
  });

  it("возвращает null, когда на странице нет ничего профильного", () => {
    expect(parseProfileDom({ postLinks: [] }, "partner_demo")).toBeNull();
  });
});

describe("классификация состояния страницы", () => {
  const base = { finalUrl: "https://www.instagram.com/partner_demo/", bodyText: "" };

  it("распознаёт login wall", () => {
    expect(
      classifyPage({ ...base, finalUrl: "https://www.instagram.com/accounts/login/?next=/x/" })
    ).toBe("login_required");
  });

  it("распознаёт challenge", () => {
    expect(classifyPage({ ...base, finalUrl: "https://www.instagram.com/challenge/" })).toBe(
      "challenge"
    );
  });

  it("распознаёт лимит запросов", () => {
    expect(classifyPage({ ...base, status: 429 })).toBe("rate_limited");
    expect(classifyPage({ ...base, bodyText: "Please wait a few minutes before you try again." })).toBe(
      "rate_limited"
    );
  });

  it("распознаёт отсутствующий профиль", () => {
    expect(classifyPage({ ...base, status: 404 })).toBe("not_found");
    expect(classifyPage({ ...base, bodyText: "Sorry, this page isn't available." })).toBe(
      "not_found"
    );
  });

  it("приватный аккаунт не считает публично доступным", () => {
    expect(classifyPage({ ...base, bodyText: "This account is private" })).toBe("login_required");
  });

  it("на обычной странице проблем не выдумывает", () => {
    expect(classifyPage({ ...base, status: 200, bodyText: "342 публикации" })).toBeNull();
  });
});
