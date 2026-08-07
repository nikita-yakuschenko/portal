"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";
import { IconCheck, IconX } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type SelectOption = { value: string; label: string };

function inputWidth(value: string, placeholder: string | undefined, type: "text" | "number") {
  const visibleValue = value || placeholder || "";
  const minChars = type === "number" ? 1 : 6;
  const maxChars = type === "number" ? 16 : 32;
  return Math.min(maxChars, Math.max(minChars, visibleValue.length));
}

type InlineEditPopoverProps = {
  /** false — только display, клик не открывает редактор */
  enabled: boolean;
  display: ReactNode;
  value: string;
  onCommit: (next: string) => Promise<void> | void;
  inputType?: "text" | "number";
  options?: SelectOption[];
  placeholder?: string;
  ariaLabel: string;
  /** end — панель по правому краю триггера (растёт влево, удобно у правого края экрана) */
  align?: "start" | "end";
  /** Одинаковая ширина поля для компактных характеристик карточки */
  compact?: boolean;
  className?: string;
};

/** Клик по значению → панель в portal (разметку display не раздувает) */
export function InlineEditPopover({
  enabled,
  display,
  value,
  onCommit,
  inputType = "text",
  options,
  placeholder,
  ariaLabel,
  align = "start",
  compact = false,
  className
}: InlineEditPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!enabled) setOpen(false);
  }, [enabled]);

  useEffect(() => {
    if (!open) setDraft(value);
  }, [value, open]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector("input")?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open]);

  const measurePanelPos = useCallback(() => {
    // display:contents — у самого span box нет, меряем дочерний узел
    const el = triggerRef.current?.firstElementChild ?? triggerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const top = rect.bottom + 6;
    const margin = 8;
    const panelW = panelRef.current?.offsetWidth ?? 160;
    let left = align === "end" ? rect.right - panelW : rect.left;
    left = Math.max(margin, Math.min(left, window.innerWidth - panelW - margin));
    return { top, left };
  }, [align]);

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }
    // первый проход — грубая позиция; после paint уточняем по ширине панели
    setPanelPos(measurePanelPos());
    const raf = window.requestAnimationFrame(() => {
      setPanelPos(measurePanelPos());
    });
    return () => window.cancelAnimationFrame(raf);
  }, [open, draft, options, measurePanelPos]);

  useEffect(() => {
    if (!open) return;

    function onDoc(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function onReposition() {
      setPanelPos(measurePanelPos());
    }

    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open, measurePanelPos]);

  async function commit() {
    const next = draft.trim();
    // Всегда шлём onCommit: даже без смены значения нужно выставить sync-override
    setSaving(true);
    try {
      await onCommit(next);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const actions = (
    <>
      <Button
        type="button"
        size="icon-xs"
        variant="default"
        className="rounded-full"
        disabled={saving}
        aria-label="Сохранить"
        title="Сохранить"
        onClick={() => void commit()}
      >
        {saving ? <Spinner className="size-3" /> : <IconCheck className="size-3.5" />}
      </Button>
      <Button
        type="button"
        size="icon-xs"
        variant="destructive"
        className="rounded-full"
        disabled={saving}
        aria-label="Отменить"
        title="Отменить"
        onClick={() => setOpen(false)}
      >
        <IconX className="size-3.5" />
      </Button>
    </>
  );

  const field = options ? (
    <Select value={draft || options[0]?.value || ""} onValueChange={setDraft}>
      <SelectTrigger
        size="sm"
        className="bg-muted/50 h-7 w-auto max-w-[min(20rem,calc(100vw-6rem))] rounded-full border-0 px-2 text-xs shadow-none focus-visible:ring-0"
        aria-label={ariaLabel}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : (
    <Input
      type={inputType}
      min={inputType === "number" ? 0 : undefined}
      value={draft}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className="h-7 min-w-0 max-w-[min(32rem,calc(100vw-6rem))] flex-none rounded-none border-0 bg-transparent px-1.5 text-sm shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
      style={{
        width: compact
          ? "3.5rem"
          : `calc(${inputWidth(draft, placeholder, inputType)}ch + 0.75rem)`
      }}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void commit();
        }
      }}
    />
  );

  // contents — обёртка не участвует в layout, размер = размер display
  return (
    <span className={cn("contents", className)}>
      <span
        ref={triggerRef}
        role={enabled ? "button" : undefined}
        tabIndex={enabled ? 0 : undefined}
        aria-label={enabled ? `Изменить: ${ariaLabel}` : undefined}
        aria-expanded={enabled ? open : undefined}
        aria-controls={enabled && open ? panelId : undefined}
        className={cn(
          "contents",
          enabled && "[&>*]:cursor-pointer",
          enabled && "[&>*]:rounded-sm [&>*:hover]:bg-muted/60",
          enabled && open && "[&>*]:bg-muted/60 [&>*]:shadow-sm"
        )}
        onClick={
          enabled
            ? () => {
                setDraft(value);
                setOpen((prev) => !prev);
              }
            : undefined
        }
        onKeyDown={
          enabled
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setDraft(value);
                  setOpen((prev) => !prev);
                }
              }
            : undefined
        }
      >
        {display}
      </span>

      {enabled && open && panelPos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-label={ariaLabel}
              className="bg-background/95 text-popover-foreground fixed z-50 flex w-fit max-w-[calc(100vw-1rem)] items-center gap-1 rounded-full border border-black/5 p-1 shadow-md backdrop-blur dark:border-white/10"
              style={{ top: panelPos.top, left: panelPos.left }}
            >
              {/* align=end: кнопки слева + панель у правого края триггера */}
              {align === "end" ? (
                <>
                  {actions}
                  {field}
                </>
              ) : (
                <>
                  {field}
                  {actions}
                </>
              )}
            </div>,
            document.body
          )
        : null}
    </span>
  );
}
