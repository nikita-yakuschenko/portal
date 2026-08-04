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
  const headers = new Headers(init?.headers);
  // Content-Type: application/json только если есть body — иначе Fastify падает на пустом POST
  const body = init?.body;
  const hasJsonBody =
    body != null &&
    body !== "" &&
    !(typeof FormData !== "undefined" && body instanceof FormData);
  if (hasJsonBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      credentials: "include",
      headers
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
