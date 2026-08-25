function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapHtml(body: string): string {
  return `<!doctype html>
<html lang="ru">
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b;line-height:1.5">
    <div style="max-width:560px;margin:0 auto;padding:24px;background:#fff;border:1px solid #e4e4e7">
      <p style="margin:0 0 16px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#3d6b4f">
        Авангард Строй · партнёрский кабинет
      </p>
      ${body}
    </div>
  </body>
</html>`;
}

export type MailContent = {
  subject: string;
  text: string;
  html: string;
};

export function applicationReceivedMail(contactName: string): MailContent {
  const name = contactName.trim() || "коллега";
  const text = [
    `Здравствуйте, ${name}!`,
    "",
    "Мы получили заявку на подключение к партнёрскому кабинету AVGST.",
    "После проверки откроем доступ и пришлём письмо со входом.",
    "",
    "Авангард Строй"
  ].join("\n");

  return {
    subject: "Заявка в партнёрский кабинет AVGST принята",
    text,
    html: wrapHtml(
      `<p>Здравствуйте, ${escapeHtml(name)}!</p>
       <p>Мы получили заявку на подключение к партнёрскому кабинету AVGST. После проверки откроем доступ и пришлём письмо со входом.</p>
       <p>Авангард Строй</p>`
    )
  };
}

export function applicationRejectedMail(contactName: string, comment?: string): MailContent {
  const name = contactName.trim() || "коллега";
  const commentBlock = comment?.trim()
    ? `\nКомментарий: ${comment.trim()}\n`
    : "\n";
  const commentHtml = comment?.trim()
    ? `<p>Комментарий: ${escapeHtml(comment.trim())}</p>`
    : "";

  return {
    subject: "Заявка в партнёрский кабинет AVGST",
    text: [
      `Здравствуйте, ${name}!`,
      "",
      "К сожалению, заявку на подключение к партнёрскому кабинету сейчас не одобрили.",
      commentBlock.trimEnd(),
      "Авангард Строй"
    ]
      .filter((line) => line !== undefined)
      .join("\n"),
    html: wrapHtml(
      `<p>Здравствуйте, ${escapeHtml(name)}!</p>
       <p>К сожалению, заявку на подключение к партнёрскому кабинету сейчас не одобрили.</p>
       ${commentHtml}
       <p>Авангард Строй</p>`
    )
  };
}

export type AccessMailKind = "approved" | "created" | "reset";

export function partnerAccessMail(input: {
  kind: AccessMailKind;
  name: string;
  loginEmail: string;
  temporaryPassword: string;
  loginUrl: string;
}): MailContent {
  const name = input.name.trim() || "коллега";
  const intro =
    input.kind === "approved"
      ? "Заявка одобрена. Открыли доступ в партнёрский кабинет."
      : input.kind === "reset"
        ? "Пароль владельца кабинета сброшен. Ниже новый временный пароль."
        : "Для вас открыт доступ в партнёрский кабинет AVGST.";

  const subject =
    input.kind === "reset"
      ? "Новый пароль партнёрского кабинета AVGST"
      : "Доступ в партнёрский кабинет AVGST";

  const text = [
    `Здравствуйте, ${name}!`,
    "",
    intro,
    "",
    `Вход: ${input.loginUrl}`,
    `Email: ${input.loginEmail}`,
    `Временный пароль: ${input.temporaryPassword}`,
    "",
    "После входа смените пароль.",
    "",
    "Авангард Строй"
  ].join("\n");

  return {
    subject,
    text,
    html: wrapHtml(
      `<p>Здравствуйте, ${escapeHtml(name)}!</p>
       <p>${escapeHtml(intro)}</p>
       <p>Вход: <a href="${escapeHtml(input.loginUrl)}">${escapeHtml(input.loginUrl)}</a></p>
       <p>Email: ${escapeHtml(input.loginEmail)}<br/>Временный пароль: <strong>${escapeHtml(input.temporaryPassword)}</strong></p>
       <p>После входа смените пароль.</p>
       <p>Авангард Строй</p>`
    )
  };
}

export function passwordResetMail(input: { name: string; resetUrl: string }): MailContent {
  const name = input.name.trim() || "коллега";
  const text = [
    `Здравствуйте, ${name}!`,
    "",
    "Запрос на сброс пароля партнёрского кабинета AVGST.",
    "Ссылка действует 1 час:",
    input.resetUrl,
    "",
    "Если вы не запрашивали сброс, просто проигнорируйте письмо.",
    "",
    "Авангард Строй"
  ].join("\n");

  return {
    subject: "Сброс пароля партнёрского кабинета AVGST",
    text,
    html: wrapHtml(
      `<p>Здравствуйте, ${escapeHtml(name)}!</p>
       <p>Запрос на сброс пароля партнёрского кабинета AVGST. Ссылка действует 1 час:</p>
       <p><a href="${escapeHtml(input.resetUrl)}">${escapeHtml(input.resetUrl)}</a></p>
       <p>Если вы не запрашивали сброс, просто проигнорируйте письмо.</p>
       <p>Авангард Строй</p>`
    )
  };
}
