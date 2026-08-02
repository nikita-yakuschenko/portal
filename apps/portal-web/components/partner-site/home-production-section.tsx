"use client";

import { Button } from "@/components/ui/button";
import { FactoryVideo } from "@/components/factory-video";
import { usePartnerSitePreview } from "@/components/partner-site/preview-context";

const FACTORY_IMAGE = "/landing/factory.jpg";

/** Блок производства на главной — между каталогом и контактами */
export function HomeProductionSection() {
  const { openLeadForm } = usePartnerSitePreview();

  return (
    <section className="border-t border-slate-200/80 bg-[#F5F6F8]">
      {/*
        Мобилка: flex + order (заголовок → видео → текст).
        Десктоп: 2 колонки без row-span — иначе высота видео раздувает
        промежуток между заголовком и текстом справа.
      */}
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-14 md:grid md:grid-cols-2 md:items-start md:gap-12 md:py-16">
        <div className="contents md:col-start-2 md:flex md:flex-col">
          <header>
            <p className="text-xs font-bold tracking-[0.2em] text-avgst-green uppercase">
              Производство
            </p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight uppercase md:text-3xl">
              Завод Авангард Строй
            </h2>
          </header>

          <div className="order-3 md:order-none md:mt-4">
            <p className="max-w-xl text-base leading-relaxed text-slate-600">
              Домокомплекты изготавливают на заводе в Нижнем Новгороде: раскрой,
              покраска, сборка панелей и стропильных ферм. На экскурсии можно
              пройти по цехам и увидеть линию в работе.
            </p>

            <ul className="mt-6 space-y-2.5 text-sm text-slate-700">
              <li className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-avgst-green" />
                Линия с обрабатывающим центром с ЧПУ
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-avgst-green" />
                Форматно-раскроечный участок плитных обшивок
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-avgst-green" />
                Портальные линии окрашивания
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-avgst-green" />
                Линия производства строительных ферм
              </li>
            </ul>

            <Button
              type="button"
              size="lg"
              className="mt-8 h-10 w-fit rounded-md bg-avgst-yellow px-5 text-sm font-semibold text-slate-950 hover:bg-avgst-yellow/90"
              onClick={() => openLeadForm({ kind: "factoryTour" })}
            >
              Записаться на экскурсию
            </Button>
          </div>
        </div>

        <div className="order-2 md:col-start-1 md:row-start-1">
          <FactoryVideo
            variant="responsive"
            src={FACTORY_IMAGE}
            alt="Производство модульных и каркасных домов"
          />
        </div>
      </div>
    </section>
  );
}
