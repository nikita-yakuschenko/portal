/** События между клиентскими виджетами портала (колокольчик ↔ мессенджер). */

export const PORTAL_EVENT = {
  notificationsRefresh: "b2b:notifications-refresh",
  messengerActivity: "b2b:messenger-activity"
} as const;

export function emitPortalEvent(name: (typeof PORTAL_EVENT)[keyof typeof PORTAL_EVENT]) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(name));
}
