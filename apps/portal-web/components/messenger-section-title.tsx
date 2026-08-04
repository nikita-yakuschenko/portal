"use client";

import { useSyncExternalStore } from "react";

import {
  getMessengerArchiveMode,
  subscribeMessengerArchiveMode
} from "@/lib/messenger-view";

/** Заголовок раздела мессенджера: в архиве меняется на «Архив» */
export function MessengerSectionTitle() {
  const archiveMode = useSyncExternalStore(
    subscribeMessengerArchiveMode,
    getMessengerArchiveMode,
    () => false
  );

  return (
    <h1 className="min-w-0 flex-1 truncate text-base font-medium">
      {archiveMode ? "Архив" : "Мессенджер"}
    </h1>
  );
}
