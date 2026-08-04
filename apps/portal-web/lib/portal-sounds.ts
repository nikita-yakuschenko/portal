/** Звуки портала: системное уведомление и новое сообщение в мессенджере. */

const SOUND_SRC = {
  notification: "/sounds/notification.mp3",
  message: "/sounds/message.mp3"
} as const;

export type PortalSound = keyof typeof SOUND_SRC;

const cache = new Map<PortalSound, HTMLAudioElement>();

export function playPortalSound(sound: PortalSound) {
  if (typeof window === "undefined") return;

  let audio = cache.get(sound);
  if (!audio) {
    audio = new Audio(SOUND_SRC[sound]);
    audio.volume = 0.5;
    cache.set(sound, audio);
  }

  // Браузер может запретить автоплей до первого взаимодействия — молча игнорируем
  audio.currentTime = 0;
  void audio.play().catch(() => undefined);
}
