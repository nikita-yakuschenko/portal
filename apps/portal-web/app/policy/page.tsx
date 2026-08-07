import type { Metadata } from "next";
import Link from "next/link";

/**
 * Политика конфиденциальности портала — публичная страница b2b.avgst.ru/policy.
 *
 * Meta требует действительный URL политики для публикации приложения, поэтому
 * страница обязана открываться без входа: никакой сессии и серверных запросов.
 */

export const metadata: Metadata = {
  title: "Политика конфиденциальности — Авангард Строй",
  description:
    "Как партнёрский портал Авангард Строй обрабатывает персональные данные: какие данные собираются, зачем, кому передаются и как их удалить.",
  robots: { index: true, follow: true }
};

const CONTACT_EMAIL = "avgst@avgst.ru";
const CONTACT_PHONE_HREF = "+78312666645";
const CONTACT_PHONE = "+7 (831) 266-66-45";
const OPERATOR = "ООО «Авангард Строй Нижний Новгород»";
const UPDATED_AT = "8 августа 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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
    <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-avgst-green hover:underline">
      {CONTACT_EMAIL}
    </a>
  );
}

export default function PolicyPage() {
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
          Политика конфиденциальности
        </h1>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg">
          Политика описывает, как {OPERATOR} обрабатывает персональные данные в партнёрском портале{" "}
          <strong className="font-medium text-foreground">b2b.avgst.ru</strong> и на сайтах дилеров,
          которые портал обслуживает.
        </p>

        <Section title="Какие данные обрабатываются">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="font-medium text-foreground">Сотрудники дилеров и завода</strong> —
              имя, адрес электронной почты, роль в кабинете и хеш пароля. Пароль в открытом виде не
              хранится и не может быть восстановлен.
            </li>
            <li>
              <strong className="font-medium text-foreground">Компании-дилеры</strong> — название,
              юридическое имя, ИНН, регион, телефон и адрес электронной почты для связи.
            </li>
            <li>
              <strong className="font-medium text-foreground">Посетители сайтов дилеров</strong> —
              имя, телефон, адрес электронной почты и текст обращения, которые посетитель сам
              указывает в форме заявки.
            </li>
            <li>
              <strong className="font-medium text-foreground">
                Публичные данные профилей соцсетей
              </strong>{" "}
              дилера — название канала, описание, аватар, счётчики и последние публикации. Это копия
              того, что площадка показывает любому посетителю без входа. Персональные данные
              пользователей соцсетей мы не получаем.
            </li>
          </ul>
        </Section>

        <Section title="Зачем они нужны">
          <ul className="list-disc space-y-2 pl-5">
            <li>дать сотруднику дилера доступ в кабинет и разграничить права;</li>
            <li>вести работу по договору с дилером: каталог, цены, проекты, заказы;</li>
            <li>передать заявку покупателя дилеру, который её обрабатывает;</li>
            <li>показать на сайте дилера его же соцсети и предложить подписаться.</li>
          </ul>
        </Section>

        <Section title="На каком основании">
          <p>
            Данные сотрудников и компаний обрабатываются для исполнения договора с дилером. Данные
            посетителя — на основании его согласия, которое он даёт, отправляя форму на сайте
            дилера. Публичные данные соцсетей обрабатываются в интересах дилера, который сам указал
            ссылку на свой профиль в настройках сайта.
          </p>
        </Section>

        <Section title="Кому передаются данные">
          <p>
            Заявка покупателя передаётся дилеру, к сайту которого она относится, и в его CRM, если
            дилер подключил её в настройках — например, amoCRM или Битрикс24. Дальнейшая обработка
            заявки в CRM дилера ведётся самим дилером.
          </p>
          <p>
            Иным третьим лицам данные не передаются и не продаются, за исключением случаев,
            предусмотренных законом. В соцсети мы данные не отправляем — только читаем то, что там
            опубликовано открыто.
          </p>
        </Section>

        <Section title="Cookie и статистика">
          <p>
            Портал использует одну служебную cookie <code className="text-foreground">b2b_session</code>{" "}
            — она нужна, чтобы вы оставались в кабинете после входа. Рекламных и отслеживающих cookie
            портал не ставит, счётчиков статистики на самом портале нет.
          </p>
          <p>
            На сайте дилера может стоять счётчик Яндекс.Метрики, который дилер подключает сам в
            настройках своего сайта. Такой счётчик принадлежит дилеру, и данные собирает он.
          </p>
        </Section>

        <Section title="Сколько данные хранятся">
          <p>
            Данные сотрудников и компаний хранятся, пока действует договор с дилером и учётная запись
            не удалена. Заявки покупателей хранятся, пока нужны для работы по обращению и отчётности.
            Снимок публичного профиля соцсети обновляется не чаще раза в 20 минут и хранится, пока
            ссылка на профиль указана в настройках сайта.
          </p>
        </Section>

        <Section title="Как данные защищены">
          <p>
            Доступ к кабинету — только по паролю, пароли хранятся в виде хеша. Права разграничены по
            ролям: дилер видит только свои данные и заявки со своего сайта. Соединение с порталом
            защищено по HTTPS.
          </p>
        </Section>

        <Section title="Ваши права">
          <p>
            Вы можете узнать, какие ваши данные у нас есть, потребовать их исправления, отозвать
            согласие на обработку и потребовать удаления. Для этого напишите на <MailLink />.
          </p>
          <p>
            Порядок удаления с перечнем того, что нужно указать в письме, и сроками описан отдельно:{" "}
            <Link href="/delete" className="font-medium text-avgst-green hover:underline">
              удаление данных
            </Link>
            .
          </p>
        </Section>

        <Section title="Контакты">
          <p>
            {OPERATOR}, ИНН 5261106177, адрес: 603057, Нижний Новгород, проспект Гагарина, 27а к1, 11
            этаж.
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

        <Section title="Изменения политики">
          <p>
            Мы можем обновлять политику. Действующая версия всегда доступна по адресу
            b2b.avgst.ru/policy, дата последнего изменения указана ниже.
          </p>
        </Section>

        {/* Для проверки приложения Meta: ревьюер должен понять страницу без перевода */}
        <section className="mt-12 rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight">Privacy policy (English summary)</h2>
          <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted-foreground">
            <p>
              {`b2b.avgst.ru is a private B2B dealer portal of ${OPERATOR} (Avangard Stroy, Nizhny Novgorod, Russia).`}{" "}
              It stores dealer staff accounts (name, email, role, password hash), dealer company
              details, enquiries submitted by visitors of dealer websites (name, phone, email,
              message) and cached public data of a dealer&apos;s own social media profiles.
            </p>
            <p>
              The portal has no Facebook Login and receives no personal data of Facebook or Instagram
              users. Our Meta app only reads the public data of a dealer&apos;s own Instagram
              business account and displays it on that dealer&apos;s website. We never send any
              personal data to social networks.
            </p>
            <p>
              Enquiries are passed to the dealer they belong to and to that dealer&apos;s CRM if
              connected. Data is not sold or shared with anyone else except where required by law.
            </p>
            <p>
              The portal sets one functional cookie, <code>b2b_session</code>, to keep you signed in.
              No advertising or tracking cookies are used.
            </p>
            <p>
              To access, correct or delete your data, email{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-medium text-avgst-green hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
              . Deletion instructions:{" "}
              <Link href="/delete" className="font-medium text-avgst-green hover:underline">
                b2b.avgst.ru/delete
              </Link>
              .
            </p>
          </div>
        </section>

        <p className="mt-10 text-sm text-muted-foreground">Обновлено: {UPDATED_AT}</p>
      </div>

      <footer className="border-t border-border bg-white">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-5 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8">
          <p>© {new Date().getFullYear()} Авангард Строй · AVGST</p>
          <div className="flex gap-5">
            <Link href="/delete" className="transition hover:text-foreground">
              Удаление данных
            </Link>
            <a href="https://avgst.ru" className="transition hover:text-foreground">
              avgst.ru
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
