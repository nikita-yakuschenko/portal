"use client";

import { IosHomeIndicator, IosStatusBar } from "./ios-status-bar";
import { PhoneScreenShell, SF_DISPLAY, ScreenLoading, ScreenUnavailable } from "./screen-shell";
import {
  describeUnavailable,
  formatCount,
  proxiedMediaUrl,
  type SocialProfileSnapshot
} from "@/lib/social-profile";

function Stat({ value, label }: { value: string | undefined; label: string }) {
  return (
    <span className="flex flex-1 flex-col items-center">
      <span
        className="text-[17px] leading-tight font-semibold text-white"
        style={{ fontFamily: SF_DISPLAY }}
      >
        {value ?? "—"}
      </span>
      <span className="text-[13px] leading-tight text-[rgba(235,235,245,0.6)]">{label}</span>
    </span>
  );
}

/**
 * Экран профиля Instagram.
 *
 * Сетка заполняется только реально полученными публикациями: подставлять
 * демо-плитки или чужие изображения запрещено — пустая сетка честнее.
 */
export function InstagramScreen({
  snapshot,
  loading,
  fallbackTitle
}: {
  snapshot: SocialProfileSnapshot | null;
  loading: boolean;
  fallbackTitle: string;
}) {
  const showData = Boolean(snapshot && (snapshot.status === "live" || snapshot.status === "stale"));
  const unavailable = describeUnavailable(snapshot);
  const username = snapshot?.username ?? "";
  const media = snapshot?.media ?? [];
  const avatar = proxiedMediaUrl(snapshot?.avatarUrl);

  return (
    <PhoneScreenShell background="#000000">
      <div className="flex h-full flex-col text-white">
        <IosStatusBar dark />

        <div className="flex h-[44px] items-center gap-2 px-4">
          <span
            className="min-w-0 flex-1 truncate text-[17px] leading-none font-semibold"
            style={{ fontFamily: SF_DISPLAY }}
          >
            {username ? `@${username}` : fallbackTitle}
          </span>
        </div>

        {loading ? (
          <ScreenLoading dark />
        ) : !showData ? (
          <ScreenUnavailable dark title={unavailable.title} hint={unavailable.hint} />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-4 px-4 pt-2">
              <span className="size-[86px] shrink-0 overflow-hidden rounded-full bg-[#1c1c1e]">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="" className="size-full object-cover" draggable={false} />
                ) : null}
              </span>
              <span className="flex flex-1 items-center">
                <Stat value={formatCount(snapshot?.postsCount)} label="публикаций" />
                <Stat value={formatCount(snapshot?.followersCount)} label="подписчиков" />
                <Stat value={formatCount(snapshot?.followingCount)} label="подписки" />
              </span>
            </div>

            <div className="space-y-[2px] px-4 pt-3">
              {snapshot?.displayName ? (
                <p className="text-[14px] leading-tight font-semibold">{snapshot.displayName}</p>
              ) : null}
              {snapshot?.category ? (
                <p className="text-[14px] leading-tight text-[rgba(235,235,245,0.6)]">
                  {snapshot.category}
                </p>
              ) : null}
              {snapshot?.biography ? (
                <p className="line-clamp-3 text-[14px] leading-[19px] whitespace-pre-line">
                  {snapshot.biography}
                </p>
              ) : null}
              {snapshot?.website ? (
                <p className="truncate text-[14px] leading-tight font-medium text-[#8AB4F8]">
                  {snapshot.website.replace(/^https?:\/\//, "")}
                </p>
              ) : null}
            </div>

            <div className="flex gap-2 px-4 pt-3">
              <span className="flex h-[32px] flex-1 items-center justify-center rounded-[8px] bg-[#0095F6] text-[14px] font-semibold">
                Подписаться
              </span>
              <span className="flex h-[32px] flex-1 items-center justify-center rounded-[8px] bg-[#262626] text-[14px] font-semibold">
                Сообщение
              </span>
            </div>

            <div className="mt-4 flex h-[44px] shrink-0 items-center border-b border-white/10">
              <span className="flex flex-1 items-center justify-center border-b-2 border-white pb-[10px]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <rect x="2" y="2" width="6.6" height="6.6" fill="#fff" />
                  <rect x="8.7" y="2" width="6.6" height="6.6" fill="#fff" opacity="0.85" />
                  <rect x="15.4" y="2" width="6.6" height="6.6" fill="#fff" opacity="0.7" />
                  <rect x="2" y="8.7" width="6.6" height="6.6" fill="#fff" opacity="0.85" />
                  <rect x="8.7" y="8.7" width="6.6" height="6.6" fill="#fff" opacity="0.7" />
                  <rect x="15.4" y="8.7" width="6.6" height="6.6" fill="#fff" opacity="0.55" />
                </svg>
              </span>
              <span className="flex flex-1 items-center justify-center pb-[10px] opacity-45">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <rect x="2.5" y="3.5" width="19" height="17" rx="4" stroke="#fff" strokeWidth="1.8" />
                  <path d="M10 9l5 3-5 3V9Z" fill="#fff" />
                </svg>
              </span>
            </div>

            {media.length === 0 ? (
              <ScreenUnavailable
                dark
                title="Публикации недоступны"
                hint="Instagram не предоставил публичную сетку этого профиля"
              />
            ) : (
              <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-3 gap-[2px] overflow-hidden pt-[2px]">
                {media.slice(0, 12).map((item) => {
                  const image = proxiedMediaUrl(item.thumbnailUrl ?? item.mediaUrl);
                  return (
                    <span key={item.id} className="relative block aspect-square bg-[#1c1c1e]">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={image}
                          alt=""
                          className="size-full object-cover"
                          draggable={false}
                        />
                      ) : null}
                      {item.type === "video" ? (
                        <svg
                          className="absolute top-[6px] right-[6px]"
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          fill="none"
                          aria-hidden
                        >
                          <path d="M3 1.5l8.5 5.5L3 12.5v-11Z" fill="#fff" />
                        </svg>
                      ) : item.type === "carousel" ? (
                        <svg
                          className="absolute top-[6px] right-[6px]"
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          fill="none"
                          aria-hidden
                        >
                          <rect x="1" y="3.5" width="8" height="8" rx="1.6" fill="#fff" opacity="0.75" />
                          <rect x="4.5" y="1" width="8" height="8" rx="1.6" fill="#fff" />
                        </svg>
                      ) : null}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <IosHomeIndicator dark />
      </div>
    </PhoneScreenShell>
  );
}
