(function () {
  "use strict";
  var cfg = window.__CAT_CHAOS_CFG || {};
  var HOME = location.origin + "/";

  if (cfg.proxied) {
    /* Links open the next page through Cat Chaos instead of leaving it. */
    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!a || e.defaultPrevented || e.button !== 0) return;
      var href = a.href;
      if (!/^https?:/i.test(href)) return;
      e.preventDefault();
      var here = String(cfg.original || "").split("#")[0];
      if (href.split("#")[0] === here && a.hash) { location.hash = a.hash; return; }
      location.href = HOME + "play?url=" + encodeURIComponent(href);
    }, true);
    /* Forms never send anything anywhere. */
    document.addEventListener("submit", function (e) { e.preventDefault(); }, true);
  }

  function bar() {
    var host = document.createElement("div");
    host.setAttribute("data-cat-chaos", "");
    host.style.cssText = "all:initial;position:fixed;top:12px;left:12px;z-index:2147483647;";
    document.documentElement.appendChild(host);
    var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    var font = "system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
    var wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-wrap:wrap;max-width:calc(100vw - 24px);gap:6px;font:700 13px/1 " + font + ";";
    function link(text, href, newTab) {
      var a = document.createElement("a");
      a.textContent = text; a.href = href;
      if (newTab) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
      a.style.cssText = "all:unset;cursor:pointer;background:#231c30;color:#fff4ea;border:2px solid #ff7a1a;border-radius:999px;padding:8px 13px;box-shadow:0 4px 14px rgba(0,0,0,.25);";
      a.addEventListener("mouseenter", function () { a.style.background = "#ff7a1a"; a.style.color = "#231c30"; });
      a.addEventListener("mouseleave", function () { a.style.background = "#231c30"; a.style.color = "#fff4ea"; });
      a.addEventListener("click", function (e) { e.stopPropagation(); if (!newTab) { e.preventDefault(); location.href = href; } });
      wrap.appendChild(a);
      return a;
    }
    link("\u2190 New website", HOME, false);
    if (cfg.original) link("Original page", cfg.original, true);
    if (cfg.mode === "static" && cfg.original) {
      var full = link("Page looks broken? Load it fully", HOME + "play?render=1&url=" + encodeURIComponent(cfg.original), false);
      full.title = "Opens the page in a full browser first, so sites built with JavaScript show up. Takes a few seconds.";
    }
    root.appendChild(wrap);
  }

  var started = false;
  function start() {
    if (started) return;
    started = true;
    bar();
    if (typeof catChaos === "function") catChaos();
  }
  if (document.readyState === "complete") start();
  else { window.addEventListener("load", start); setTimeout(start, 2500); }
})();
