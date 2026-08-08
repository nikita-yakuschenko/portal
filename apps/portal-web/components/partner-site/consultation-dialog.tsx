"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconCheck, IconX } from "@tabler/icons-react";
import { toast } from "sonner";

import { PhoneInput } from "@/components/partner-site/phone-input";
import { ConsultationSocialPhone } from "@/components/partner-site/consultation-social-phone";
import { PartnerSiteSocialGlyph } from "@/components/partner-site/social-icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { technologyBadgeCode } from "@/lib/catalog-display";
import { LEAD_FORMS, type LeadFormKind } from "@/lib/partner-site-lead-forms";
import type { PartnerSiteSocialLink } from "@/lib/partner-site-socials";
import { postLeadSocialCopy, takeNextPostLeadSocial } from "@/lib/partner-site-socials";
import { isValidRuMobile } from "@/lib/ru-phone";
import { cn } from "@/lib/utils";

const inputClass =
  "h-11 rounded-lg border-white/15 bg-white/8 text-white placeholder:text-white/35 shadow-none focus-visible:border-avgst-yellow focus-visible:ring-avgst-yellow/25";

type DialogStep = "form" | "success" | "thanks" | "socials";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function technologyPhrase(technology?: string): string | null {
  if (technology !== "modular" && technology !== "panel_frame") return null;
  return technologyBadgeCode(technology).toLowerCase();
}

function DialogCloseBtn({ onClick }: { onClick?: (() => void) | undefined }) {
  const className =
    "absolute top-4 right-4 z-20 inline-flex size-9 items-center justify-center rounded-lg text-white/45 transition hover:bg-white/8 hover:text-white focus-visible:ring-[3px] focus-visible:ring-white/30 focus-visible:outline-none";
  if (onClick) {
    return (
      <button type="button" className={className} aria-label="Закрыть" onClick={onClick}>
        <IconX className="size-4" stroke={1.75} />
      </button>
    );
  }
  return (
    <DialogClose className={className} aria-label="Закрыть">
      <IconX className="size-4" stroke={1.75} />
    </DialogClose>
  );
}

function BrandAside({
  name,
  address,
  logoDataUrl
}: {
  name: string;
  address: string;
  logoDataUrl: string;
}) {
  return (
    <aside className="relative flex min-h-[18rem] flex-col justify-between overflow-hidden border-t border-white/10 bg-[#161a20] px-7 py-8 sm:px-9 sm:py-9 md:min-h-full md:border-t-0 md:border-l md:border-white/10">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse at 70% 20%, rgba(232,197,71,0.18), transparent 55%), radial-gradient(ellipse at 20% 90%, rgba(255,255,255,0.06), transparent 50%)"
        }}
      />
      <div className="relative">
        {logoDataUrl ? (
          // Тот же логотип, что в шапке — без текста рядом и без обрезки в квадрат
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoDataUrl}
            alt={name || "Логотип"}
            className="h-12 w-auto max-w-[220px] object-contain drop-shadow-sm sm:h-14 sm:max-w-[260px]"
          />
        ) : (
          <p className="text-lg font-extrabold tracking-wide text-white uppercase">
            {name || "Строительная компания"}
          </p>
        )}
      </div>
      {address ? (
        <div className="relative mt-8 border-t border-white/10 pt-5">
          <p className="text-[0.65rem] font-medium tracking-[0.16em] text-white/35 uppercase">
            Адрес
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white/70">{address}</p>
        </div>
      ) : (
        <div className="relative mt-8" />
      )}
    </aside>
  );
}

function ProjectAside({
  imageUrl,
  projectName
}: {
  imageUrl: string;
  projectName?: string | undefined;
}) {
  return (
    <div className="relative min-h-[18rem] overflow-hidden border-t border-white/10 md:min-h-full md:border-t-0 md:border-l md:border-white/10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={projectName ? `Проект «${projectName}»` : "Проект дома"}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent md:bg-gradient-to-l md:from-transparent md:via-black/5 md:to-black/25" />
      {projectName ? (
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          <p className="text-[0.65rem] font-medium tracking-[0.16em] text-white/55 uppercase">
            Ваш проект
          </p>
          <p className="mt-1 text-lg font-bold tracking-tight text-white">{projectName}</p>
        </div>
      ) : null}
    </div>
  );
}

const FACTORY_TOUR_IMAGE = "/landing/factory.jpg";
const AVGST_LOGO = "/logo.svg";

/** Правая колонка формы экскурсии: фото завода + лого AVGST */
function FactoryAside() {
  return (
    <div className="relative min-h-[18rem] overflow-hidden border-t border-white/10 md:min-h-full md:border-t-0 md:border-l md:border-white/10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={FACTORY_TOUR_IMAGE}
        alt="Завод Авангард Строй"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={AVGST_LOGO}
          alt="Авангард Строй"
          className="h-11 w-11 object-contain drop-shadow"
        />
        <p className="mt-3 text-lg font-bold tracking-tight text-white">Авангард Строй</p>
        <p className="mt-1 text-sm leading-relaxed text-white/70">
          Нижний Новгород, ул. Зайцева, 31к1
        </p>
      </div>
    </div>
  );
}

const leftMotion = {
  initial: { opacity: 0, x: -16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 12 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const }
};

/** Фирменный цвет CTA после заявки */
const SOCIAL_CTA_CLASS: Record<string, string> = {
  telegram: "bg-[#2AABEE] text-white hover:bg-[#229ED9]",
  vk: "bg-[#0077FF] text-white hover:bg-[#0066DD]",
  youtube: "bg-[#FF0000] text-white hover:bg-[#E60000]",
  instagram:
    "bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white hover:opacity-95",
  dzen: "bg-[#000000] text-white hover:bg-[#1a1a1a] ring-1 ring-white/20",
  max: "bg-[#7B2BFF] text-white hover:bg-[#6A1FE6]"
};

/**
 * Полоса под кнопками. Место держится во всех вариантах формы, поэтому уровень
 * кнопок одинаков и не зависит от наличия сноски. Сноска идёт в потоке: на узких
 * экранах она поднимает кнопки чуть выше, а не наезжает на них.
 */
function ActionsNote({ note }: { note?: string | undefined }) {
  return <p className="mt-3 min-h-10 text-[0.625rem] leading-[1.35] text-white/40">{note}</p>;
}

export function ConsultationDialog({
  open,
  onOpenChange,
  kind,
  projectName,
  selectionSummary,
  technology,
  projectImageUrl,
  brand,
  postLeadSocialPool,
  onSubmitLead
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: LeadFormKind;
  projectName?: string | undefined;
  selectionSummary?: string | undefined;
  technology?: string | undefined;
  projectImageUrl?: string | undefined;
  brand: {
    name: string;
    address: string;
    logoDataUrl: string;
    /** Сокращённый знак: в круг на QR широкий логотип не влезает */
    faviconDataUrl: string;
  };
  /** Пул для ротации: на каждую заявку берём следующую сеть */
  postLeadSocialPool: PartnerSiteSocialLink[];
  /** Отправка лида на сервер; если нет — только UI-превью */
  onSubmitLead?: (input: {
    customerName: string;
    customerPhone: string;
    message?: string;
  }) => Promise<void>;
}) {
  const form = LEAD_FORMS[kind];
  const isFactoryTour = kind === "factoryTour";
  const [step, setStep] = useState<DialogStep>("form");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [email, setEmail] = useState("");
  const [newsletterConsent, setNewsletterConsent] = useState(true);
  const [offeredSocial, setOfferedSocial] = useState<PartnerSiteSocialLink | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setStep("form");
    setName("");
    setPhone("");
    setPhoneTouched(false);
    setEmail("");
    setNewsletterConsent(true);
    setOfferedSocial(null);
  }

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  // После галочки успеха — на шаг с e-mail (для экскурсии — финальный thanks без апсейла)
  useEffect(() => {
    if (step !== "success") return;
    const timer = window.setTimeout(() => setStep("thanks"), 1100);
    return () => window.clearTimeout(timer);
  }, [step]);

  function close() {
    onOpenChange(false);
  }

  function goAfterThanks() {
    if (offeredSocial) setStep("socials");
    else close();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    setPhoneTouched(true);

    if (!trimmedName) {
      toast.error("Укажите имя");
      return;
    }
    if (!isValidRuMobile(phone)) {
      toast.error("Укажите корректный мобильный номер");
      return;
    }

    const messageParts = [
      form.title,
      projectName ? `Проект: ${projectName}` : "",
      selectionSummary?.trim() ?? ""
    ].filter(Boolean);

    if (onSubmitLead) {
      setSubmitting(true);
      try {
        await onSubmitLead({
          customerName: trimmedName,
          customerPhone: phone,
          message: messageParts.join("\n")
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Не удалось отправить заявку");
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
    }

    setOfferedSocial(
      isFactoryTour ? null : takeNextPostLeadSocial(postLeadSocialPool)
    );
    setStep("success");
  }

  function handleEmailSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isValidEmail(email)) {
      toast.error("Укажите корректный e-mail");
      return;
    }
    if (!newsletterConsent) {
      toast.error("Нужно согласие на рассылку");
      return;
    }
    // Превью: подборка не отправляется на сервер
    toast.success("Отлично, отправим подборку на почту");
    goAfterThanks();
  }

  const techLabel = technologyPhrase(technology);
  const thankCopy = techLabel
    ? `Вы выбрали ${techLabel} дом — пришлём подборку похожих проектов.`
    : "Пришлём подборку интересных проектов на почту.";
  const brandName = brand.name.trim();
  const brandAddress = brand.address.trim();
  const brandLogo = brand.logoDataUrl.trim();
  // Круг на QR-карточке квадратный — тот же выбор, что у favicon вкладки
  const brandMark = brand.faviconDataUrl.trim() || brandLogo;
  // После формы справа — дом, если есть; иначе бренд. Экскурсия — всегда фото завода.
  const showProjectAside =
    !isFactoryTour && Boolean(projectImageUrl) && step !== "form";
  const socialCopy = offeredSocial ? postLeadSocialCopy(offeredSocial.id) : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/70 backdrop-blur-[2px]"
        className={cn(
          // Высота формы фиксирована на всех шагах — телефон НЕ раздувает её.
          // grid-rows-1 обязателен: DialogContent сам является grid, и без него
          // его строка растёт под контент, а фиксированная высота просто режет низ
          "h-[32rem] grid-rows-1 gap-0 overflow-hidden rounded-2xl border border-white/12 bg-[#0f1216] p-0 text-white shadow-2xl ring-0 sm:max-w-lg md:max-w-3xl",
          step === "socials" && "md:!overflow-visible"
        )}
      >
        <div className={cn("relative h-full", step === "socials" && "md:!overflow-visible")}>
          <DialogCloseBtn onClick={step === "form" ? undefined : close} />

          <div
            className={cn(
              // grid-rows-1 = minmax(0, 1fr): без него строка растёт под контент
              // и высокий вариант формы вылезает за фиксированную высоту диалога
              "grid h-full grid-rows-1 md:grid-cols-2",
              step === "socials" && "md:!overflow-visible"
            )}
          >
            {/* Скролл, а не обрезка: с длинным списком выбранных опций иначе
                теряется нижняя часть формы вместе с кнопкой отмены */}
            <div className="flex h-full min-h-0 flex-col overflow-x-hidden overflow-y-auto px-7 py-8 sm:px-9 sm:py-9">
              <AnimatePresence mode="wait" initial={false}>
                {step === "form" ? (
                  <motion.div key="form" {...leftMotion} className="flex h-full w-full flex-col">
                    <DialogHeader className="gap-2 text-left">
                      <DialogTitle className="text-xl font-extrabold tracking-tight text-white uppercase sm:text-2xl">
                        {form.title}
                      </DialogTitle>
                      <DialogDescription className="whitespace-pre-line text-sm leading-relaxed text-white/55">
                        {form.description(projectName)}
                      </DialogDescription>
                      {selectionSummary?.trim() ? (
                        <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-xs leading-relaxed text-white/75">
                          {selectionSummary.trim()}
                        </pre>
                      ) : null}
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="mt-6 flex min-h-0 flex-1 flex-col">
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label
                            htmlFor="consult-name"
                            className="text-[0.7rem] font-medium tracking-[0.14em] text-white/45 uppercase"
                          >
                            Имя
                          </label>
                          <Input
                            id="consult-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Как к вам обращаться"
                            autoComplete="name"
                            required
                            className={cn(inputClass, "h-12")}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label
                            htmlFor="consult-phone"
                            className="text-[0.7rem] font-medium tracking-[0.14em] text-white/45 uppercase"
                          >
                            Телефон
                          </label>
                          <PhoneInput
                            id="consult-phone"
                            value={phone}
                            onChange={setPhone}
                            showError={phoneTouched}
                            onBlur={() => setPhoneTouched(true)}
                            className={cn(inputClass, "h-12")}
                          />
                        </div>
                      </div>

                      <div className="mt-auto pt-6">
                        <Button
                          type="submit"
                          size="lg"
                          disabled={submitting}
                          className="h-12 w-full rounded-lg bg-avgst-yellow text-sm font-bold text-slate-950 hover:bg-avgst-yellow/90"
                        >
                          {submitting ? "Отправка…" : form.submitLabel}
                        </Button>
                        <button
                          type="button"
                          className="mx-auto mt-4 block text-sm text-white/40 transition hover:text-white/70"
                          onClick={close}
                        >
                          Отмена
                        </button>
                        <ActionsNote />
                      </div>
                    </form>
                  </motion.div>
                ) : null}

                {step === "success" ? (
                  <motion.div
                    key="success"
                    {...leftMotion}
                    className="flex h-full w-full flex-col items-center justify-center text-center"
                  >
                    <motion.span
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 320, damping: 18 }}
                      className="inline-flex size-20 items-center justify-center rounded-full bg-avgst-yellow text-slate-950"
                    >
                      <IconCheck className="size-10" stroke={2.5} />
                    </motion.span>
                    <p className="mt-6 text-xl font-extrabold tracking-tight text-white">
                      Заявка отправлена
                    </p>
                    <p className="mt-2 text-sm text-white/50">Секунду…</p>
                  </motion.div>
                ) : null}

                {step === "thanks" && isFactoryTour ? (
                  <motion.div key="thanks-factory" {...leftMotion} className="flex h-full w-full flex-col">
                    <p className="text-[0.68rem] font-semibold tracking-[0.22em] text-avgst-yellow uppercase">
                      Заявка принята
                    </p>
                    <DialogTitle className="mt-3 text-[1.7rem] leading-tight font-extrabold tracking-tight text-white sm:text-[1.85rem]">
                      Спасибо за заявку
                    </DialogTitle>
                    <DialogDescription className="mt-3 max-w-md text-[0.95rem] leading-relaxed text-white/55">
                      Мы согласуем с заводом дату экскурсии в Нижнем Новгороде и
                      свяжемся с вами.
                    </DialogDescription>

                    <div className="mt-auto pt-6">
                      <Button
                        type="button"
                        size="lg"
                        className="h-12 w-full rounded-lg bg-avgst-yellow text-sm font-bold text-slate-950 hover:bg-avgst-yellow/90"
                        onClick={close}
                      >
                        Закрыть
                      </Button>
                      <ActionsNote />
                    </div>
                  </motion.div>
                ) : null}

                {step === "thanks" && !isFactoryTour ? (
                  <motion.div key="thanks" {...leftMotion} className="flex h-full w-full flex-col">
                    <p className="text-[0.68rem] font-semibold tracking-[0.22em] text-avgst-yellow uppercase">
                      Спасибо
                    </p>
                    <DialogTitle className="mt-3 text-[1.7rem] leading-tight font-extrabold tracking-tight text-white sm:text-[1.85rem]">
                      Спасибо за заявку
                    </DialogTitle>
                    <DialogDescription className="mt-3 max-w-md text-[0.95rem] leading-relaxed text-white/55">
                      {thankCopy}
                    </DialogDescription>

                    <form onSubmit={handleEmailSubmit} className="mt-7 flex min-h-0 flex-1 flex-col">
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label
                            htmlFor="consult-email"
                            className="text-[0.7rem] font-medium tracking-[0.14em] text-white/45 uppercase"
                          >
                            E-mail
                          </label>
                          <Input
                            id="consult-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@example.com"
                            autoComplete="email"
                            className={cn(inputClass, "h-12")}
                          />
                        </div>

                        <label className="flex cursor-pointer items-start gap-3">
                          <Checkbox
                            checked={newsletterConsent}
                            onCheckedChange={(value) => setNewsletterConsent(value === true)}
                            className="mt-0.5 border-white/30 bg-white/5 data-[state=checked]:border-avgst-yellow data-[state=checked]:bg-avgst-yellow data-[state=checked]:text-slate-950"
                          />
                          <span className="text-sm leading-snug text-white/55">
                            Согласен получать подборку проектов и новости на e-mail
                          </span>
                        </label>
                      </div>

                      <div className="mt-auto pt-6">
                        <Button
                          type="submit"
                          size="lg"
                          className="h-12 w-full rounded-lg bg-avgst-yellow text-sm font-bold text-slate-950 hover:bg-avgst-yellow/90"
                        >
                          Прислать подборку
                        </Button>
                        <button
                          type="button"
                          className="mx-auto mt-4 block text-sm text-white/40 transition hover:text-white/70"
                          onClick={goAfterThanks}
                        >
                          Нет, спасибо
                        </button>
                        <ActionsNote />
                      </div>
                    </form>
                  </motion.div>
                ) : null}

                {step === "socials" && offeredSocial && socialCopy ? (
                  <motion.div key="socials" {...leftMotion} className="flex h-full w-full flex-col">
                    <p className="text-[0.68rem] font-semibold tracking-[0.22em] text-avgst-yellow uppercase">
                      {socialCopy.eyebrow}
                    </p>
                    <DialogTitle className="mt-3 text-[1.7rem] leading-tight font-extrabold tracking-tight text-white sm:text-[1.85rem]">
                      {socialCopy.title}
                    </DialogTitle>
                    <DialogDescription className="mt-3 max-w-md text-[0.95rem] leading-relaxed text-white/55">
                      {socialCopy.description}
                    </DialogDescription>

                    <div className="mt-auto pt-6">
                      <Button
                        asChild
                        size="lg"
                        className={cn(
                          "h-12 w-full rounded-lg text-sm font-bold",
                          SOCIAL_CTA_CLASS[offeredSocial.id] ??
                            "bg-[#2AABEE] text-white hover:bg-[#229ED9]"
                        )}
                      >
                        <a
                          href={offeredSocial.href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-2.5"
                          onClick={() => {
                            window.setTimeout(() => close(), 0);
                          }}
                        >
                          <PartnerSiteSocialGlyph id={offeredSocial.id} className="size-5" />
                          {socialCopy.cta}
                        </a>
                      </Button>
                      <button
                        type="button"
                        className="mx-auto mt-4 block text-sm text-white/40 transition hover:text-white/70"
                        onClick={close}
                      >
                        Нет, спасибо
                      </button>
                      <ActionsNote note={socialCopy.note} />
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            {/* На мобилке только форма — без правой колонки с фото/брендом */}
            <div className="hidden h-full min-h-0 md:block">
              {step === "socials" && offeredSocial ? (
                <ConsultationSocialPhone
                  social={offeredSocial}
                  brandName={brandName}
                  brandLogo={brandMark}
                  projectImageUrl={projectImageUrl}
                  projectName={projectName}
                />
              ) : isFactoryTour ? (
                <FactoryAside />
              ) : showProjectAside && projectImageUrl ? (
                <ProjectAside imageUrl={projectImageUrl} projectName={projectName} />
              ) : (
                <BrandAside name={brandName} address={brandAddress} logoDataUrl={brandLogo} />
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
