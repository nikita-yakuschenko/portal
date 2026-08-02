/** Модули партнёрского кабинета. Пока — localStorage; позже уедут в API. */

const LEADS_KEY = "avgst.partner.module.leads";
export const PARTNER_MODULES_CHANGED = "partner-modules-changed";

export type PartnerModules = {
  /** Модуль «Лиды» — по умолчанию выключен */
  leadsEnabled: boolean;
};

export function readPartnerModules(): PartnerModules {
  if (typeof window === "undefined") {
    return { leadsEnabled: false };
  }
  return {
    leadsEnabled: window.localStorage.getItem(LEADS_KEY) === "1"
  };
}

export function setLeadsModuleEnabled(enabled: boolean) {
  window.localStorage.setItem(LEADS_KEY, enabled ? "1" : "0");
  window.dispatchEvent(new Event(PARTNER_MODULES_CHANGED));
}
