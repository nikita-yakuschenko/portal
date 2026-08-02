/**
 * Российский мобильный номер (DEF 9xx).
 * Национальная часть — 10 цифр, начинается с 9; E.164: +7XXXXXXXXXX.
 * @see https://ru.wikipedia.org/wiki/Телефонный_план_нумерации_России
 */

const MOBILE_NATIONAL = /^9\d{9}$/;

/** Только цифры из произвольной строки */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Извлекает до 10 цифр национальной части.
 * Пропускает уже введённый код страны: +7 / 7 / 8 (в т.ч. при вставке).
 */
export function extractRuMobileNational(raw: string): string {
  let digits = digitsOnly(raw);

  // 8XXXXXXXXXX или 7XXXXXXXXXX → национальные 10 цифр
  while (digits.length >= 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
    digits = digits.slice(1);
  }

  // Остался «лишний» ведущий 7/8 при длине 10 (ввели код без полного номера)
  if (digits.length === 10 && (digits.startsWith("7") || digits.startsWith("8"))) {
    const rest = digits.slice(1);
    if (rest.startsWith("9")) {
      digits = rest;
    }
  }

  // Одиночный/короткий ввод кода 7 или 8 — игнорируем
  if (digits === "7" || digits === "8") {
    return "";
  }
  if ((digits.startsWith("7") || digits.startsWith("8")) && digits.length < 10) {
    digits = digits.slice(1);
  }

  return digits.slice(0, 10);
}

/** Отображение: +7 (999) 123-45-67 — можно править с любой позиции */
export function formatRuMobileDisplay(national: string): string {
  const d = extractRuMobileNational(national).slice(0, 10);
  if (!d) return "+7 ";

  const p1 = d.slice(0, 3);
  const p2 = d.slice(3, 6);
  const p3 = d.slice(6, 8);
  const p4 = d.slice(8, 10);

  let out = "+7";
  if (p1) {
    out += ` (${p1}`;
    if (p1.length === 3) out += ")";
  }
  if (p2) out += ` ${p2}`;
  if (p3) out += `-${p3}`;
  if (p4) out += `-${p4}`;
  return out;
}

export function isValidRuMobile(national: string): boolean {
  return MOBILE_NATIONAL.test(extractRuMobileNational(national));
}

export function toRuMobileE164(national: string): string | null {
  const d = extractRuMobileNational(national);
  if (!MOBILE_NATIONAL.test(d)) return null;
  return `+7${d}`;
}

export function ruMobileError(national: string): string | null {
  const d = extractRuMobileNational(national);
  if (!d) return "Укажите номер телефона";
  if (d.length < 10) return "Введите номер полностью: +7 (9XX) XXX-XX-XX";
  if (!d.startsWith("9")) return "Мобильный номер в России начинается с 9";
  if (!MOBILE_NATIONAL.test(d)) return "Проверьте номер телефона";
  return null;
}

/** Сколько цифр национальной части стоит слева от caret в отформатированной строке */
export function nationalDigitsBeforeCaret(formatted: string, caret: number): number {
  const left = formatted.slice(0, Math.max(0, caret));
  // После «+7» считаем только цифры национальной части
  const withoutCountry = left.replace(/^\+7/, "");
  return digitsOnly(withoutCountry).length;
}

/** Позиция caret в отформатированной строке после N национальных цифр */
export function caretAfterNationalDigits(formatted: string, digitCount: number): number {
  if (digitCount <= 0) {
    if (formatted.startsWith("+7 ")) return 3;
    if (formatted.startsWith("+7")) return 2;
    return formatted.length;
  }

  let seen = 0;
  for (let i = 0; i < formatted.length; i += 1) {
    // Цифра «7» в префиксе +7 не входит в национальную часть
    if (i < 2 && formatted.startsWith("+7")) continue;
    if (/\d/.test(formatted[i]!)) {
      seen += 1;
      if (seen === digitCount) return i + 1;
    }
  }
  return formatted.length;
}
