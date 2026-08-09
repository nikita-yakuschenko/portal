"use client";

import { useRef, useState } from "react";
import { IconPhotoPlus, IconX } from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ImageUploadFieldProps = {
  id: string;
  label: string;
  hint: string;
  accept: string;
  /** Потолок размера файла: картинка едет в конфиг как data URL */
  maxBytes: number;
  value: string;
  onChange: (dataUrl: string) => void;
  /** Пропорции превью повторяют то, как картинка встанет на сайте */
  shape?: "wide" | "square";
};

/**
 * Плитка загрузки: превью, клик и перетаскивание. Нативный `<input type=file>`
 * скрыт — его «Обзор… Файл не выбран» ломал ряд и не имел ничего общего с
 * остальными контролами.
 */
export function ImageUploadField({
  id,
  label,
  hint,
  accept,
  maxBytes,
  value,
  onChange,
  shape = "wide"
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const hintId = `${id}-hint`;

  function readFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(`${label}: нужен файл-картинка`);
      return;
    }
    if (file.size > maxBytes) {
      toast.error(`${label}: файл слишком большой`, {
        description: `Нужен файл до ${Math.round(maxBytes / 1000)} КБ, а этот ${Math.round(file.size / 1000)} КБ.`
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => toast.error(`${label}: не удалось прочитать файл`);
    reader.readAsDataURL(file);
  }

  function handleRemove(event: React.MouseEvent) {
    event.stopPropagation();
    onChange("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm leading-snug font-medium">
          {label}
        </label>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground size-6"
            onClick={handleRemove}
            aria-label={`Убрать: ${label}`}
          >
            <IconX className="size-4" />
          </Button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          readFile(event.dataTransfer.files?.[0]);
        }}
        aria-describedby={hintId}
        className={cn(
          "bg-muted/30 relative flex w-full items-center justify-center overflow-hidden rounded-lg border border-dashed",
          "transition-[color,background-color,border-color,transform] duration-150 outline-none",
          "hover:border-ring/60 hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "motion-safe:active:scale-[0.98]",
          dragging && "border-ring bg-accent",
          // Одна высота у всех зон: колонки разной ширины, и пропорции
          // разъезжались бы по вертикали
          "h-32"
        )}
      >
        {value ? (
          <img
            src={value}
            alt=""
            className={cn(
              "max-h-full object-contain p-3",
              // Квадратной картинке хватает высоты, широкая тянется по ширине
              shape === "wide" ? "max-w-full" : "max-w-[60%]"
            )}
          />
        ) : (
          <span className="text-muted-foreground flex flex-col items-center gap-1 text-xs">
            <IconPhotoPlus className="size-5" aria-hidden />
            Выбрать файл
          </span>
        )}
      </button>

      <p id={hintId} className="text-muted-foreground text-xs leading-relaxed">
        {hint}
      </p>

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => {
          readFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
