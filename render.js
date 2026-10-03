// Renders JavaScript-heavy pages in headless Chromium and returns the finished HTML.
//
// Safety: all browser traffic goes through a tiny proxy inside this process. The proxy
// resolves every hostname itself and refuses anything that isn't a public internet
// address, so pages (and their redirects, fetches and websockets) can't reach the
// server's private network.

import http from "node:http";
import net from "node:net";
import dns from "node:dns";

const RENDER_TIMEOUT_MS = 20000;
const MAX_RENDERS = Number(process.env.MAX_RENDERS || 2);
const MAX_QUEUE = 10;
const MAX_REQUESTS_PER_PAGE = 500;

export class RenderUnavailable extends Error {}

export function createRenderer({ isPublicIp, FetchError, maxBytes, userAgent }) {
  /* ---------------- safety proxy ---------------- */

  async function resolvePublic(host) {
    const h = host.replace(/^\[|\]$/g, "");
    if (net.isIP(h)) {
      if (!isPublicIp(h)) throw new Error("blocked");
      return h;
    }
    if (/^localhost$|\.localhost$|\.local$|\.internal$/i.test(h)) throw new Error("blocked");
    const addrs = await dns.promises.lookup(h, { all: true });
    if (!addrs.length || !addrs.every((a) => isPublicIp(a.address))) throw new Error("blocked");
    return addrs[0].address;
  }

  function splitHostPort(s) {
    const m = /^\[([^\]]+)\]:(\d+)$/.exec(s) || /^([^:]+):(\d+)$/.exec(s);
    if (!m) throw new Error("bad target");
    return [m[1], m[2]];
  }

  const proxy = http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url);
      const port = u.port || "80";
      if (u.protocol !== "http:" || port !== "80") throw new Error("blocked");
      const ip = await resolvePublic(u.hostname);
      const headers = { ...req.headers, host: u.host };
      delete headers["proxy-connection"];
      delete headers["proxy-authorization"];
      const out = http.request({ host: ip, port, method: req.method, path: u.pathname + u.search, headers }, (pres) => {
        res.writeHead(pres.statusCode || 502, pres.headers);
        pres.pipe(res);
      });
      out.setTimeout(RENDER_TIMEOUT_MS, () => out.destroy());
      out.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end(); });
      req.pipe(out);
    } catch {
      res.writeHead(403);
      res.end();
    }
  });

  proxy.on("connect", async (req, client, head) => {
    client.on("error", () => {});
    try {
      const [host, port] = splitHostPort(req.url);
      if (port !== "443" && port !== "80") throw new Error("blocked");
      const ip = await resolvePublic(host);
      const upstream = net.connect(Number(port), ip, () => {
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head && head.length) upstream.write(head);
        upstream.pipe(client);
        client.pipe(upstream);
      });
      upstream.setTimeout(RENDER_TIMEOUT_MS + 5000, () => upstream.destroy());
      upstream.on("error", () => client.destroy());
      client.on("close", () => upstream.destroy());
    } catch {
      client.end("HTTP/1.1 403 Forbidden\r\n\r\n");
    }
  });

  const proxyReady = new Promise((resolve) => proxy.listen(0, "127.0.0.1", () => resolve(proxy.address().port)));

  /* ---------------- browser ---------------- */

  let browserPromise = null;
  async function getBrowser() {
    if (!browserPromise) {
      browserPromise = (async () => {
        let chromium;
        try {
          ({ chromium } = await import("playwright"));
        } catch {
          throw new RenderUnavailable("Playwright is not installed.");
        }
        const port = await proxyReady;
        const browser = await chromium.launch({
          args: ["--disable-dev-shm-usage", "--disable-gpu", "--no-first-run", "--mute-audio"],
          proxy: { server: `http://127.0.0.1:${port}`, bypass: "<-loopback>" },
        }).catch((e) => { throw new RenderUnavailable("Chromium could not start: " + e.message); });
        browser.on("disconnected", () => { browserPromise = null; });
        return browser;
      })();
      browserPromise.catch(() => { browserPromise = null; });
    }
    return browserPromise;
  }

  /* ---------------- concurrency ---------------- */

  let active = 0;
  const waiting = [];
  async function withSlot(fn) {
    if (active >= MAX_RENDERS) {
      if (waiting.length >= MAX_QUEUE) {
        throw new FetchError("busy", "Lots of cats are busy right now. Try again in a few seconds.", 503);
      }
      await new Promise((resolve) => waiting.push(resolve));
    } else {
      active++;
    }
    try {
      return await fn();
    } finally {
      const next = waiting.shift();
      if (next) next(); else active--;
    }
  }

  /* ---------------- render ---------------- */

  async function render(url) {
    return withSlot(async () => {
      const browser = await getBrowser();
      const context = await browser.newContext({
        userAgent,
        viewport: { width: 1280, height: 900 },
        locale: "en-US",
        serviceWorkers: "block",
        acceptDownloads: false,
      });
      let requests = 0;
      await context.route("**/*", (route) => {
        const req = route.request();
        const type = req.resourceType();
        if (!/^https?:/i.test(req.url())) return route.abort();
        if (++requests > MAX_REQUESTS_PER_PAGE) return route.abort();
        // The visitor's browser loads images, fonts and media itself, so skip them here.
        if (type === "image" || type === "media" || type === "font") return route.abort();
        return route.continue();
      });
      let page = null;
      context.on("page", (p) => { if (page && p !== page) p.close().catch(() => {}); });
      page = await context.newPage();
      page.on("dialog", (d) => d.dismiss().catch(() => {}));
      const killer = setTimeout(() => context.close().catch(() => {}), RENDER_TIMEOUT_MS + 8000);

      try {
        let response;
        try {
          response = await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: RENDER_TIMEOUT_MS });
        } catch (e) {
          if (/timeout/i.test(e.message)) throw new FetchError("timeout", "That website took too long to load, even in a full browser.", 504);
          throw new FetchError("unreachable", "That website couldn't be loaded in a full browser either.", 502);
        }
        const status = response ? response.status() : 0;
        if (status === 401 || status === 403 || status === 429) {
          throw new FetchError("refused", `That website refused to let the cat in (status ${status}). Try the bookmarklet on it instead.`, 502);
        }
        if (status >= 400) throw new FetchError("bad_status", `That website answered with an error (status ${status}).`, 502);

        await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
        // Scroll through the page so lazy sections render, then go back to the top.
        await page.evaluate(async () => {
          for (let i = 0; i < 8; i++) {
            window.scrollBy(0, window.innerHeight);
            await new Promise((r) => setTimeout(r, 150));
          }
          window.scrollTo(0, 0);
        }).catch(() => {});
        await page.waitForTimeout(700);

        const html = await page.evaluate(() => {
          // CSS-in-JS libraries insert rules with insertRule, which never shows up in the HTML.
          for (const sheet of Array.from(document.styleSheets)) {
            const node = sheet.ownerNode;
            if (!node || node.tagName !== "STYLE") continue;
            try {
              const css = Array.from(sheet.cssRules).map((r) => r.cssText).join("\n");
              if (css.length > (node.textContent || "").length) node.textContent = css;
            } catch (e) {}
          }
          try {
            for (const s of document.adoptedStyleSheets || []) {
              const st = document.createElement("style");
              st.textContent = Array.from(s.cssRules).map((r) => r.cssText).join("\n");
              document.head.appendChild(st);
            }
          } catch (e) {}
          // Keep what is typed or drawn on the page.
          document.querySelectorAll("input").forEach((i) => {
            if (i.type !== "password" && i.value) i.setAttribute("value", i.value);
          });
          document.querySelectorAll("canvas").forEach((c) => {
            try {
              if (!c.width || !c.height || c.width * c.height > 4e6) return;
              const img = document.createElement("img");
              img.src = c.toDataURL();
              img.className = c.className;
              img.style.cssText = c.style.cssText;
              img.style.width = c.clientWidth + "px";
              img.style.height = c.clientHeight + "px";
              c.replaceWith(img);
            } catch (e) {}
          });
          return "<!DOCTYPE html>\n" + document.documentElement.outerHTML;
        });

        if (Buffer.byteLength(html) > maxBytes) {
          throw new FetchError("too_big", "That page is too large to load (over 6 MB).", 413);
        }
        let finalUrl = url;
        try { finalUrl = new URL(page.url()); } catch {}
        return { html, finalUrl };
      } finally {
        clearTimeout(killer);
        await context.close().catch(() => {});
      }
    });
  }

  /* ---------------- score card screenshots ---------------- */

  async function screenshot(html, width, height) {
    return withSlot(async () => {
      const browser = await getBrowser();
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
      // Only Google Fonts may load; the card itself is inline.
      await context.route("**/*", (route) => {
        const u = route.request().url();
        if (/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u)) return route.continue();
        return route.abort();
      });
      try {
        const page = await context.newPage();
        await page.setContent(html, { waitUntil: "networkidle", timeout: 8000 }).catch(() => {});
        await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
        return await page.screenshot({ type: "png" });
      } finally {
        await context.close().catch(() => {});
      }
    });
  }

  return { render, screenshot };
}
