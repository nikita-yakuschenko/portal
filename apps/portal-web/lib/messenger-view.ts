/** Режим просмотра мессенджера — чтобы заголовок в шапке знал про архив. */

let archiveMode = false;
const listeners = new Set<() => void>();

export function getMessengerArchiveMode() {
  return archiveMode;
}

export function setMessengerArchiveMode(next: boolean) {
  if (archiveMode === next) return;
  archiveMode = next;
  for (const listener of listeners) listener();
}

export function subscribeMessengerArchiveMode(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
