/**
 * Простой лимитер по ключу в памяти процесса.
 *
 * Публичные социальные эндпоинты открыты без авторизации, поэтому нужен потолок.
 * Redis в стек не тянем: API живёт одним процессом, а лимит здесь — защита от
 * случайного зацикливания клиента, а не антифрод.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function consumeRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}

/** Периодическая очистка, чтобы карта не росла на длинной работе процесса */
export function pruneRateLimits(): void {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
