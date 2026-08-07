/**
 * Общий HTTP-клиент для провайдеров соцсетей.
 *
 * Любой outbound-запрос здесь ограничен по времени и по размеру ответа:
 * внешняя страница может отдавать гигабайты, а мы держим один Node-процесс.
 */

export class OutboundError extends Error {
  constructor(
    message: string,
    readonly errorClass: string,
    readonly upstreamStatus?: number
  ) {
    super(message);
    this.name = "OutboundError";
  }
}

export type FetchLimitedResult = {
  status: number;
  /** Куда увёл редирект при redirect: "manual" */
  location?: string | undefined;
  contentType?: string | undefined;
  body: string;
};

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; AvgstSiteBot/1.0; +https://avgst.ru)";

/** Читает тело построчно и рвёт соединение при превышении лимита */
async function readLimited(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        throw new OutboundError(`Ответ превысил ${maxBytes} байт`, "response_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
}

export async function fetchTextLimited(
  url: string,
  options: {
    timeoutMs: number;
    maxBytes: number;
    headers?: Record<string, string>;
    redirect?: RequestRedirect;
  }
): Promise<FetchLimitedResult> {
  const target = new URL(url);
  if (target.protocol !== "https:") {
    throw new OutboundError("Разрешён только https", "insecure_protocol");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(target, {
      signal: controller.signal,
      redirect: options.redirect ?? "manual",
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        "Accept-Language": "en",
        Accept: "text/html,application/xhtml+xml",
        ...options.headers
      }
    });

    const contentType = response.headers.get("content-type") ?? undefined;
    const location = response.headers.get("location") ?? undefined;

    // Редиректы и ошибки тела не имеют — не тратим время на чтение
    const body =
      response.status >= 200 && response.status < 300
        ? await readLimited(response, options.maxBytes)
        : "";

    return { status: response.status, location, contentType, body };
  } catch (error) {
    if (error instanceof OutboundError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new OutboundError(`Таймаут ${options.timeoutMs} мс`, "timeout");
    }
    throw new OutboundError(
      error instanceof Error ? error.message : "Сетевая ошибка",
      "network_error"
    );
  } finally {
    clearTimeout(timer);
  }
}
