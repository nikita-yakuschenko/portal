/** В браузере — same-origin (rewrite Next → API). На сервере — прямой URL API. */
function resolveApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return "";
  }
  return process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

export const apiBaseUrl = resolveApiBaseUrl();

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = resolveApiBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {})
      }
    });
  } catch {
    throw new Error("Нет связи с API. Убедитесь, что запущен npm run dev:api");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? `Ошибка запроса (${response.status})`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
