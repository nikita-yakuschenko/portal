"use client";

import { useRef } from "react";

import { Input } from "@/components/ui/input";
import {
  caretAfterNationalDigits,
  extractRuMobileNational,
  formatRuMobileDisplay,
  nationalDigitsBeforeCaret,
  ruMobileError
} from "@/lib/ru-phone";
import { cn } from "@/lib/utils";

type PhoneInputProps = {
  id?: string;
  value: string;
  onChange: (nationalDigits: string) => void;
  onBlur?: () => void;
  className?: string;
  disabled?: boolean;
  /** Показать ошибку (после blur / submit) */
  showError?: boolean;
  "aria-invalid"?: boolean;
};

/**
 * Поле российского мобильного: префилл +7, type=tel, автонормализация 8/+7,
 * маска и сохранение позиции курсора при правках.
 */
export function PhoneInput({
  id,
  value,
  onChange,
  onBlur,
  className,
  disabled,
  showError = false,
  "aria-invalid": ariaInvalid
}: PhoneInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const display = formatRuMobileDisplay(value);
  const error = showError ? ruMobileError(value) : null;

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const el = event.target;
    const caret = el.selectionStart ?? el.value.length;
    const digitsBefore = nationalDigitsBeforeCaret(el.value, caret);

    const nextNational = extractRuMobileNational(el.value);
    onChange(nextNational);

    const nextDisplay = formatRuMobileDisplay(nextNational);
    requestAnimationFrame(() => {
      const node = inputRef.current;
      if (!node) return;
      const nextCaret = caretAfterNationalDigits(nextDisplay, digitsBefore);
      node.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    const el = event.currentTarget;
    const caret = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? caret;

    // Не даём стереть префикс +7 целиком — оставляем пустую национальную часть
    if ((event.key === "Backspace" || event.key === "Delete") && caret <= 3 && end <= 3) {
      if (!extractRuMobileNational(el.value)) {
        event.preventDefault();
      }
    }
  }

  return (
    <div className="space-y-1.5">
      <Input
        ref={inputRef}
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        autoCorrect="off"
        spellCheck={false}
        disabled={disabled}
        value={display}
        placeholder="+7 (9XX) XXX-XX-XX"
        aria-invalid={ariaInvalid || Boolean(error)}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={onBlur}
        className={cn(className, error && "border-red-400/80 focus-visible:border-red-400")}
      />
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
