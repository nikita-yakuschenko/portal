/** Звуки портала: один Web Audio-контур, явное состояние, rate limit и координация вкладок.
 *  Звук — best-effort канал: визуальные уведомления (бейджи, колокольчик) от него не зависят. */

const SOUND_SRC = {
  notification: "/sounds/notification.mp3",
  message: "/sounds/message.mp3"
} as const;

export type PortalSound = keyof typeof SOUND_SRC;

export type PortalSoundState =
  | "unsupported"
  | "initializing"
  | "locked"
  | "ready"
  | "blocked"
  | "failed";

export type PortalSoundResult =
  | "played"
  | "locked"
  | "rate_limited"
  | "not_loaded"
  | "failed"
  | "unsupported";

// Один сигнал одного типа не чаще этого интервала: заодно склеивает серии и глушит дубли из других вкладок
const MIN_GAP_PER_SOUND_MS = 3000;
// Разные сигналы не накладываются друг на друга
const MIN_GAP_ANY_MS = 400;
const CHANNEL_NAME = "b2b:portal-sounds";
const VOLUME = 0.5;

let context: AudioContext | null = null;
let gain: GainNode | null = null;
let channel: BroadcastChannel | null = null;
let initialized = false;
let state: PortalSoundState = "initializing";
let blockedNotice = false;
let lastAnyPlayedAt = 0;

const buffers = new Map<PortalSound, AudioBuffer>();
const lastPlayedAt = new Map<PortalSound, number>();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function setState(next: PortalSoundState) {
  if (state === next) return;
  state = next;
  notify();
}

export function getPortalSoundState() {
  return state;
}

/** Была ли попытка проиграть звук, отклонённая браузером — повод предложить активацию */
export function wasPortalSoundBlocked() {
  return blockedNotice;
}

export function subscribePortalSound(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function audioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const legacy = (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return window.AudioContext ?? legacy ?? null;
}

function isRunning() {
  return context?.state === "running";
}

function syncState() {
  if (!context) return;
  if (context.state === "running") {
    setState(buffers.size > 0 ? "ready" : "initializing");
    return;
  }
  setState(context.state === "closed" ? "failed" : "locked");
}

async function preload() {
  const ctx = context;
  if (!ctx) return;

  await Promise.all(
    (Object.keys(SOUND_SRC) as PortalSound[]).map(async (sound) => {
      if (buffers.has(sound)) return;
      try {
        const res = await fetch(SOUND_SRC[sound]);
        if (!res.ok) throw new Error(`asset ${res.status}`);
        buffers.set(sound, await ctx.decodeAudioData(await res.arrayBuffer()));
      } catch {
        // Ассет не загрузился — остаются визуальные каналы уведомления
      }
    })
  );

  syncState();
}

async function resumeContext() {
  if (!context || isRunning()) return;
  try {
    await context.resume();
  } catch {
    setState("blocked");
    return;
  }
  syncState();
}

/** Готовит контур заранее: декодирование работает и в suspended, разблокировка — только по жесту */
export function initPortalSounds() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const Ctor = audioContextCtor();
  if (!Ctor) {
    setState("unsupported");
    return;
  }

  try {
    context = new Ctor();
  } catch {
    setState("failed");
    return;
  }

  gain = context.createGain();
  gain.gain.value = VOLUME;
  gain.connect(context.destination);
  context.onstatechange = () => syncState();

  syncState();
  void preload();

  const unlock = () => void resumeContext();
  for (const type of ["pointerdown", "keydown", "touchstart"] as const) {
    window.addEventListener(type, unlock, { capture: true, passive: true });
  }

  // Контекст могли приостановить в фоне или при засыпании машины
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void resumeContext();
  });

  if ("BroadcastChannel" in window) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      const data = event.data as { sound?: PortalSound; at?: number } | null;
      if (!data?.sound || typeof data.at !== "number") return;
      lastPlayedAt.set(data.sound, Math.max(lastPlayedAt.get(data.sound) ?? 0, data.at));
      lastAnyPlayedAt = Math.max(lastAnyPlayedAt, data.at);
    };
  }
}

/** Активация по действию пользователя: разблокировать контекст и добрать ассеты */
export async function enablePortalSound() {
  initPortalSounds();
  blockedNotice = false;
  await resumeContext();
  await preload();
  notify();
  return state;
}

export async function playPortalSound(sound: PortalSound): Promise<PortalSoundResult> {
  if (typeof window === "undefined") return "unsupported";

  initPortalSounds();
  if (!context || !gain) return "unsupported";

  const now = Date.now();
  if (now - (lastPlayedAt.get(sound) ?? 0) < MIN_GAP_PER_SOUND_MS) return "rate_limited";
  if (now - lastAnyPlayedAt < MIN_GAP_ANY_MS) return "rate_limited";

  if (!isRunning()) {
    await resumeContext();
    if (!isRunning()) {
      // Браузер ждёт жеста пользователя — сообщаем интерфейсу, звук не теряем молча
      if (!blockedNotice) {
        blockedNotice = true;
        notify();
      }
      return "locked";
    }
  }

  const buffer = buffers.get(sound);
  if (!buffer) {
    void preload();
    return "not_loaded";
  }

  try {
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    source.start();
  } catch {
    setState("failed");
    return "failed";
  }

  lastPlayedAt.set(sound, now);
  lastAnyPlayedAt = now;
  // Остальные вкладки увидят воспроизведение и не будут звучать хором
  channel?.postMessage({ sound, at: now });
  setState("ready");
  return "played";
}
