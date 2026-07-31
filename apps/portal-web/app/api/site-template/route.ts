const TEMPLATE_URL = "https://msk.avgst.ru/";

export async function GET() {
  try {
    const upstream = await fetch(TEMPLATE_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml"
      },
      // свежая витрина, без долгого кеша Next
      cache: "no-store"
    });

    if (!upstream.ok) {
      return new Response(`Не удалось загрузить эталон (${upstream.status})`, {
        status: 502,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }

    let html = await upstream.text();

    // Абсолютная база — стили/скрипты/картинки Tilda с CDN и относительные пути
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head([^>]*)>/i, `<head$1><base href="${TEMPLATE_URL}">`);
    } else {
      html = `<base href="${TEMPLATE_URL}">` + html;
    }

    // Убираем service worker / frame-busting если встретятся
    html = html.replace(/if\s*\(\s*top\s*!==\s*self\s*\)\s*[^;]+;/gi, "");

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка зеркала";
    return new Response(message, {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}
