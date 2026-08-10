"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from "@/components/ui/dialog";

export const DEALER_SUNSET_NOTICE_KEY = "avgst.dealerGuest.sunsetNotice";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** Пометить, что после входа нужно показать уведомление о переезде */
export function markDealerSunsetNotice(): void {
  try {
    sessionStorage.setItem(DEALER_SUNSET_NOTICE_KEY, "1");
  } catch {
    // private mode / запрет storage — просто не покажем
  }
}

/**
 * Уведомление при входе в общий дилерский кабинет:
 * старый доступ закрывается, дальше — регистрация на портале.
 */
export function DealerSunsetNotice({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    try {
      if (sessionStorage.getItem(DEALER_SUNSET_NOTICE_KEY) !== "1") return;
      sessionStorage.removeItem(DEALER_SUNSET_NOTICE_KEY);
      setOpen(true);
    } catch {
      // ignore
    }
  }, [enabled]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden border-0 p-0 sm:max-w-md"
      >
        <AnimatePresence>
          {open ? (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.28, ease: EASE_OUT }}
            >
              <div className="bg-brand-yellow h-1 w-full" aria-hidden />

              <div className="space-y-5 p-6 sm:p-7">
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Важно
                  </p>
                  <DialogTitle className="text-xl leading-snug font-semibold tracking-tight">
                    Старый партнёрский кабинет прекращает работу
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
                    Для продолжения работы зарегистрируйтесь на новом партнёрском портале{" "}
                    <span className="text-foreground font-medium">b2b.avgst.ru</span>.
                  </DialogDescription>
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="active:scale-[0.97]"
                    onClick={() => setOpen(false)}
                  >
                    Понятно
                  </Button>
                  <Button asChild className="active:scale-[0.97]">
                    <Link href="/signup" onClick={() => setOpen(false)}>
                      Зарегистрироваться
                    </Link>
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
