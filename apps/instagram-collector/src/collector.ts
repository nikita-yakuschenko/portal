import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { chromium, type Browser, type BrowserContext } from "playwright";

import { config } from "./config.js";
import {
  classifyPage,
  parseProfileDom,
  parseProfileJson,
  type CollectedProfile,
  type CollectorStatus
} from "./parsers.js";

/**
 * Браузерный сбор публичного профиля Instagram.
 *
 * Никакого обхода защиты: CAPTCHA, challenge и login wall распознаются и
 * возвращаются как статус. Fingerprint не подделывается, прокси не крутятся.
 */

export type CollectResult = {
  status: CollectorStatus;
  profile?: CollectedProfile | undefined;
  diagnostics: {
    providerStage: string;
    upstreamStatus?: number | undefined;
    finalUrl?: string | undefined;
    durationMs: number;
    requestId: string;
    errorClass?: string | undefined;
    tracePath?: string | undefined;
  };
};

const IOS_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

let browserPromise: Promise<Browser> | null = null;

/** Один Chromium на процесс: холодный старт стоит секунды, держим тёплым */
async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      args: ["--no-sandbox"],
      ...(config.proxy ? { proxy: config.proxy } : {})
    });
  }
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const browser = await browserPromise;
  browserPromise = null;
  await browser.close();
}

/** Ограничитель одновременных сборов — Chromium не терпит толпы вкладок */
class Semaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async acquire(): Promise<() => void> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active -= 1;
      const next = this.queue.shift();
      if (next) next();
    };
  }
}

const semaphore = new Semaphore(config.concurrency);

/** Технические артефакты живут ограниченное время и чистятся при каждом сборе */
async function pruneTraces(): Promise<void> {
  try {
    const entries = await readdir(config.traceDir);
    const deadline = Date.now() - config.traceTtlMinutes * 60 * 1000;
    for (const entry of entries) {
      const path = join(config.traceDir, entry);
      const info = await stat(path);
      if (info.mtimeMs < deadline) await rm(path, { force: true, recursive: true });
    }
  } catch {
    // каталога ещё нет — чистить нечего
  }
}

async function createContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    colorScheme: "dark",
    userAgent: IOS_USER_AGENT,
    ...(config.storageStatePath ? { storageState: config.storageStatePath } : {})
  });
}

export async function collectInstagramProfile(input: {
  username: string;
  profileUrl: string;
}): Promise<CollectResult> {
  const requestId = randomUUID();
  const startedAt = Date.now();
  const release = await semaphore.acquire();

  let context: BrowserContext | null = null;

  try {
    const browser = await getBrowser();
    context = await createContext(browser);
    const page = await context.newPage();
    page.setDefaultTimeout(config.navTimeoutMs);

    // Сначала данные из сети браузера, DOM — только запасной путь
    const jsonPayloads: unknown[] = [];
    page.on("response", (response) => {
      const url = response.url();
      if (!url.includes("/api/v1/users/") && !url.includes("/graphql")) return;
      void response
        .json()
        .then((payload) => jsonPayloads.push(payload))
        .catch(() => undefined);
    });

    // networkidle не годится: Instagram держит постоянные соединения
    const response = await page.goto(input.profileUrl, {
      waitUntil: "domcontentloaded",
      timeout: config.navTimeoutMs
    });

    await page
      .waitForSelector("header, main article, main", { timeout: config.contentTimeoutMs })
      .catch(() => undefined);

    const signals = {
      finalUrl: page.url(),
      status: response?.status(),
      title: await page.title().catch(() => undefined),
      bodyText: (await page.locator("body").innerText().catch(() => "")).slice(0, 4000)
    };

    const problem = classifyPage(signals);
    if (problem) {
      return {
        status: problem,
        diagnostics: {
          providerStage: "classify",
          upstreamStatus: signals.status,
          finalUrl: signals.finalUrl,
          durationMs: Date.now() - startedAt,
          requestId
        }
      };
    }

    for (const payload of jsonPayloads) {
      const parsed = parseProfileJson(payload);
      if (parsed) {
        return {
          status: "live",
          profile: parsed,
          diagnostics: {
            providerStage: "network_json",
            upstreamStatus: signals.status,
            finalUrl: signals.finalUrl,
            durationMs: Date.now() - startedAt,
            requestId
          }
        };
      }
    }

    const dom = await page.evaluate(() => {
      const meta = (name: string) =>
        document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute(
          "content"
        ) ?? undefined;

      const links: Array<{ href: string; imageUrl?: string; alt?: string }> = [];
      for (const anchor of Array.from(document.querySelectorAll("a[href]"))) {
        if (links.length >= 12) break;
        const href = anchor.getAttribute("href") ?? "";
        if (!/\/(p|reel|tv)\//.test(href)) continue;
        const image = anchor.querySelector("img");
        const imageUrl = image?.getAttribute("src") ?? undefined;
        const alt = image?.getAttribute("alt") ?? undefined;
        links.push({
          href,
          ...(imageUrl ? { imageUrl } : {}),
          ...(alt ? { alt } : {})
        });
      }

      return {
        metaDescription: meta("og:description") ?? meta("description"),
        ogTitle: meta("og:title"),
        ogImage: meta("og:image"),
        headerTitle: document.querySelector("header h2, header h1")?.textContent?.trim(),
        biography: document.querySelector("header section > div:last-child")?.textContent?.trim(),
        postLinks: links
      };
    });

    const fromDom = parseProfileDom(dom, input.username);
    if (fromDom) {
      return {
        status: "live",
        profile: fromDom,
        diagnostics: {
          providerStage: "dom",
          upstreamStatus: signals.status,
          finalUrl: signals.finalUrl,
          durationMs: Date.now() - startedAt,
          requestId
        }
      };
    }

    // Страница открылась, но данных нет — это не «пусто», а неизвестное состояние
    await mkdir(config.traceDir, { recursive: true });
    const tracePath = join(config.traceDir, `${requestId}.png`);
    await page.screenshot({ path: tracePath, fullPage: false }).catch(() => undefined);

    return {
      status: "unavailable",
      diagnostics: {
        providerStage: "no_data",
        upstreamStatus: signals.status,
        finalUrl: signals.finalUrl,
        durationMs: Date.now() - startedAt,
        requestId,
        errorClass: "profile_data_not_found",
        tracePath
      }
    };
  } catch (error) {
    return {
      status: "unavailable",
      diagnostics: {
        providerStage: "browser",
        durationMs: Date.now() - startedAt,
        requestId,
        errorClass: error instanceof Error ? error.name : "collector_error"
      }
    };
  } finally {
    await context?.close().catch(() => undefined);
    release();
    void pruneTraces();
  }
}
