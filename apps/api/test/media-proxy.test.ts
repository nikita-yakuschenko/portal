import { describe, expect, it } from "vitest";

import { isAllowedMediaUrl } from "../src/modules/social/media-proxy.js";
import { socialProfileCacheKey } from "@b2b/domain";

describe("allowlist медиа-прокси", () => {
  it("пропускает CDN Telegram, Instagram и Дзена", () => {
    expect(isAllowedMediaUrl("https://cdn4.telesco.pe/file/abc.jpg")).toBe(true);
    expect(isAllowedMediaUrl("https://t.me/i/userpic/320/abc.jpg")).toBe(true);
    expect(isAllowedMediaUrl("https://scontent-arn2-1.cdninstagram.com/v/t51.jpg")).toBe(true);
    expect(isAllowedMediaUrl("https://avatars.dzeninfra.ru/get-zen_doc/1/pub_a/scale_1200")).toBe(
      true
    );
  });

  it("не пропускает произвольные адреса — это не универсальный прокси", () => {
    expect(isAllowedMediaUrl("https://evil.example.com/payload.jpg")).toBe(false);
    expect(isAllowedMediaUrl("https://telesco.pe.evil.com/a.jpg")).toBe(false);
    expect(isAllowedMediaUrl("https://dzeninfra.ru.evil.com/a.jpg")).toBe(false);
  });

  it("не пропускает внутреннюю сеть и нестандартные схемы", () => {
    expect(isAllowedMediaUrl("http://cdn4.telesco.pe/file/abc.jpg")).toBe(false);
    expect(isAllowedMediaUrl("https://127.0.0.1/file.jpg")).toBe(false);
    expect(isAllowedMediaUrl("https://localhost:8080/file.jpg")).toBe(false);
    expect(isAllowedMediaUrl("file:///etc/passwd")).toBe(false);
    expect(isAllowedMediaUrl("не ссылка")).toBe(false);
  });

  it("не пропускает нестандартный порт на разрешённом хосте", () => {
    expect(isAllowedMediaUrl("https://cdn4.telesco.pe:8443/file/abc.jpg")).toBe(false);
  });
});

describe("ключ кэша профиля", () => {
  it("включает платформу и нормализованный username", () => {
    expect(socialProfileCacheKey("telegram", "AvgStroy")).toBe("social-profile:telegram:avgstroy");
  });

  it("разводит одинаковые имена на разных площадках", () => {
    expect(socialProfileCacheKey("telegram", "brand")).not.toBe(
      socialProfileCacheKey("instagram", "brand")
    );
  });
});

describe("типы содержимого", () => {
  it("видео Telegram разрешено: чёткий кадр есть только в файле", () => {
    expect(isAllowedMediaUrl("https://cdn4.telesco.pe/file/clip.mp4")).toBe(true);
  });
});
