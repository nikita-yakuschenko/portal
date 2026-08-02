/** Фиксированные виды заявочных форм на партнёрском сайте */

export type LeadFormKind = "consultation" | "quote" | "question" | "contact";

export const LEAD_FORMS: Record<
  LeadFormKind,
  {
    title: string;
    description: (projectName?: string) => string;
  }
> = {
  consultation: {
    title: "Получить консультацию",
    description: (projectName) =>
      projectName
        ? `Оставьте контакты — перезвоним по проекту «${projectName}».`
        : "Оставьте имя и телефон — перезвоним и ответим на вопросы."
  },
  quote: {
    title: "Получить расчёт",
    description: (projectName) =>
      projectName
        ? `Оставьте контакты — подготовим расчёт по проекту «${projectName}».`
        : "Оставьте имя и телефон — подготовим расчёт и перезвоним."
  },
  question: {
    title: "Задать вопрос",
    description: () => "Оставьте имя и телефон — перезвоним и ответим на вопросы."
  },
  contact: {
    title: "Связаться",
    description: () => "Оставьте имя и телефон — свяжемся с вами в ближайшее время."
  }
};
