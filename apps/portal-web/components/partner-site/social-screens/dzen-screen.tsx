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

function EyeIcon() {
  return (
    <svg width="14" height="10" viewBox="0 0 16 10" fill="none" aria-hidden>
      <path
        d="M8 0C4.4 0 1.3 2 0 5c1.3 3 4.4 5 8 5s6.7-2 8-5c-1.3-3-4.4-5-8-5Zm0 8.3A3.3 3.3 0 1 1 8 1.7a3.3 3.3 0 0 1 0 6.6Zm0-1.6a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Экран канала в Дзене.
 * Название, подписчики и лента приходят из витрины канала; ничего, что
 * площадка не отдала, экран не достраивает.
 */
export function DzenScreen({
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
  const title = snapshot?.displayName ?? fallbackTitle;
  const subscribers = formatSubscribers(snapshot?.followersCount);
  const avatar = proxiedMediaUrl(snapshot?.avatarUrl);
  const posts = (snapshot?.media ?? []).slice(0, 4);

  return (
    <PhoneScreenShell background="#ffffff">
      <div className="flex h-full flex-col">
        <div className="shrink-0 bg-white">
          <IosStatusBar />
          <div className="flex h-[44px] items-center justify-center border-b border-black/5">
            <span
              className="text-[17px] leading-none font-bold tracking-[-0.4px] text-black"
              style={{ fontFamily: SF_DISPLAY }}
            >
              Дзен
            </span>
          </div>
        </div>

        {loading ? (
          <ScreenLoading />
        ) : !showData ? (
          <ScreenUnavailable title={unavailable.title} hint={unavailable.hint} />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 flex-col items-center px-5 pt-5">
              <span className="size-[76px] shrink-0 overflow-hidden rounded-full bg-[#f0f0f0]">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="" className="size-full object-cover" draggable={false} />
                ) : null}
              </span>

              <p
                className="mt-[10px] line-clamp-2 text-center text-[20px] leading-tight font-semibold text-black"
                style={{ fontFamily: SF_DISPLAY }}
              >
                {title}
              </p>

              {subscribers ? (
                <p className="mt-[3px] text-[13px] leading-tight text-[rgba(60,60,67,0.6)]">
                  {subscribers}
                </p>
              ) : null}

              {snapshot?.biography ? (
                <p className="mt-[6px] line-clamp-2 text-center text-[13px] leading-[17px] text-[rgba(60,60,67,0.75)]">
                  {snapshot.biography}
                </p>
              ) : null}

              <span className="mt-[14px] flex h-[38px] w-full items-center justify-center rounded-full bg-black text-[15px] font-semibold text-white">
                Подписаться
              </span>
            </div>

            {posts.length === 0 ? (
              <ScreenUnavailable
                title="Публикации недоступны"
                hint="Дзен не отдал публикации этого канала."
              />
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 pt-4">
                {posts.map((post) => {
                  const image = proxiedMediaUrl(post.mediaUrl ?? post.thumbnailUrl);
                  const views = formatCount(post.views);
                  const date = formatPublishedAt(post.publishedAt);
                  return (
                    <div key={post.id} className="shrink-0">
                      {image ? (
                        <span className="relative block overflow-hidden rounded-[14px] bg-[#f0f0f0]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image}
                            alt=""
                            className="block aspect-[16/9] w-full object-cover"
                            draggable={false}
                          />
                          {post.type === "video" ? (
                            <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-[3px] text-[11px] font-medium text-white backdrop-blur">
                              <svg width="8" height="9" viewBox="0 0 8 9" fill="none" aria-hidden>
                                <path d="M0 0l8 4.5L0 9V0Z" fill="currentColor" />
                              </svg>
                              Видео
                            </span>
                          ) : null}
                        </span>
                      ) : null}

                      {post.caption ? (
                        <p
                          className="mt-[8px] line-clamp-2 text-[16px] leading-[21px] font-semibold text-black"
                          style={{ fontFamily: SF_DISPLAY }}
                        >
                          {post.caption}
                        </p>
                      ) : null}

                      {views || date ? (
                        <div className="mt-[4px] flex items-center gap-[8px] text-[12px] text-[rgba(60,60,67,0.5)]">
                          {views ? (
                            <span className="flex items-center gap-[4px]">
                              <EyeIcon />
                              {views}
                            </span>
                          ) : null}
                          {date ? <span>{date}</span> : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <IosHomeIndicator />
      </div>
    </PhoneScreenShell>
  );
}
