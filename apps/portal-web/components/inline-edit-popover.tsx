"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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

  function measureTrigger() {
    // display:contents — у самого span box нет, меряем дочерний узел
    const el = triggerRef.current?.firstElementChild ?? triggerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { top: rect.bottom + 6, left: rect.left };
  }

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }
    setPanelPos(measureTrigger());
  }, [open]);

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
      setPanelPos(measureTrigger());
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
  }, [open]);

  async function commit() {
    const next = draft.trim();
    if (next === String(value ?? "").trim()) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      await onCommit(next);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

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
          enabled && open && "[&>*]:bg-muted/60 [&>*]:ring-primary/30 [&>*]:ring-2"
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
              className="bg-popover text-popover-foreground fixed z-50 flex min-w-[12rem] items-center gap-1 rounded-lg border p-1.5 shadow-md"
              style={{ top: panelPos.top, left: panelPos.left }}
            >
              {options ? (
                <Select
                  value={draft || options[0]?.value || ""}
                  onValueChange={setDraft}
                >
                  <SelectTrigger className="h-8 min-w-[10rem] flex-1" aria-label={ariaLabel}>
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
                  className="h-8 min-w-[8rem] flex-1"
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void commit();
                    }
                  }}
                />
              )}
              <Button
                type="button"
                size="icon-sm"
                disabled={saving}
                aria-label="Сохранить"
                onClick={() => void commit()}
              >
                {saving ? <Spinner className="size-3.5" /> : <IconCheck className="size-4" />}
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                disabled={saving}
                aria-label="Отменить"
                onClick={() => setOpen(false)}
              >
                <IconX className="size-4" />
              </Button>
            </div>,
            document.body
          )
        : null}
    </span>
  );
}
