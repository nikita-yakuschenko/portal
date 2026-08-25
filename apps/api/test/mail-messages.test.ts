import { describe, expect, it } from "vitest";

import {
  applicationReceivedMail,
  applicationRejectedMail,
  partnerAccessMail,
  passwordResetMail
} from "../src/modules/mail/messages.js";

describe("шаблоны писем", () => {
  it("подтверждает заявку без секретов", () => {
    const mail = applicationReceivedMail("Иван");
    expect(mail.subject).toContain("принята");
    expect(mail.text).toContain("Иван");
    expect(mail.text).not.toMatch(/парол/i);
  });

  it("кладёт комментарий отклонения в текст", () => {
    const mail = applicationRejectedMail("Иван", "Неполный пакет");
    expect(mail.text).toContain("Неполный пакет");
    expect(mail.html).toContain("Неполный пакет");
  });

  it("кладёт временный пароль и ссылку входа в письмо доступа", () => {
    const mail = partnerAccessMail({
      kind: "approved",
      name: "Иван",
      loginEmail: "dealer@example.ru",
      temporaryPassword: "tmp-secret",
      loginUrl: "https://b2b.avgst.ru/login"
    });
    expect(mail.text).toContain("tmp-secret");
    expect(mail.text).toContain("https://b2b.avgst.ru/login");
    expect(mail.html).toContain("tmp-secret");
  });

  it("кладёт ссылку сброса, но не сырой токен отдельно от URL", () => {
    const resetUrl = "https://b2b.avgst.ru/reset-password?token=abc123";
    const mail = passwordResetMail({ name: "Иван", resetUrl });
    expect(mail.text).toContain(resetUrl);
    expect(mail.subject).toContain("Сброс пароля");
  });
});
