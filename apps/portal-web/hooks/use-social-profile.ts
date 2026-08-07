"use client";

import { useEffect, useState } from "react";

import {
  fetchSocialProfile,
  hasLiveProvider,
  type SocialProfileSnapshot
} from "@/lib/social-profile";

export type SocialProfileState = {
  snapshot: SocialProfileSnapshot | null;
  loading: boolean;
  /** true — провайдера для площадки нет, показываем оболочку без данных */
  unsupported: boolean;
};

/**
 * Снимок профиля для экрана мокапа.
 *
 * Ошибку сети не превращаем в «пустой успех»: snapshot остаётся null,
 * и экран показывает честное состояние недоступности.
 */
export function useSocialProfile(
  platform: string | null,
  partnerId: string | null
): SocialProfileState {
  const [snapshot, setSnapshot] = useState<SocialProfileSnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  const supported = platform !== null && hasLiveProvider(platform);

  useEffect(() => {
    if (!supported || !platform) {
      setSnapshot(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setSnapshot(null);

    void (async () => {
      try {
        const result = await fetchSocialProfile(platform, partnerId);
        if (!cancelled) setSnapshot(result);
      } catch {
        if (!cancelled) setSnapshot(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [platform, partnerId, supported]);

  return { snapshot, loading, unsupported: !supported };
}
