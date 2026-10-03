import express from "express";
import * as cheerio from "cheerio";
import { Agent, fetch } from "undici";
import ipaddr from "ipaddr.js";
import dns from "node:dns";
import net from "node:net";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRenderer, RenderUnavailable } from "./render.js";
import { parseScore, cardHtml, sharePageHtml, shareQuery } from "./card.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, "public");
const PORT = process.env.PORT || 3000;

const MAX_BYTES = 6 * 1024 * 1024;     // biggest page we will download
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 12000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 100;
const RATE_LIMIT = 30;                 // page loads per IP per minute
const RENDER_LIMIT = 10;               // full-browser renders per IP per minute
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";

const ENGINE = fs.readFileSync(path.join(PUBLIC, "cat-chaos.js"), "utf8");
const BOOT = fs.readFileSync(path.join(PUBLIC, "boot.js"), "utf8");
const ERROR_TEMPLATE = fs.readFileSync(path.join(PUBLIC, "error.html"), "utf8");
const INDEX_TEMPLATE = fs.readFileSync(path.join(PUBLIC, "index.html"), "utf8");

/* ------------------------------------------------------------------ */
/* Network safety: only public internet addresses can be fetched.      */
/* ------------------------------------------------------------------ */

function isPublicIp(ip) {
  try {
    let addr = ipaddr.parse(ip);
    if (addr.kind() === "ipv6" && addr.isIPv4MappedAddress()) addr = addr.toIPv4Address();
    return addr.range() === "unicast";
  } catch {
    return false;
  }
}

class FetchError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// Every DNS answer is checked at connect time, so a hostname can't point at a private address.
const agent = new Agent({
  connect: {
    timeout: TIMEOUT_MS,
    lookup(hostname, options, callback) {
      dns.lookup(hostname, { all: true }, (err, addresses) => {
        if (err) return callback(err);
        const safe = addresses.filter((a) => isPublicIp(a.address));
        if (!safe.length) return callback(new FetchError("blocked", "That address points to a private network."));
        if (options && options.all) return callback(null, safe);
        return callback(null, safe[0].address, safe[0].family);
      });
    },
  },
  headersTimeout: TIMEOUT_MS,
  bodyTimeout: TIMEOUT_MS,
});

function normalizeUrl(input) {
  let raw = String(input || "").trim();
  if (!raw) throw new FetchError("empty", "Type a website address first.", 400);
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = "https://" + raw;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchError("invalid", "That doesn't look like a website address.", 400);
  }
  checkUrl(url);
  url.hash = "";
  return url;
}

function checkUrl(url) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FetchError("invalid", "Only http and https addresses can be opened.", 400);
  }
  if (url.username || url.password) {
    throw new FetchError("invalid", "Addresses with a username or password can't be opened.", 400);
  }
  if (url.port && !["80", "443"].includes(url.port)) {
    throw new FetchError("invalid", "Only websites on the standard ports (80 and 443) can be opened.", 400);
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && !isPublicIp(host)) {
    throw new FetchError("blocked", "Private network addresses can't be opened.", 400);
  }
  if (/^localhost$|\.localhost$|\.local$|\.internal$/i.test(host)) {
    throw new FetchError("blocked", "Private network addresses can't be opened.", 400);
  }
}

async function readLimited(body) {
  const reader = body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new FetchError("too_big", "That page is too large to load (over 6 MB).", 413);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

function decode(buf, contentType) {
  let charset = /charset=([^;]+)/i.exec(contentType || "")?.[1];
  if (!charset) {
    const head = buf.subarray(0, 4096).toString("latin1");
    charset = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1];
  }
  try {
    return new TextDecoder((charset || "utf-8").trim().toLowerCase()).decode(buf);
  } catch {
    return new TextDecoder("utf-8").decode(buf);
  }
}

async function fetchPage(startUrl) {
  let url = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    checkUrl(url);
    let res;
    try {
      res = await fetch(url, {
        dispatcher: agent,
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          "accept-language": "en-US,en;q=0.9",
        },
      });
    } catch (err) {
      const cause = err.cause || err;
      if (cause instanceof FetchError) throw cause;
      if (cause.name === "TimeoutError" || /timeout/i.test(cause.code || cause.message || "")) {
        throw new FetchError("timeout", "That website took too long to answer.", 504);
      }
      if (cause.code === "ENOTFOUND" || cause.code === "EAI_AGAIN") {
        throw new FetchError("not_found", "That website doesn't seem to exist. Check the spelling.", 404);
      }
      throw new FetchError("unreachable", "That website couldn't be reached.", 502);
    }

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      await res.body?.cancel();
      url = new URL(res.headers.get("location"), url);
      url.hash = "";
      continue;
    }
    if (res.status === 401 || res.status === 403 || res.status === 429) {
      await res.body?.cancel();
      throw new FetchError("refused", `That website refused to let the cat in (status ${res.status}). Some sites block visitors like this one. Try another site, or use the bookmarklet on it instead.`, 502);
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new FetchError("bad_status", `That website answered with an error (status ${res.status}).`, 502);
    }
    const type = res.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml\+xml/i.test(type)) {
      await res.body?.cancel();
      throw new FetchError("not_html", "That address isn't a web page (it's a file or data). Try the page that links to it.", 415);
    }
    const buf = await readLimited(res.body);
    return { html: decode(buf, type), finalUrl: url };
  }
  throw new FetchError("redirects", "That website redirected too many times.", 508);
}

/* ------------------------------------------------------------------ */
/* Turn a page into a static, script-free level for the cat.           */
/* ------------------------------------------------------------------ */

const URL_ATTRS = ["href", "src", "action", "formaction", "xlink:href", "poster", "data"];
const LAZY_SRC = ["data-src", "data-lazy-src", "data-original", "data-lazy", "data-url"];
const LAZY_SRCSET = ["data-srcset", "data-lazy-srcset"];

function isPlaceholder(src) {
  return !src || /^data:/i.test(src) || /(blank|placeholder|spacer|pixel|1x1|transparent)\.(gif|png|svg)/i.test(src);
}

function transform(html, pageUrl, mode) {
  const $ = cheerio.load(html, { scriptingEnabled: false });

  // Respect an existing <base>, then replace it with an absolute one.
  let baseHref = pageUrl.href;
  const existingBase = $("base[href]").first().attr("href");
  if (existingBase) {
    try { baseHref = new URL(existingBase, pageUrl).href; } catch { /* keep page url */ }
  }
  $("base").remove();

  // No scripts from the original site run here.
  $("script").remove();
  $("link[rel~='preload'][as='script'], link[rel~='modulepreload'], link[rel~='manifest'], link[rel~='serviceworker']").remove();
  $("meta[http-equiv]").each((_, el) => {
    const v = ($(el).attr("http-equiv") || "").toLowerCase();
    if (v.includes("content-security-policy") || v === "refresh" || v.includes("x-frame")) $(el).remove();
  });
  $("meta[charset]").remove();
  $("meta[http-equiv='Content-Type' i]").remove();
  $("[integrity]").removeAttr("integrity");
  $("link[crossorigin], img[crossorigin]").removeAttr("crossorigin");

  // Strip inline event handlers and javascript: links.
  $("*").each((_, el) => {
    const attribs = el.attribs || {};
    for (const name of Object.keys(attribs)) {
      if (/^on/i.test(name)) $(el).removeAttr(name);
      else if (URL_ATTRS.includes(name.toLowerCase()) && /^\s*javascript:/i.test(attribs[name])) $(el).attr(name, "#");
    }
  });

  // Pages that lazy-load images with JavaScript: show the real images.
  $("img, source, iframe").each((_, el) => {
    const $el = $(el);
    for (const a of LAZY_SRC) {
      const v = $el.attr(a);
      if (v && isPlaceholder($el.attr("src"))) { $el.attr("src", v); break; }
    }
    for (const a of LAZY_SRCSET) {
      const v = $el.attr(a);
      if (v) { $el.attr("srcset", v); break; }
    }
  });
  $(".lazyload, .lazy").removeClass("lazyload lazy");

  // <noscript> fallbacks become visible content when they hold real images; tracking pixels go.
  $("noscript").each((_, el) => {
    const $el = $(el);
    const imgs = $el.find("img, picture");
    const pixel = imgs.length && imgs.toArray().every((i) => $(i).attr("width") === "1" || $(i).attr("height") === "1");
    if (imgs.length && !pixel && !$el.find("iframe").length) $el.replaceWith($el.contents());
    else $el.remove();
  });

  $("head").prepend(
    `<meta charset="utf-8"><base href="${escapeAttr(baseHref)}"><meta name="referrer" content="no-referrer">`
  );

  // How much is actually on the page once scripts are gone? Used to detect empty app shells.
  const $body = $("body").clone();
  $body.find("style, template, svg, [hidden]").remove();
  const textLength = $body.text().replace(/\s+/g, " ").trim().length;
  const mediaCount = $("body img, body picture, body video").length;

  const cfg = JSON.stringify({ proxied: true, original: pageUrl.href, mode }).replace(/</g, "\\u003c");
  $("body").append(
    `<script nonce="__NONCE__">window.__CAT_CHAOS_CFG=${cfg};</script>` +
    `<script nonce="__NONCE__">${ENGINE}</script>` +
    `<script nonce="__NONCE__">${BOOT}</script>`
  );

  return { page: "<!DOCTYPE html>\n" + $.html(), looksEmpty: textLength < 250 && mediaCount < 3 };
}

function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ------------------------------------------------------------------ */
/* Small cache and rate limiter (in memory, good for one instance).    */
/* ------------------------------------------------------------------ */

const cache = new Map();
function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.t > CACHE_TTL_MS) { cache.delete(key); return null; }
  return hit.html;
}
function cacheSet(key, html) {
  cache.set(key, { html, t: Date.now() });
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}

function makeLimiter(max) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [ip, list] of hits) if (!list.some((t) => now - t < 60000)) hits.delete(ip);
  }, 60000).unref();
  return (ip) => {
    const now = Date.now();
    const list = (hits.get(ip) || []).filter((t) => now - t < 60000);
    list.push(now);
    hits.set(ip, list);
    return list.length > max;
  };
}
const rateLimited = makeLimiter(RATE_LIMIT);
const cardLimited = makeLimiter(20);
const renderLimited = makeLimiter(RENDER_LIMIT);

const renderer = createRenderer({ isPublicIp, FetchError, maxBytes: MAX_BYTES, userAgent: USER_AGENT });

// Static first (fast). Fall back to a full browser when the page is an empty app shell,
// when the visitor asks for it, or when the plain request was refused.
async function buildPage(target, forceRender, ip) {
  const key = (forceRender ? "render:" : "auto:") + target.href;
  const cached = cacheGet(key);
  if (cached) return cached;

  let staticResult = null, staticError = null;
  if (!forceRender) {
    try {
      const { html, finalUrl } = await fetchPage(target);
      staticResult = transform(html, finalUrl, "static");
      if (!staticResult.looksEmpty) {
        cacheSet(key, staticResult.page);
        return staticResult.page;
      }
    } catch (err) {
      if (!(err instanceof FetchError)) throw err;
      if (!["refused", "bad_status", "timeout", "unreachable"].includes(err.code)) throw err;
      staticError = err;
    }
  }

  if (renderLimited(ip)) {
    if (staticResult) return staticResult.page;
    throw new FetchError("rate", "The cat needs a breather. Full page loads are limited to 10 a minute, so wait a moment and try again.", 429);
  }

  try {
    const { html, finalUrl } = await renderer.render(target);
    const page = transform(html, finalUrl, "rendered").page;
    cacheSet(key, page);
    return page;
  } catch (err) {
    if (err instanceof RenderUnavailable) console.warn("Full-browser rendering unavailable:", err.message);
    else if (!(err instanceof FetchError)) console.error("Render failed for", target.href, err);
    if (staticResult) return staticResult.page;
    if (staticError) throw staticError;
    if (err instanceof FetchError) throw err;
    throw new FetchError("unreachable", "That website couldn't be loaded.", 502);
  }
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

const app = express();
app.set("trust proxy", true);
app.disable("x-powered-by");

app.get("/healthz", (_req, res) => res.type("text").send("ok"));
app.get("/version", (_req, res) => res.json({ version: "5.2.0", landing: "black-orange", fullBrowserRender: true }));
app.get("/demo", (_req, res) => res.sendFile(path.join(PUBLIC, "demo.html")));

function originOf(req) {
  return `${req.protocol}://${req.get("host")}`;
}

// Landing page, with an absolute preview image URL for link cards.
app.get(["/", "/index.html"], (req, res) => {
  res.set("Cache-Control", "no-cache");
  res.type("html").send(INDEX_TEMPLATE.replaceAll("__ORIGIN__", originOf(req)));
});

// Share page: what people land on from a shared score, and what X reads for the card.
app.get("/s", (req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.type("html").send(sharePageHtml(parseScore(req.query), originOf(req)));
});

// 1200x630 score card image, drawn by headless Chromium and kept in memory.
const cardCache = new Map();
const CARD_CACHE_MAX = 300;
app.get("/card.png", async (req, res) => {
  const data = parseScore(req.query);
  const host = req.get("host") || "";
  const key = data.intro ? "intro|" + host : shareQuery(data) + "|" + host;
  let png = cardCache.get(key);
  if (!png) {
    const bot = /twitterbot|facebookexternalhit|slackbot|discordbot|telegrambot|linkedinbot|whatsapp/i.test(req.get("user-agent") || "");
    if (!bot && cardLimited(req.ip)) return res.status(429).type("text").send("Too many cards. Try again in a minute.");
    try {
      png = await renderer.screenshot(cardHtml(data, host), 1200, 630);
    } catch (err) {
      console.warn("Card render failed:", err.message);
      return res.status(503).type("text").send("The score card couldn't be drawn right now.");
    }
    cardCache.set(key, png);
    while (cardCache.size > CARD_CACHE_MAX) cardCache.delete(cardCache.keys().next().value);
  }
  res.set({ "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" });
  res.send(png);
});
// Always revalidate, so a new deploy shows up on the next refresh instead of an hour later.
app.use(express.static(PUBLIC, {
  extensions: ["html"],
  setHeaders(res) { res.setHeader("Cache-Control", "no-cache"); },
}));

function sendError(res, status, message, attempted) {
  const html = ERROR_TEMPLATE
    .replace("__MESSAGE__", escapeHtml(message))
    .replace("__URL__", escapeAttr(attempted || ""));
  res.status(status).type("html").send(html);
}

app.get("/play", async (req, res) => {
  const input = req.query.url;
  if (rateLimited(req.ip)) {
    return sendError(res, 429, "The cat needs a breather. You've opened a lot of pages in the last minute, so wait a moment and try again.", input);
  }
  let target;
  try {
    target = normalizeUrl(input);
  } catch (err) {
    return sendError(res, err.status || 400, err.message, input);
  }

  try {
    const page = await buildPage(target, req.query.render === "1", req.ip);
    const nonce = crypto.randomBytes(16).toString("base64");
    res.set({
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy":
        `default-src * data: blob:; script-src 'nonce-${nonce}'; style-src * 'unsafe-inline' data:; ` +
        "img-src * data: blob:; font-src * data:; media-src * data: blob:; frame-src *; " +
        "object-src 'none'; form-action 'none'; base-uri *",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
      "Cache-Control": "no-store",
    });
    res.send(page.replaceAll("__NONCE__", nonce));
  } catch (err) {
    if (err instanceof FetchError) return sendError(res, err.status, err.message, input);
    console.error("Unexpected error for", target.href, err);
    return sendError(res, 500, "Something went wrong while loading that page. Try again, or try another website.", input);
  }
});

app.use((_req, res) => sendError(res, 404, "There's nothing at this address. Head back and type a website to open.", ""));

app.listen(PORT, () => {
  console.log(`Orange Cat Chaos is listening on port ${PORT}`);
  renderer.warm();
});
