"use client";

import { IconChevronLeft, IconChevronRight, IconX } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export type ViewerItem = {
  id: string;
  sourceUrl: string;
  label: string;
};

/** Полноэкранный просмотр изображения со стрелками и счётчиком */
export function ProjectMediaViewer({
  items,
  index,
  open,
  title,
  onIndexChange,
  onOpenChange
}: {
  items: ViewerItem[];
  index: number;
  open: boolean;
  title: string;
  onIndexChange: (next: number) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const current = items[index] ?? items[0];

  function step(delta: number) {
    if (items.length < 2) return;
    onIndexChange((index + delta + items.length) % items.length);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/90"
        aria-describedby={undefined}
        className="fixed inset-0 top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-transparent p-0 shadow-none sm:max-w-none"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            step(-1);
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            step(1);
          }
        }}
      >
        <DialogTitle className="sr-only">Просмотр фото — {title}</DialogTitle>

        <div className="relative flex min-h-0 flex-1 items-center justify-center p-4 sm:p-10">
          {current ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={current.sourceUrl}
              alt={current.label}
              className="max-h-full max-w-full object-contain select-none"
            />
          ) : null}

          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute top-4 right-4 z-10 size-10 rounded-full"
            onClick={() => onOpenChange(false)}
            aria-label="Закрыть просмотр"
          >
            <IconX className="size-5" />
          </Button>

          {items.length > 1 ? (
            <>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute top-1/2 left-3 z-10 size-10 -translate-y-1/2 rounded-full sm:left-6"
                onClick={() => step(-1)}
                aria-label="Предыдущее фото"
              >
                <IconChevronLeft className="size-5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute top-1/2 right-3 z-10 size-10 -translate-y-1/2 rounded-full sm:right-6"
                onClick={() => step(1)}
                aria-label="Следующее фото"
              >
                <IconChevronRight className="size-5" />
              </Button>
              <p className="text-background absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm tabular-nums backdrop-blur">
                {index + 1} / {items.length}
              </p>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
