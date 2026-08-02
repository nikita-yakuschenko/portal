/** Фиксированные виды заявочных форм на партнёрском сайте */

export type LeadFormKind =
  | "consultation"
  | "quote"
  | "question"
  | "contact"
  | "factoryTour";

export const LEAD_FORMS: Record<
  LeadFormKind,
  {
    title: string;
    description: (projectName?: string) => string;
    /** CTA на первом шаге */
    submitLabel: string;
  }
> = {
  consultation: {
    title: "Получить консультацию",
    description: (projectName) =>
      projectName
        ? `Оставьте контакты — перезвоним по проекту «${projectName}».`
        : "Оставьте имя и телефон — перезвоним и ответим на вопросы.",
    submitLabel: "Отправить"
  },
  quote: {
    title: "Получить расчёт",
    description: (projectName) =>
      projectName
        ? `Оставьте контакты — подготовим расчёт по проекту «${projectName}».`
        : "Оставьте имя и телефон — подготовим расчёт и перезвоним.",
    submitLabel: "Отправить"
  },
  question: {
    title: "Задать вопрос",
    description: () => "Оставьте имя и телефон — перезвоним и ответим на вопросы.",
    submitLabel: "Отправить"
  },
  contact: {
    title: "Связаться",
    description: () => "Оставьте имя и телефон — свяжемся с вами в ближайшее время.",
    submitLabel: "Отправить"
  },
  factoryTour: {
    title: "Экскурсия на завод",
    description: () =>
      "Завод находится в Нижнем Новгороде\nОставьте заявку — мы согласуем с заводом дату экскурсии.",
    submitLabel: "Записаться"
  }
};
