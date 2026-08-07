import type { Metadata } from "next";
import Link from "next/link";

/**
 * Инструкция по удалению данных — публичная страница b2b.avgst.ru/delete.
 *
 * Требование Meta для приложения Instagram Graph API: адрес обязан открываться
 * без входа. Отсюда никаких серверных запросов и сессии: страница статическая.
 */

export const metadata: Metadata = {
  title: "Удаление данных — Авангард Строй",
  description:
    "Как запросить удаление данных из партнёрского портала Авангард Строй: что мы храним, куда написать и в какой срок данные будут удалены.",
  robots: { index: true, follow: true }
};

const CONTACT_EMAIL = "avgst@avgst.ru";
const CONTACT_PHONE_HREF = "+78312666645";
const CONTACT_PHONE = "+7 (831) 266-66-45";
const OPERATOR = "ООО «Авангард Строй Нижний Новгород»";
const REQUEST_DEADLINE_DAYS = 30;
const UPDATED_AT = "8 августа 2026";

function Section({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h2>
      <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-muted-foreground md:text-base">
        {children}
      </div>
    </section>
  );
}

function MailLink() {
  return (
    <a
      href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Удаление данных")}`}
      className="font-medium text-avgst-green hover:underline"
    >
      {CONTACT_EMAIL}
    </a>
  );
}

export default function DeleteDataPage() {
  return (
    <main className="bg-background text-foreground">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4 md:px-8">
          {/* Оба логотипа проекта светлые, на белом фоне нужен чёрный — как в auth-page-shell */}
          <Link href="/" className="inline-flex shrink-0">
            <img
              src="/logo.svg"
              alt="Авангард Строй"
              className="h-9 w-auto"
              style={{ filter: "brightness(0) saturate(100%)" }}
            />
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            На главную
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-12 md:px-8 md:py-16">
        <p className="text-sm font-semibold tracking-[0.2em] text-avgst-green uppercase">
          Ваши данные
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Удаление данных
        </h1>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg">
          Партнёрский портал <strong className="font-medium text-foreground">b2b.avgst.ru</strong>{" "}
          — рабочий кабинет дилеров завода {OPERATOR}. На этой странице описано, какие данные
          хранит портал и как потребовать их удаления.
        </p>

        <Section title="Какие данные хранит портал">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="font-medium text-foreground">Учётные записи сотрудников</strong> —
              имя, адрес электронной почты, роль в кабинете и хеш пароля. Сам пароль не хранится.
            </li>
            <li>
              <strong className="font-medium text-foreground">Данные компании-дилера</strong> —
              название, юридическое имя, ИНН, регион, телефон и почта для связи.
            </li>
            <li>
              <strong className="font-medium text-foreground">Заявки покупателей</strong> с сайтов
              дилеров — имя, телефон, почта и текст обращения. Их оставляет сам посетитель в форме.
            </li>
            <li>
              <strong className="font-medium text-foreground">
                Снимки публичных профилей соцсетей
              </strong>{" "}
              дилера — название канала, описание, аватар, число подписчиков и последние публикации.
              Это копия того, что площадка показывает любому посетителю без входа; она обновляется
              не чаще раза в 20 минут и нужна, чтобы витрина сайта не обращалась к соцсети на каждый
              просмотр страницы.
            </li>
          </ul>
        </Section>

        <Section title="Данные Facebook и Instagram">
          <p>
            Входа через Facebook на портале нет. Мы не получаем и не храним персональные данные
            пользователей Facebook и Instagram: ни имён, ни адресов, ни списков друзей, ни истории
            действий.
          </p>
          <p>
            Приложение Meta используется только для одного: получить публичные данные
            Instagram-аккаунта самого дилера (имя аккаунта, описание, аватар, счётчики и последние
            публикации) и показать их на его сайте. Данные запрашиваются методом Business Discovery
            по аккаунту, ссылку на который дилер сам указал в своём кабинете.
          </p>
          <p>
            Если вы владелец такого Instagram-аккаунта и хотите, чтобы мы удалили сохранённую копию
            его публичных данных, напишите нам — порядок ниже.
          </p>
        </Section>

        <Section title="Как запросить удаление">
          <p>
            Отправьте письмо на <MailLink /> с темой{" "}
            <strong className="font-medium text-foreground">«Удаление данных»</strong> и укажите:
          </p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              что именно удалить — учётную запись, заявку, сохранённые данные соцсети или всё
              сразу;
            </li>
            <li>
              как найти эти данные — адрес электронной почты вашей учётной записи, телефон из
              заявки или ссылку на профиль соцсети;
            </li>
            <li>
              подтверждение, что запрос ваш: письмо с той же почты, что указана в учётной записи,
              либо с почты, привязанной к профилю соцсети.
            </li>
          </ol>
          <p>
            Телефон для вопросов:{" "}
            <a
              href={`tel:${CONTACT_PHONE_HREF}`}
              className="font-medium text-avgst-green hover:underline"
            >
              {CONTACT_PHONE}
            </a>
            .
          </p>
        </Section>

        <Section title="Что произойдёт дальше">
          <ul className="list-disc space-y-2 pl-5">
            <li>Мы подтвердим получение запроса ответным письмом.</li>
            <li>
              Данные будут удалены в срок не более {REQUEST_DEADLINE_DAYS} дней с момента
              подтверждения запроса, а обработка прекращена сразу после проверки.
            </li>
            <li>
              Мы сообщим письмом, что именно удалено. Если часть данных удалить нельзя — например,
              бухгалтерские документы, которые закон обязывает хранить, — мы прямо назовём эти
              данные и основание.
            </li>
            <li>
              Резервные копии перезаписываются по расписанию, поэтому данные могут оставаться в них
              до 30 дней. Из рабочей системы они удаляются сразу.
            </li>
          </ul>
        </Section>

        <Section title="Как убрать данные соцсети самостоятельно">
          <p>
            Дилер может в любой момент удалить ссылку на соцсеть в кабинете, в настройках своего
            сайта. После этого портал перестаёт обращаться к площадке и показывать её данные на
            сайте.
          </p>
          <p>
            Сохранённый снимок при этом остаётся в базе до истечения срока хранения — чтобы удалить
            его сразу, напишите нам на <MailLink />. Мы не делаем вид, что это происходит
            автоматически.
          </p>
        </Section>

        <Section title="Кто обрабатывает данные">
          <p>
            {OPERATOR}, ИНН 5261106177, адрес: 603057, Нижний Новгород, проспект Гагарина, 27а к1,
            11 этаж.
          </p>
          <p>
            Почта: <MailLink /> · Телефон:{" "}
            <a
              href={`tel:${CONTACT_PHONE_HREF}`}
              className="font-medium text-avgst-green hover:underline"
            >
              {CONTACT_PHONE}
            </a>
          </p>
        </Section>

        {/* Для проверки приложения Meta: ревьюер должен понять страницу без перевода */}
        <section className="mt-12 rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight">Data deletion request (English)</h2>
          <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted-foreground">
            <p>
              {`b2b.avgst.ru is a private B2B dealer portal of ${OPERATOR} (Avangard Stroy, Nizhny Novgorod, Russia).`}{" "}
              The portal has no Facebook Login and receives no personal data of Facebook or
              Instagram users.
            </p>
            <p>
              Our Meta app is used solely to fetch the public data of a dealer&apos;s own Instagram
              business account (username, name, biography, profile picture, public counters and
              recent posts) via Business Discovery, and to display it on that dealer&apos;s website.
              The response is cached for 20 minutes.
            </p>
            <p>
              To request deletion of your data, email{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Data deletion request")}`}
                className="font-medium text-avgst-green hover:underline"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              with the subject «Data deletion request» and state what should be deleted (account,
              submitted enquiry, cached social profile) and how to locate it (account email, phone
              number or profile link). Send the request from the email address linked to that
              account or profile.
            </p>
            <p>
              We confirm receipt by email, stop processing once the request is verified and delete
              the data within {REQUEST_DEADLINE_DAYS} days. Backups are rotated, so copies may
              persist there for up to 30 days.
            </p>
          </div>
        </section>

        <p className="mt-10 text-sm text-muted-foreground">Обновлено: {UPDATED_AT}</p>
      </div>

      <footer className="border-t border-border bg-white">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-5 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8">
          <p>© {new Date().getFullYear()} Авангард Строй · AVGST</p>
          <a href="https://avgst.ru" className="transition hover:text-foreground">
            avgst.ru
          </a>
        </div>
      </footer>
    </main>
  );
}
