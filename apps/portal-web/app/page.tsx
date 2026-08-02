import Link from "next/link";

import { cabinetHomeForRole, getSessionUser } from "../components/auth-gate";
import { FactoryVideo } from "../components/factory-video";
import { LandingHeader } from "../components/landing-header";
import { LandingSnap } from "../components/landing-snap";

const HERO_IMAGE = "/landing/hero.jpg";
const FACTORY_IMAGE = "/landing/factory.jpg";

const highlights = [
  { icon: "/landing/icons/factory.svg", title: "8000 м² производственных мощностей" },
  { icon: "/landing/icons/tour.svg", title: "Своё архитектурное и конструкторское бюро" },
  { icon: "/landing/icons/price.svg", title: "Большой выбор проектов" },
  { icon: "/landing/icons/families.svg", title: "Индивидуальные изменения" }
];

const advantages = [
  {
    title: "Маржа до 15%",
    text: "Доход дилера считается от розничной стоимости дома — прозрачная модель без скрытых условий."
  },
  {
    title: "Завод 8000 м²",
    text: "Собственное производство в Нижнем Новгороде: до 30 модульных домов в месяц и контроль качества на каждом этапе."
  },
  {
    title: "Сборка за 1–2 дня",
    text: "Prefab-технология: коммуникации и отделка готовятся на заводе, на участке остаётся быстрый монтаж."
  },
  {
    title: "Каталог и поддержка",
    text: "Готовые проекты, бюро дизайна, техническая и маркетинговая поддержка для дилеров завода."
  }
];

const portalFeatures = [
  {
    title: "Каталог с завода",
    text: "Актуальные проекты, цены и материалы без ручной выгрузки."
  },
  {
    title: "Лиды и CRM",
    text: "Заявки клиентов и связка с вашей amoCRM / Bitrix24."
  },
  {
    title: "Команда партнёра",
    text: "Сотрудники, роли и рабочий контур дилера в одном месте."
  }
];

const regions = [
  "Москва",
  "Санкт-Петербург",
  "Нижний Новгород",
  "Самара",
  "Воронеж",
  "Иркутск",
  "Ярославль",
  "Ростов-на-Дону"
];

export default async function HomePage() {
  const user = await getSessionUser();
  const cabinetHref = user ? cabinetHomeForRole(user.role) : null;

  return (
    <main className="bg-background text-foreground">
      <LandingSnap />
      <LandingHeader user={user} />

      <section className="landing-snap-section relative min-h-svh overflow-hidden text-white">
        {/* Full-bleed: низ кадра к низу hero + лёгкий zoom снизу — дом выше в экране */}
        <img
          src={HERO_IMAGE}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full origin-bottom scale-[1.12] object-cover object-bottom"
        />
        <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(18,20,15,0.88)_0%,rgba(18,20,15,0.62)_42%,rgba(18,20,15,0.28)_72%,rgba(18,20,15,0.18)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(252,201,12,0.1),transparent_42%)]" />

        <div className="relative z-10 mx-auto flex min-h-svh max-w-7xl flex-col justify-end px-5 pb-10 pt-28 md:px-8 md:pb-14">
          <div className="max-w-xl md:max-w-3xl lg:max-w-4xl">
          <h1 className="landing-rise font-semibold leading-[1.1] tracking-tight">
            <span className="block text-2xl text-white/90 sm:text-3xl md:text-4xl md:whitespace-nowrap">
              Партнёрский портал
            </span>
            <span className="mt-2 block text-4xl sm:text-5xl md:text-[3.2rem] lg:text-[3.5rem] md:whitespace-nowrap">
              Авангард Строй
            </span>
          </h1>
          <div className="landing-line mt-5 h-px w-28 bg-avgst-yellow" />
          <p className="landing-rise landing-rise-delay-1 mt-5 max-w-xl text-base leading-relaxed text-white/80 md:max-w-2xl md:text-lg">
            Единое пространство для работы с проектами домов: каталог, актуальные цены,
            комплектации, материалы для продаж и сопровождение заказов.
          </p>
          <div className="landing-rise landing-rise-delay-2 mt-7 flex flex-wrap items-center gap-3">
            {cabinetHref ? (
              <Link
                href={cabinetHref}
                className="inline-flex h-11 items-center rounded-lg bg-avgst-green px-5 text-sm font-semibold text-white transition hover:bg-avgst-green-hover"
              >
                Перейти в кабинет
              </Link>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="inline-flex h-11 items-center rounded-lg bg-avgst-green px-5 text-sm font-semibold text-white transition hover:bg-avgst-green-hover"
                >
                  Стать дилером
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-11 items-center rounded-lg border border-white/30 bg-white/5 px-5 text-sm font-semibold text-white backdrop-blur-sm transition hover:border-white/50 hover:bg-white/10"
                >
                  Войти в кабинет
                </Link>
              </>
            )}
          </div>
          </div>
        </div>
      </section>

      <section className="landing-snap-section border-y border-border bg-white">
        <div className="mx-auto flex max-w-7xl flex-col md:flex-row md:items-start">
          {highlights.map((item, index) => (
            <div key={item.title} className="contents">
              {index > 0 ? (
                <div
                  aria-hidden
                  className="mx-auto h-px w-8 bg-border md:mx-0 md:h-8 md:w-px md:shrink-0 md:self-center"
                />
              ) : null}
              <div className="flex flex-1 items-start gap-3 px-5 py-6 md:px-8 md:py-7">
                <img
                  src={item.icon}
                  alt=""
                  width={28}
                  height={28}
                  className="mt-0.5 h-7 w-7 shrink-0"
                />
                <p className="text-[15px] font-medium leading-snug text-foreground">
                  {item.title}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="factory" className="landing-snap-section mx-auto grid max-w-7xl gap-8 px-5 py-12 md:grid-cols-2 md:items-start md:gap-10 md:px-8 md:py-16">
        <FactoryVideo
          src={FACTORY_IMAGE}
          alt="Производство модульных домов Авангард Строй"
        />
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-avgst-green">Завод</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Современное производство в&nbsp;Нижнем Новгороде
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg">
            Мы строим каркасные и модульные дома с 2014 года. Дилеру не нужно держать склад и цех:
            конструкции, коммуникации и отделка готовятся на заводе, а вы работаете с клиентом в своём регионе.
          </p>
          <dl className="mt-10 grid grid-cols-3 gap-4 rounded-xl border border-border bg-white p-5 shadow-sm">
            <div>
              <dt className="text-2xl font-semibold md:text-3xl">10+</dt>
              <dd className="mt-1 text-sm text-muted-foreground">лет на рынке</dd>
            </div>
            <div>
              <dt className="text-2xl font-semibold md:text-3xl">3500+</dt>
              <dd className="mt-1 text-sm text-muted-foreground">построенных домов</dd>
            </div>
            <div>
              <dt className="text-2xl font-semibold md:text-3xl">30</dt>
              <dd className="mt-1 text-sm text-muted-foreground">домов в месяц</dd>
            </div>
          </dl>
        </div>
      </section>

      <section id="advantages" className="landing-snap-section border-y border-border bg-white">
        <div className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-avgst-green">
            Для дилеров
          </p>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">
            Почему с нами работают дилеры
          </h2>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
            Вы продаёте — мы производим. Без своего цеха, со складом на заводе и понятной маржой.
          </p>

          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {advantages.map((item, index) => (
              <article
                key={item.title}
                className="rounded-xl border border-border bg-card p-6 shadow-sm"
              >
                <p className="text-xs tracking-[0.18em] text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-3 text-xl font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-white">
        <div className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-avgst-green">
                Портал
              </p>
              <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
                Всё, что раньше разъезжалось по чатам — в одном кабинете
              </h2>
            </div>
            <Link
              href={cabinetHref ?? "/login"}
              className="inline-flex h-10 items-center rounded-lg border border-border bg-white px-4 text-sm font-medium shadow-sm transition hover:bg-secondary"
            >
              {user ? "Перейти в кабинет" : "Войти в кабинет"}
            </Link>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {portalFeatures.map((feature) => (
              <article
                key={feature.title}
                className="rounded-xl border border-border bg-background p-6"
              >
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-20">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-avgst-green">
          Сеть
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
          Дилеры завода уже работают по всей России
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
          Подключаем компании в регионах к производству, каталогу и кабинету дилера.
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          {regions.map((region) => (
            <span
              key={region}
              className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-muted-foreground shadow-sm"
            >
              {region}
            </span>
          ))}
        </div>
      </section>

      <section id="partner" className="landing-snap-section relative overflow-hidden bg-avgst-graphite text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(252,201,12,0.18),transparent_40%)]" />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-5 py-20 md:flex-row md:items-end md:justify-between md:px-8 md:py-28">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-avgst-yellow">
              Открыт набор
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
              Станьте дилером завода в своём регионе
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/75 md:text-lg">
              Расскажем про условия партнёрства, территорию и доступ в кабинет дилера.
            </p>
          </div>
          <Link
            href={cabinetHref ?? "/signup"}
            className="inline-flex h-11 shrink-0 items-center rounded-lg bg-avgst-green px-7 text-sm font-semibold text-white transition hover:bg-avgst-green-hover"
          >
            {user ? "Перейти в кабинет" : "Стать дилером"}
          </Link>
        </div>
      </section>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8">
          <p>© {new Date().getFullYear()} Авангард Строй · AVGST</p>
          <div className="flex gap-5">
            <a href="https://avgst.ru/dealers" className="transition hover:text-foreground">
              Старый раздел дилеров
            </a>
            <a href="https://avgst.ru" className="transition hover:text-foreground">
              avgst.ru
            </a>
            <Link
              href={cabinetHref ?? "/login"}
              className="transition hover:text-foreground"
            >
              {user ? user.fullName || "Кабинет" : "Войти в кабинет"}
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
