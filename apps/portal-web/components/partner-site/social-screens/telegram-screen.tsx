"use client";

import { IosHomeIndicator, IosStatusBar } from "./ios-status-bar";
import { PhoneScreenShell, SF_DISPLAY, ScreenLoading, ScreenUnavailable } from "./screen-shell";
import {
  describeUnavailable,
  formatCount,
  formatPublishedAt,
  formatSubscribers,
  proxiedMediaUrl,
  type SocialProfileSnapshot
} from "@/lib/social-profile";

/** Обои чата Telegram для iOS — собственный градиент, не вырезка из скриншота */
const CHAT_BACKGROUND =
  "linear-gradient(160deg, #dfe7ef 0%, #e8e4dd 45%, #dfe2ea 100%)";

function Avatar({ url, title }: { url: string | undefined; title: string }) {
  const proxied = proxiedMediaUrl(url);
  if (proxied) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={proxied} alt="" className="size-full object-cover" draggable={false} />;
  }
  return (
    <span className="flex size-full items-center justify-center bg-[#2AABEE] text-[15px] font-semibold text-white">
      {title.trim().slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}

function ViewsIcon() {
  return (
    <svg width="16" height="10" viewBox="0 0 16 10" fill="none" aria-hidden>
      <path
        d="M8 0C4.4 0 1.3 2 0 5c1.3 3 4.4 5 8 5s6.7-2 8-5c-1.3-3-4.4-5-8-5Zm0 8.3A3.3 3.3 0 1 1 8 1.7a3.3 3.3 0 0 1 0 6.6Zm0-1.6a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Экран публичного канала Telegram.
 * Показывает только то, что реально пришло из t.me — счётчики, публикации,
 * закреп. Ничего не достраивается «для красоты».
 */
export function TelegramScreen({
  snapshot,
  loading,
  fallbackTitle
}: {
  snapshot: SocialProfileSnapshot | null;
  loading: boolean;
  fallbackTitle: string;
}) {
  const title = snapshot?.displayName ?? fallbackTitle;
  const subscribers = formatSubscribers(snapshot?.followersCount);
  const posts = (snapshot?.media ?? []).slice(0, 6);
  const showData = Boolean(snapshot && (snapshot.status === "live" || snapshot.status === "stale"));
  const unavailable = describeUnavailable(snapshot);

  return (
    <PhoneScreenShell background={CHAT_BACKGROUND}>
      <div className="flex h-full flex-col">
        <div className="bg-[rgba(247,247,247,0.92)] backdrop-blur-xl">
          <IosStatusBar />

          <div className="flex h-[48px] items-center gap-[10px] border-b border-black/10 px-3">
            <svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden>
              <path
                d="M10.5 1.5 2 10l8.5 8.5"
                stroke="#007AFF"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            <span className="size-[36px] shrink-0 overflow-hidden rounded-full">
              <Avatar url={snapshot?.avatarUrl} title={title} />
            </span>

            <span className="min-w-0 flex-1">
              <span
                className="block truncate text-[17px] leading-tight font-semibold text-black"
                style={{ fontFamily: SF_DISPLAY }}
              >
                {title}
              </span>
              <span className="block truncate text-[13px] leading-tight text-[rgba(60,60,67,0.6)]">
                {subscribers ?? "канал"}
              </span>
            </span>
          </div>

          {snapshot?.pinnedMessage ? (
            <div className="flex items-center gap-2 border-b border-black/10 bg-white/55 px-4 py-2 backdrop-blur-xl">
              <span className="h-[26px] w-[2px] rounded-full bg-[#2AABEE]" />
              <span className="min-w-0">
                <span className="block text-[13px] leading-tight font-semibold text-[#2AABEE]">
                  Закреплённое сообщение
                </span>
                <span className="block truncate text-[13px] leading-tight text-[rgba(60,60,67,0.75)]">
                  {snapshot.pinnedMessage}
                </span>
              </span>
            </div>
          ) : null}
        </div>

        {loading ? (
          <ScreenLoading />
        ) : !showData ? (
          <ScreenUnavailable title={unavailable.title} hint={unavailable.hint} />
        ) : posts.length === 0 ? (
          <ScreenUnavailable
            title="Публикации недоступны"
            hint="Telegram не отдал публичную ленту этого профиля."
          />
        ) : (
          <div className="flex flex-1 flex-col justify-end gap-2 overflow-hidden px-2 pt-3 pb-2">
            {posts.map((post) => {
              const image = proxiedMediaUrl(post.thumbnailUrl);
              const views = formatCount(post.views);
              const date = formatPublishedAt(post.publishedAt);
              return (
                <div key={post.id} className="max-w-[86%]">
                  <div className="overflow-hidden rounded-[18px] rounded-bl-[6px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.12)]">
                    {image ? (
                      <span className="relative block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image}
                          alt=""
                          className="block aspect-[4/3] w-full object-cover"
                          draggable={false}
                        />
                        {post.type === "video" ? (
                          <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-[3px] text-[11px] font-medium text-white backdrop-blur">
                            <svg width="8" height="9" viewBox="0 0 8 9" fill="none" aria-hidden>
                              <path d="M0 0l8 4.5L0 9V0Z" fill="currentColor" />
                            </svg>
                            Видео
                          </span>
                        ) : null}
                      </span>
                    ) : null}

                    {post.caption ? (
                      <p className="line-clamp-3 px-3 pt-2 text-[15px] leading-[20px] text-black">
                        {post.caption}
                      </p>
                    ) : null}

                    <div className="flex items-center justify-end gap-[6px] px-3 pt-1 pb-[6px] text-[11px] text-[rgba(60,60,67,0.5)]">
                      {views ? (
                        <span className="flex items-center gap-[3px]">
                          <ViewsIcon />
                          {views}
                        </span>
                      ) : null}
                      {date ? <span>{date}</span> : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Нижняя панель канала: единственное действие — подписка */}
        <div className="shrink-0 border-t border-black/10 bg-[rgba(247,247,247,0.86)] backdrop-blur-xl">
          <div className="px-4 py-[10px] text-center">
            <span
              className="text-[17px] leading-none font-semibold text-[#007AFF] uppercase"
              style={{ fontFamily: SF_DISPLAY }}
            >
              Подписаться
            </span>
          </div>
          <IosHomeIndicator />
        </div>
      </div>
    </PhoneScreenShell>
  );
}
