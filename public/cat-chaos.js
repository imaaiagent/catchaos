function catChaos(opts) {
  "use strict";
  opts = opts || {};
  if (window.__catChaos) { window.__catChaos.quit(); return; }
  var W = window, D = document, M = Math;
  var hudOn = opts.hud !== false, keysOn = opts.keys !== false, cameraOn = opts.camera !== false;
  var scopeEl = opts.scope || null;

  /* ---------- helpers ---------- */
  function h(tag, css, text) {
    var e = D.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }
  function rnd(a, b) { return a + M.random() * (b - a); }
  function pick(a) { return a[(M.random() * a.length) | 0]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function now() { return performance.now(); }
  function docH() { return M.max(D.documentElement.scrollHeight, D.body ? D.body.scrollHeight : 0, W.innerHeight); }
  function scopeRect() {
    if (scopeEl && scopeEl.isConnected) return scopeEl.getBoundingClientRect();
    return { left: 0, top: 0, right: W.innerWidth, bottom: docH() - W.scrollY, width: W.innerWidth };
  }
  function groundY() {
    if (scopeEl && scopeEl.isConnected) return scopeEl.getBoundingClientRect().bottom + W.scrollY - 2;
    return docH() - 2;
  }
  function scrollToY(y) {
    try { W.scrollTo({ top: y, left: W.scrollX, behavior: "instant" }); }
    catch (e) { W.scrollTo(W.scrollX, y); }
  }

  /* ---------- host + shadow root ---------- */
  var host = h("div", "all:initial;position:absolute;top:0;left:0;width:0;height:0;overflow:visible;z-index:2147483647;pointer-events:none;");
  host.setAttribute("data-cat-chaos", "");
  D.documentElement.appendChild(host);
  var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;

  var FONT = "system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  var CSS =
    ":host{all:initial}" +
    "*{box-sizing:border-box}" +
    ".hud{position:fixed;top:12px;right:12px;width:268px;background:#0d0d0d;color:#f6f1ea;font:600 13px/1.4 " + FONT + ";border-radius:16px;padding:12px 14px 12px;box-shadow:0 10px 30px rgba(0,0,0,.35);pointer-events:auto;border:2px solid #ff7a1a;user-select:none;-webkit-user-select:none}" +
    ".row{display:flex;align-items:center;gap:6px}" +
    ".title{flex:1;font-weight:800;font-size:14px;letter-spacing:.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".btn{all:unset;cursor:pointer;width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:#262626;color:#f6f1ea;font:700 13px/1 " + FONT + "}" +
    ".btn:hover{background:#ff7a1a;color:#0d0d0d}" +
    ".btn:focus-visible{outline:2px solid #ffd3a1;outline-offset:2px}" +
    ".score{font-size:30px;font-weight:900;color:#ff9a45;margin-top:6px;line-height:1.1}" +
    ".rank{font-size:12px;color:#ffd3a1;margin-bottom:6px}" +
    ".stats{display:flex;gap:12px;font-size:12px;color:#b8b2aa}" +
    ".stats b{color:#f6f1ea}" +
    ".mode{margin-top:6px;font-size:12px;color:#b8b2aa}" +
    ".help{margin-top:8px;border-top:1px solid #262626;padding-top:8px;font-size:12px;font-weight:500;color:#d6d0c8;display:grid;grid-template-columns:auto 1fr;gap:4px 10px;align-items:start}" +
    ".help kbd{font:700 11px/1.5 " + FONT + ";background:#262626;border-radius:5px;padding:0 5px;color:#f6f1ea;white-space:nowrap;justify-self:start;align-self:start}" +
    ".toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#0d0d0d;color:#f6f1ea;border:2px solid #ff7a1a;border-radius:999px;padding:8px 16px;font:700 13px/1.3 " + FONT + ";opacity:0;transition:opacity .25s;pointer-events:none;max-width:90vw;text-align:center}" +
    ".pad{position:fixed;bottom:16px;display:flex;gap:10px;pointer-events:auto}" +
    ".pad button{all:unset;width:58px;height:58px;border-radius:50%;background:rgba(35,28,48,.82);border:2px solid #ff7a1a;color:#f6f1ea;font:800 12px/1 " + FONT + ";display:grid;place-items:center;touch-action:none;-webkit-user-select:none;user-select:none}" +
    ".pad button.on{background:#ff7a1a;color:#0d0d0d}" +
    "canvas{position:fixed;left:0;top:0;pointer-events:none}" +
    ".marks{position:absolute;left:0;top:0;width:0;height:0;overflow:visible;pointer-events:none}" +
    ".mark{position:absolute;pointer-events:none;transition:opacity .4s}";
  var styleOk = false;
  try {
    if (root.adoptedStyleSheets !== undefined && W.CSSStyleSheet) {
      var sheet = new CSSStyleSheet(); sheet.replaceSync(CSS);
      root.adoptedStyleSheets = [sheet]; styleOk = true;
    }
  } catch (e) {}
  if (!styleOk) { var st = h("style"); st.textContent = CSS; root.appendChild(st); }

  var marksLayer = h("div"); marksLayer.className = "marks"; root.appendChild(marksLayer);
  var cv = h("canvas"); root.appendChild(cv);
  var ctx = cv.getContext("2d");
  var dpr = 1;
  function resize() {
    dpr = M.min(W.devicePixelRatio || 1, 2);
    cv.width = W.innerWidth * dpr; cv.height = W.innerHeight * dpr;
    cv.style.width = W.innerWidth + "px"; cv.style.height = W.innerHeight + "px";
  }
  resize();

  /* ---------- HUD ---------- */
  var hud = h("div"); hud.className = "hud"; root.appendChild(hud);
  var top = h("div"); top.className = "row"; hud.appendChild(top);
  var title = h("div", null, "\uD83D\uDC08 Cat Chaos"); title.className = "title"; top.appendChild(title);
  function mkBtn(label, tip, fn) {
    var b = h("button", null, label); b.className = "btn"; b.title = tip; b.setAttribute("aria-label", tip);
    b.addEventListener("click", function (e) { e.stopPropagation(); fn(); b.blur(); });
    top.appendChild(b); return b;
  }
  var muted = false;
  var bMute = mkBtn("\u266A", "Mute sounds", function () { muted = !muted; bMute.textContent = muted ? "\u00D7\u266A" : "\u266A"; bMute.title = muted ? "Unmute sounds" : "Mute sounds"; });
  var bHelp = mkBtn("?", "Show controls", function () { toggleHelp(); });
  mkBtn("\u21BA", "Restore the page", function () { restore(false); });
  mkBtn("\u2715", "Send the cat home", function () { quit(); });

  var scoreEl = h("div", null, "0"); scoreEl.className = "score"; hud.appendChild(scoreEl);
  var rankEl = h("div", null, "Suspiciously calm"); rankEl.className = "rank"; hud.appendChild(rankEl);
  var stats = h("div"); stats.className = "stats"; hud.appendChild(stats);
  var knockedLabel = h("span", null, "Knocked off "), knockedEl = h("b", null, "0");
  var sp1 = h("span"); sp1.appendChild(knockedLabel); sp1.appendChild(knockedEl); stats.appendChild(sp1);
  var comboLabel = h("span", null, "Combo "), comboEl = h("b", null, "x1");
  var sp2 = h("span"); sp2.appendChild(comboLabel); sp2.appendChild(comboEl); stats.appendChild(sp2);
  var modeEl = h("div", null, "Laser pointer: off (press P)"); modeEl.className = "mode"; hud.appendChild(modeEl);

  var help = h("div"); help.className = "help"; hud.appendChild(help);
  [["\u2190 \u2192", "Walk (or A / D)"], ["\u2191 / Space", "Jump, twice for a double jump"], ["\u2193 + Jump", "Drop down through a ledge"],
   ["J or Z", "Swat what's in front"], ["\u2193 + J", "Swat what's underneath"], ["K or X (hold)", "Scratch until it breaks"],
   ["L or C", "Cough up a hairball"], ["Shift (hold)", "Zoomies"], ["M", "Meow"], ["P", "Laser pointer: the cat chases your mouse"],
   ["R", "Restore the page"], ["Esc", "Send the cat home"]].forEach(function (r) {
    help.appendChild(h("kbd", null, r[0])); help.appendChild(h("span", null, r[1]));
  });
  var helpOpen = true;
  function toggleHelp() { helpOpen = !helpOpen; help.style.display = helpOpen ? "grid" : "none"; bHelp.title = helpOpen ? "Hide controls" : "Show controls"; }

  var toast = h("div"); toast.className = "toast"; root.appendChild(toast);
  var toastT = 0;
  if (!hudOn) { hud.style.display = "none"; toast.style.display = "none"; }
  function say(msg) {
    if (!hudOn) return; toast.textContent = msg; toast.style.opacity = "1"; clearTimeout(toastT); toastT = setTimeout(function () { toast.style.opacity = "0"; }, 2200); }

  /* ---------- touch pad ---------- */
  var keys = {}, pressed = {};
  var isTouch = ("ontouchstart" in W) || (navigator.maxTouchPoints > 0 && W.matchMedia && W.matchMedia("(pointer: coarse)").matches);
  if (isTouch && hudOn) toggleHelp();
  if (isTouch && hudOn && keysOn) {
    var padL = h("div"); padL.className = "pad"; padL.style.left = "14px"; root.appendChild(padL);
    var padR = h("div"); padR.className = "pad"; padR.style.right = "14px"; root.appendChild(padR);
    var mkPad = function (parent, label, k) {
      var b = h("button", null, label); parent.appendChild(b);
      var down = function (e) { e.preventDefault(); e.stopPropagation(); keys[k] = true; pressed[k] = true; b.className = "on"; wake(); audioInit(); };
      var up = function (e) { e.preventDefault(); keys[k] = false; b.className = ""; };
      b.addEventListener("pointerdown", down); b.addEventListener("pointerup", up);
      b.addEventListener("pointercancel", up); b.addEventListener("pointerleave", up);
    };
    mkPad(padL, "\u25C0", "left"); mkPad(padL, "\u25B6", "right");
    mkPad(padR, "Jump", "jump"); mkPad(padR, "Swat", "swat"); mkPad(padR, "Claw", "scratch"); mkPad(padR, "Hair\nball", "hairball");
  }

  /* ---------- audio ---------- */
  var AC = null;
  function audioInit() {
    if (AC) { if (AC.state === "suspended") AC.resume(); return; }
    try { AC = new (W.AudioContext || W.webkitAudioContext)(); } catch (e) { AC = null; }
  }
  function env(g, t0, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }
  var noiseBuf = null;
  function noiseSrc() {
    if (!noiseBuf) {
      noiseBuf = AC.createBuffer(1, AC.sampleRate * 0.6, AC.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = M.random() * 2 - 1;
    }
    var s = AC.createBufferSource(); s.buffer = noiseBuf; return s;
  }
  function sfx(kind) {
    if (!AC || muted) return;
    var t = AC.currentTime, g, o, f, n;
    if (kind === "swoosh") {
      n = noiseSrc(); f = AC.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 2;
      f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(3000, t + 0.15);
      g = AC.createGain(); env(g, t, 0.02, 0.16, 0.25);
      n.connect(f); f.connect(g); g.connect(AC.destination); n.start(t); n.stop(t + 0.25);
    } else if (kind === "hit") {
      o = AC.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.15);
      g = AC.createGain(); env(g, t, 0.005, 0.18, 0.5);
      o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + 0.25);
    } else if (kind === "crash") {
      n = noiseSrc(); f = AC.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 2500;
      g = AC.createGain(); env(g, t, 0.003, 0.3, 0.22);
      n.connect(f); f.connect(g); g.connect(AC.destination); n.start(t); n.stop(t + 0.4);
      for (var i = 0; i < 4; i++) {
        var tt = t + rnd(0, 0.12); o = AC.createOscillator(); o.type = "sine"; o.frequency.value = rnd(2200, 5200);
        var g2 = AC.createGain(); env(g2, tt, 0.002, rnd(0.08, 0.25), 0.08);
        o.connect(g2); g2.connect(AC.destination); o.start(tt); o.stop(tt + 0.35);
      }
    } else if (kind === "scratch") {
      n = noiseSrc(); f = AC.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 6; f.frequency.value = rnd(1800, 3200);
      g = AC.createGain(); env(g, t, 0.005, 0.07, 0.18);
      n.connect(f); f.connect(g); g.connect(AC.destination); n.start(t); n.stop(t + 0.1);
    } else if (kind === "meow") {
      var base = rnd(480, 620), dur = rnd(0.45, 0.7);
      o = AC.createOscillator(); o.type = "sawtooth";
      o.frequency.setValueAtTime(base, t);
      o.frequency.linearRampToValueAtTime(base * 1.45, t + dur * 0.35);
      o.frequency.linearRampToValueAtTime(base * 0.8, t + dur);
      f = AC.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 3;
      f.frequency.setValueAtTime(700, t); f.frequency.linearRampToValueAtTime(1600, t + dur * 0.4); f.frequency.linearRampToValueAtTime(900, t + dur);
      g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.06);
      g.gain.setValueAtTime(0.3, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f); f.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + dur + 0.05);
    } else if (kind === "cough") {
      for (var k = 0; k < 2; k++) {
        var t1 = t + k * 0.13; n = noiseSrc(); f = AC.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900;
        g = AC.createGain(); env(g, t1, 0.01, 0.1, 0.35);
        n.connect(f); f.connect(g); g.connect(AC.destination); n.start(t1); n.stop(t1 + 0.15);
      }
    } else if (kind === "jump") {
      o = AC.createOscillator(); o.type = "triangle";
      o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(700, t + 0.1);
      g = AC.createGain(); env(g, t, 0.005, 0.1, 0.12);
      o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + 0.15);
    }
  }

  /* ---------- page targets ---------- */
  var SKIP = { SCRIPT: 1, STYLE: 1, LINK: 1, META: 1, HEAD: 1, TITLE: 1, NOSCRIPT: 1, BR: 1, HTML: 1, BODY: 1, TEMPLATE: 1, OPTION: 1, SOURCE: 1, TRACK: 1, WBR: 1, OPTGROUP: 1, DATALIST: 1, PARAM: 1, AREA: 1, MAP: 1 };
  var MEDIA = { IMG: 1, SVG: 1, VIDEO: 1, CANVAS: 1, BUTTON: 1, INPUT: 1, TEXTAREA: 1, SELECT: 1, IFRAME: 1, PICTURE: 1, HR: 1, PROGRESS: 1, METER: 1, EMBED: 1, OBJECT: 1 };
  var list = [];
  var marksByEl = new Map();
  function hasText(el) {
    var c = el.childNodes;
    for (var i = 0; i < c.length; i++) if (c[i].nodeType === 3 && /\S/.test(c[i].nodeValue)) return true;
    return false;
  }
  function transparent(c) { return !c || c === "transparent" || /rgba\([^)]*,\s*0\)$/.test(c); }
  function scan() {
    var old = new Map();
    list.forEach(function (p) { old.set(p.el, p); });
    var out = [];
    if (!D.body) { list = out; return; }
    var all = (scopeEl && scopeEl.isConnected ? scopeEl : D.body).getElementsByTagName("*");
    var vpA = W.innerWidth * W.innerHeight, sx = W.scrollX, sy = W.scrollY;
    for (var i = 0; i < all.length && out.length < 2500; i++) {
      var el = all[i];
      if (el === host) continue;
      var tag = el.tagName.toUpperCase();
      if (SKIP[tag] || el.ownerSVGElement) continue;
      if (el.closest("[data-cc-gone]")) continue;
      var r = el.getBoundingClientRect();
      if (r.width < 14 || r.height < 8) continue;
      var area = r.width * r.height;
      if (area > vpA * 0.6) continue;
      var isLedge = el.hasAttribute("data-cat-ledge");
      var ok = isLedge || MEDIA[tag] || hasText(el), cs = null;
      if (!ok) {
        if (area > vpA * 0.3) continue;
        cs = getComputedStyle(el);
        ok = cs.backgroundImage !== "none" || !transparent(cs.backgroundColor) || parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== "none";
        if (!ok) continue;
      }
      cs = cs || getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.opacity === "0" || cs.display === "contents") continue;
      var p = old.get(el) || { el: el, dmg: 0 };
      p.l = r.left + sx; p.r = r.right + sx; p.t = r.top + sy; p.b = r.bottom + sy; p.area = area; p.gone = false;
      p.ledge = isLedge || !!el.closest("[data-cat-safe]");
      out.push(p);
    }
    list = out;
  }
  function refreshRects() {
    var sx = W.scrollX, sy = W.scrollY;
    for (var i = 0; i < list.length; i++) {
      var p = list[i]; if (p.gone) continue;
      if (!p.el.isConnected) { p.gone = true; continue; }
      var r = p.el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) { p.gone = true; continue; }
      p.l = r.left + sx; p.r = r.right + sx; p.t = r.top + sy; p.b = r.bottom + sy; p.area = r.width * r.height;
    }
  }

  /* ---------- state ---------- */
  var S = opts.scale || 1.15; /* cat scale */
  var cat = {
    x: W.scrollX + (scopeRect().left + scopeRect().right) * 0.5, y: W.scrollY + M.max(scopeRect().top, 0) + 30, vx: 0, vy: 0, face: 1, grounded: false, on: null, jumps: 0,
    swatT: 0, swatDown: false, scratchT: 0, scratchAnim: 0, coughT: 0, anim: 0, idle: 0, sleep: false, blink: 0,
    dropT: 0, dropFrom: null, bubble: "Mrrp?", bubbleT: 120, land: 0
  };
  var score = 0, knocked = 0, combo = 1, lastKnock = 0, bestCombo = 1;
  var flyers = [], parts = [], balls = [], saved = [];
  var laser = !!opts.auto, mouse = { x: -100, y: -100, moved: 0 }, aiSwat = 0, aiTarget = null, aiPickT = 0;
  var freeCam = 0, lastRestoreKnocked = 0;
  var RANKS = [[0, "Suspiciously calm"], [3, "Testing the edge of the table"], [10, "Mildly inconvenient"], [25, "Knocking things off tables"],
    [50, "Professional menace"], [90, "Absolute unit of chaos"], [150, "One brain cell, full power"], [250, "The website belongs to the cat now"]];
  var EXCL = ["SMACK!", "BONK!", "*knocks it off*", "Oops.", "YEET", "Gone.", "Not sorry.", "Mine."];
  var MEOWS = ["Meow.", "Mrrp?", "Mew!", "Feed me.", "This website is mine now.", "*stares at you*", "Mrow.", "I meant to do that."];

  function rank() { var r = RANKS[0][1]; for (var i = 0; i < RANKS.length; i++) if (knocked >= RANKS[i][0]) r = RANKS[i][1]; return r; }

  /* ---------- particles ---------- */
  var FUR = ["#f5841f", "#ffb066", "#c85a0a"];
  var SHARD = ["#ffffff", "#dfe8f7", "#f5841f", "#9fb6e0", "#2b2b2b"];
  function burst(x, y, n, kind) {
    for (var i = 0; i < n; i++) {
      parts.push({
        x: x + rnd(-8, 8), y: y + rnd(-8, 8), vx: rnd(-5, 5), vy: rnd(-7, -1), life: rnd(30, 60), max: 60,
        kind: kind, c: pick(kind === "fur" ? FUR : kind === "dust" ? ["#bdb6ad", "#d9d3cb", "#a39a8f"] : SHARD),
        s: rnd(2, 5), rot: rnd(0, 6.28), vr: rnd(-0.3, 0.3)
      });
    }
  }
  function floatText(x, y, txt, color, size) {
    parts.push({ x: x, y: y, vx: rnd(-0.5, 0.5), vy: -1.6, life: 70, max: 70, kind: "text", txt: txt, c: color || "#ff7a1a", s: size || 16 });
  }

  /* ---------- destruction ---------- */
  function removeMarks(el) {
    var arr = marksByEl.get(el); if (!arr) return;
    arr.forEach(function (m) { m.style.opacity = "0"; setTimeout(function () { m.remove(); }, 450); });
    marksByEl.delete(el);
  }
  function knock(p, dir, force, how) {
    if (p.gone || p.ledge) return;
    var el = p.el;
    p.gone = true;
    for (var i = 0; i < list.length; i++) { var q = list[i]; if (!q.gone && q !== p && el.contains(q.el)) { q.gone = true; removeMarks(q.el); } }
    removeMarks(el);
    saved.push({ el: el, style: el.getAttribute("style") });
    el.setAttribute("data-cc-gone", "");
    var cs = getComputedStyle(el);
    if (cs.position === "static") el.style.setProperty("position", "relative", "important");
    if (cs.display === "inline") el.style.setProperty("display", "inline-block", "important");
    el.style.setProperty("z-index", "2147483646", "important");
    el.style.setProperty("transition", "none", "important");
    el.style.setProperty("pointer-events", "none", "important");
    el.style.setProperty("will-change", "transform", "important");
    var cx = (p.l + p.r) / 2, cy = (p.t + p.b) / 2;
    var heavy = M.min(1, 9000 / M.max(p.area, 1));
    flyers.push({
      el: el, x: 0, y: 0, vx: dir * rnd(4, 9) * force * (0.5 + heavy * 0.7), vy: -rnd(5, 10) * force * (0.6 + heavy * 0.5),
      rot: 0, vr: dir * rnd(3, 12) * (0.4 + heavy), cy: cy, crashed: false
    });
    var t = now();
    combo = (t - lastKnock < 1600) ? combo + 1 : 1;
    lastKnock = t; bestCombo = M.max(bestCombo, combo);
    var pts = M.round(clamp(M.sqrt(p.area) * 1.5, 10, 400) * M.min(combo, 10) * (how === "shred" ? 1.5 : how === "hairball" ? 1.3 : 1));
    score += pts; knocked++;
    if (hudOn) floatText(cx, p.t - 6, "+" + pts, "#ff7a1a", combo > 3 ? 20 : 16);
    if (hudOn) { if (M.random() < 0.35 || combo === 5 || combo === 10) floatText(cx, p.t - 28, combo >= 5 ? "COMBO x" + combo + "!" : pick(EXCL), "#0d0d0d", 15); }
    else if (M.random() < 0.2) floatText(cx, p.t - 18, pick(EXCL), "#ff7a1a", 15);
    burst(cx, cy, 10, "shard");
    sfx("hit");
    scheduleScan();
  }
  function overlap(p, b) { return p.l < b.r && p.r > b.l && p.t < b.b && p.b > b.t; }
  function hitsIn(box, maxN, skipEl) {
    var hits = [];
    for (var i = 0; i < list.length; i++) { var p = list[i]; if (!p.gone && !p.ledge && p !== skipEl && overlap(p, box)) hits.push(p); }
    hits.sort(function (a, b) { return a.area - b.area; });
    var chosen = [];
    for (var j = 0; j < hits.length && chosen.length < maxN; j++) {
      var c = hits[j], clash = false;
      for (var k = 0; k < chosen.length; k++) if (chosen[k].el.contains(c.el) || c.el.contains(chosen[k].el)) { clash = true; break; }
      if (!clash) chosen.push(c);
    }
    return chosen;
  }
  function swat(down) {
    if (cat.swatT > 0) return;
    cat.swatT = 16; cat.swatDown = !!down; sfx("swoosh");
    var x = cat.x, y = cat.y, f = cat.face, box;
    if (down) box = { l: x - 30, r: x + 30, t: y - 4, b: y + 40 };
    else box = { l: f > 0 ? x + 4 : x - 66 * S, r: f > 0 ? x + 66 * S : x - 4, t: y - 60 * S, b: y - 3 };
    var hits = hitsIn(box, 3, null);
    hits.forEach(function (p) { knock(p, down ? (M.random() < 0.5 ? -1 : 1) : f, down ? 0.8 : 1, "swat"); });
    if (!hits.length) burst(x + f * 40, y - 24, 3, "dust");
  }
  var SVGNS = "http://www.w3.org/2000/svg";
  function clawMark(px, py, p) {
    var m = D.createElement("div"); m.className = "mark";
    var w = 34, hh = 30;
    m.style.left = (px - w / 2) + "px"; m.style.top = (py - hh / 2) + "px";
    m.style.transform = "rotate(" + rnd(-30, 30) + "deg)";
    var svg = D.createElementNS(SVGNS, "svg");
    svg.setAttribute("width", w); svg.setAttribute("height", hh); svg.setAttribute("viewBox", "0 0 34 30");
    [[7, 2, 11, 15, 8, 28], [16, 1, 20, 15, 17, 29], [25, 2, 29, 15, 26, 27]].forEach(function (c) {
      var d = "M" + c[0] + " " + c[1] + " Q" + c[2] + " " + c[3] + " " + c[4] + " " + c[5];
      var a = D.createElementNS(SVGNS, "path"); a.setAttribute("d", d); a.setAttribute("fill", "none");
      a.setAttribute("stroke", "#4a1608"); a.setAttribute("stroke-width", "3.4"); a.setAttribute("stroke-linecap", "round");
      var b = D.createElementNS(SVGNS, "path"); b.setAttribute("d", d); b.setAttribute("fill", "none");
      b.setAttribute("stroke", "rgba(255,255,255,.75)"); b.setAttribute("stroke-width", "1"); b.setAttribute("stroke-linecap", "round");
      b.setAttribute("transform", "translate(1.4,0)");
      svg.appendChild(a); svg.appendChild(b);
    });
    m.appendChild(svg); marksLayer.appendChild(m);
    var arr = marksByEl.get(p.el); if (!arr) { arr = []; marksByEl.set(p.el, arr); } arr.push(m);
  }
  function scratchTick() {
    var x = cat.x, y = cat.y, f = cat.face;
    var front = { l: f > 0 ? x + 6 : x - 50 * S, r: f > 0 ? x + 50 * S : x - 6, t: y - 50 * S, b: y - 3 };
    var hits = hitsIn(front, 1, null);
    var p = hits[0], px, py;
    if (p) { px = clamp(x + f * 34, p.l + 10, p.r - 10); py = clamp(y - 24, p.t + 8, p.b - 8); }
    else if (cat.on && cat.on !== "ground" && !cat.on.gone && !cat.on.ledge) { p = cat.on; px = clamp(x + f * 16, p.l + 10, p.r - 10); py = clamp(p.t + 14, p.t + 4, p.b - 4); }
    if (!p) { burst(x + f * 30, y - 20, 2, "fur"); return; }
    sfx("scratch");
    clawMark(px + rnd(-8, 8), py + rnd(-6, 6), p);
    p.dmg = (p.dmg || 0) + 1;
    burst(px, py, 3, "dust");
    var need = clamp(3 + M.round(p.area / 9000), 3, 12);
    if (p.dmg >= need) {
      floatText((p.l + p.r) / 2, p.t - 40, "SHREDDED", "#c0392b", 18);
      burst((p.l + p.r) / 2, (p.t + p.b) / 2, 18, "shard");
      knock(p, f, 1.2, "shred");
    }
  }
  function cough() {
    if (cat.coughT > 0) return;
    cat.coughT = 30; sfx("cough");
  }
  function spawnBall() {
    balls.push({ x: cat.x + cat.face * 34 * S, y: cat.y - 26 * S, vx: cat.face * 11, vy: -3.5, r: 7, rot: 0, life: 200 });
    floatText(cat.x + cat.face * 30, cat.y - 64, "*hack*", "#6b7d3a", 14);
  }
  function meow(txt) {
    cat.bubble = txt || pick(MEOWS); cat.bubbleT = 110; sfx("meow");
  }

  var scanTimer = 0;
  function scheduleScan() { clearTimeout(scanTimer); scanTimer = setTimeout(scan, 500); }

  /* ---------- restore / quit ---------- */
  var calm = W.matchMedia && W.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function restore(quiet) {
    for (var i = saved.length - 1; i >= 0; i--) {
      var s = saved[i];
      if (s.style == null) s.el.removeAttribute("style"); else s.el.setAttribute("style", s.style);
      s.el.removeAttribute("data-cc-gone");
      if (s.el.animate && !calm) {
        try { s.el.animate([{ opacity: 0, transform: "translateY(-40px)" }, { opacity: 1, transform: "none" }], { duration: 420, delay: (saved.length - 1 - i) * 35, easing: "cubic-bezier(.3,1.5,.6,1)", fill: "backwards" }); } catch (e) {}
      }
    }
    saved = []; flyers = [];
    marksByEl.forEach(function (arr) { arr.forEach(function (m) { m.remove(); }); });
    marksByEl.clear();
    list.forEach(function (p) { p.dmg = 0; });
    scan();
    lastRestoreKnocked = knocked;
    if (quiet) return;
    meow("Fine. I'll do it again.");
    say("Page restored. The cat is already looking at the next thing.");
  }
  var raf = 0, alive = true;
  function quit() {
    alive = false; cancelAnimationFrame(raf);
    W.removeEventListener("keydown", kd, true); W.removeEventListener("keyup", ku, true);
    W.removeEventListener("resize", onResize); W.removeEventListener("mousemove", onMouse, true);
    W.removeEventListener("wheel", onWheel, true); W.removeEventListener("blur", onBlur);
    clearInterval(rectTimer); clearInterval(scanIv); clearTimeout(scanTimer);
    flyers.forEach(function (f) { f.el.style.visibility = "hidden"; });
    host.remove();
    try { if (AC) AC.close(); } catch (e) {}
    delete W.__catChaos;
  }

  /* ---------- input ---------- */
  function mapKey(e) {
    var c = e.code, k = e.key;
    if (c === "ArrowLeft" || c === "KeyA") return "left";
    if (c === "ArrowRight" || c === "KeyD") return "right";
    if (c === "ArrowUp" || c === "KeyW" || c === "Space") return "jump";
    if (c === "ArrowDown" || c === "KeyS") return "down";
    if (c === "KeyJ" || c === "KeyZ") return "swat";
    if (c === "KeyK" || c === "KeyX") return "scratch";
    if (c === "KeyL" || c === "KeyC") return "hairball";
    if (k === "Shift") return "zoom";
    if (c === "KeyM") return "meow";
    if (c === "KeyP") return "laser";
    if (c === "KeyR") return "restore";
    if (k === "Escape") return "quit";
    if (k === "?" || c === "KeyH") return "help";
    return null;
  }
  function kd(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var g = mapKey(e); if (!g) return;
    e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    audioInit();
    if (!keys[g]) pressed[g] = true;
    keys[g] = true;
    wake();
  }
  function ku(e) {
    var g = mapKey(e); if (!g) return;
    e.preventDefault(); e.stopPropagation();
    keys[g] = false;
  }
  function onResize() { resize(); scheduleScan(); }
  function onMouse(e) { mouse.x = e.clientX; mouse.y = e.clientY; mouse.moved = now(); }
  function onWheel() { freeCam = now(); }
  function onBlur() { keys = {}; }
  if (keysOn) { W.addEventListener("keydown", kd, true); W.addEventListener("keyup", ku, true); }
  W.addEventListener("resize", onResize); W.addEventListener("mousemove", onMouse, true);
  W.addEventListener("wheel", onWheel, { capture: true, passive: true }); W.addEventListener("blur", onBlur);

  function wake() {
    if (cat.sleep) { cat.sleep = false; cat.bubble = "!"; cat.bubbleT = 40; cat.vy = -6; cat.grounded = false; cat.on = null; }
    cat.idle = 0;
  }

  /* ---------- physics ---------- */
  var G = 0.62;
  function landingFor(prevY, newY) {
    var best = null, bt = Infinity, x = cat.x;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (p.gone || p.r - p.l < 24) continue;
      if (cat.dropT > 0 && p === cat.dropFrom) continue;
      if (x < p.l + 4 || x > p.r - 4) continue;
      if (p.t >= prevY - 1 && p.t <= newY && p.t < bt) { best = p; bt = p.t; }
    }
    return best;
  }
  function stillSupported() {
    if (cat.on === "ground") { cat.y = groundY(); return true; }
    var p = cat.on;
    if (!p || p.gone) return false;
    if (cat.x < p.l + 2 || cat.x > p.r - 2) return false;
    if (M.abs(p.t - cat.y) > 10) return false;
    cat.y = p.t; return true;
  }
  function jump() {
    if (cat.grounded) { cat.vy = -12.8; cat.grounded = false; cat.on = null; cat.jumps = 1; sfx("jump"); burst(cat.x, cat.y, 4, "dust"); }
    else if (cat.jumps < 2) { cat.vy = -11.2; cat.jumps = 2; sfx("jump"); burst(cat.x, cat.y, 5, "fur"); }
  }

  function mouseInScope() {
    if (mouse.x < 0) return false;
    var r = scopeRect();
    return mouse.x >= r.left && mouse.x <= r.right && mouse.y >= r.top && mouse.y <= r.bottom;
  }
  function ai(dt, t) {
    var targetX = null, targetY = null;
    var recent = t - mouse.moved < 3500 && mouseInScope();
    if (recent) { targetX = mouse.x + W.scrollX; targetY = mouse.y + W.scrollY; aiTarget = null; }
    else {
      if (!aiTarget || aiTarget.gone || t > aiPickT) {
        var vis = list.filter(function (p) { return !p.gone && !p.ledge && p.b > W.scrollY && p.t < W.scrollY + W.innerHeight && p.area < 60000; });
        aiTarget = vis.length ? pick(vis) : null; aiPickT = t + 6000;
      }
      if (aiTarget) { targetX = (aiTarget.l + aiTarget.r) / 2; targetY = (aiTarget.t + aiTarget.b) / 2; }
    }
    var mv = 0;
    if (targetX != null) {
      var dx = targetX - cat.x;
      if (M.abs(dx) > 26) mv = dx > 0 ? 1 : -1;
      if (cat.grounded && targetY < cat.y - 60) { jump(); }
      else if (!cat.grounded && cat.vy > 1 && targetY < cat.y - 90 && cat.jumps < 2) jump();
      if (cat.grounded && cat.on !== "ground" && targetY > cat.y + 80 && M.abs(dx) < 140 && cat.dropT <= 0) { cat.dropT = 14; cat.dropFrom = cat.on; cat.grounded = false; cat.on = null; }
      aiSwat -= dt;
      if (M.abs(dx) < 90 && aiSwat <= 0) {
        if (dx !== 0) cat.face = dx > 0 ? 1 : -1;
        swat(targetY > cat.y + 10); aiSwat = 24;
      }
    }
    return mv;
  }

  /* ---------- main loop ---------- */
  var last = now(), frame = 0;
  var rectTimer = setInterval(refreshRects, 250);
  var scanIv = setInterval(scan, 4000);
  scan();
  meow("Mrrp?");

  function step() {
    if (!alive) return;
    raf = requestAnimationFrame(step);
    var t = now(), dt = clamp((t - last) / 16.667, 0.2, 2.5); last = t; frame++;

    /* one-shot keys */
    if (pressed.help) toggleHelp();
    if (pressed.restore) restore(false);
    if (pressed.quit) { quit(); return; }
    if (pressed.laser) { laser = !laser; modeEl.textContent = laser ? "Laser pointer: on (move your mouse)" : "Laser pointer: off (press P)"; say(laser ? "Laser pointer on. Move your mouse, the cat will hunt it." : "Laser pointer off. You're driving again."); if (laser) mouse.moved = t; }
    if (pressed.meow) meow();
    if (pressed.jump && !cat.sleep) {
      if (keys.down && cat.grounded && cat.on !== "ground") { cat.dropT = 14; cat.dropFrom = cat.on; cat.grounded = false; cat.on = null; }
      else jump();
    }
    if (pressed.swat && !cat.sleep) swat(keys.down);
    if (pressed.hairball && !cat.sleep) cough();
    pressed = {};

    /* movement */
    var mv = 0;
    if (!cat.sleep) {
      if (keys.left) mv -= 1;
      if (keys.right) mv += 1;
      if (laser && mv === 0) mv = ai(dt, t);
    }
    var zoom = !!keys.zoom && !cat.sleep;
    var spd = zoom ? 8.6 : 4.4;
    if (mv !== 0) cat.face = mv;
    cat.vx += (mv * spd - cat.vx) * M.min(1, (cat.grounded ? 0.3 : 0.12) * dt);
    cat.x += cat.vx * dt;
    var sr = scopeRect();
    var minX = W.scrollX + M.max(sr.left, 0) + 22, maxX = W.scrollX + M.min(sr.right, W.innerWidth) - 22;
    if (cat.x < minX) { cat.x = minX; cat.vx = 0; }
    if (cat.x > maxX) { cat.x = maxX; cat.vx = 0; }

    if (cat.dropT > 0) cat.dropT -= dt;
    if (cat.grounded && !stillSupported()) { cat.grounded = false; cat.on = null; cat.jumps = 1; }
    if (!cat.grounded) {
      var prevY = cat.y;
      cat.vy = M.min(cat.vy + G * dt, 18);
      var ny = cat.y + cat.vy * dt;
      var p = cat.vy >= 0 ? landingFor(prevY, ny) : null;
      var gy = groundY();
      if (p) { cat.y = p.t; cat.vy = 0; cat.grounded = true; cat.on = p; cat.jumps = 0; cat.land = 8; burst(cat.x, cat.y, 3, "dust"); }
      else if (ny >= gy) { cat.y = gy; cat.vy = 0; cat.grounded = true; cat.on = "ground"; cat.jumps = 0; cat.land = 8; }
      else cat.y = ny;
    }
    if (cat.land > 0) cat.land -= dt;

    /* actions */
    if (cat.swatT > 0) cat.swatT -= dt;
    if (keys.scratch && !cat.sleep) {
      cat.scratchAnim += dt;
      cat.scratchT -= dt;
      if (cat.scratchT <= 0) { scratchTick(); cat.scratchT = 7; }
    } else { cat.scratchT = 0; cat.scratchAnim = 0; }
    if (cat.coughT > 0) { var before = cat.coughT; cat.coughT -= dt; if (before > 8 && cat.coughT <= 8) spawnBall(); }
    if (zoom && M.abs(cat.vx) > 5 && frame % 3 === 0) burst(cat.x - cat.face * 20, cat.y - 14, 1, "fur");

    /* idle / sleep */
    var busy = mv !== 0 || !cat.grounded || keys.scratch || cat.swatT > 0 || cat.coughT > 0 || laser;
    if (busy) cat.idle = 0; else cat.idle += dt;
    if (!cat.sleep && cat.idle > 660) { cat.sleep = true; cat.bubbleT = 0; }
    if (M.abs(cat.vx) > 0.4 && cat.grounded) cat.anim += M.abs(cat.vx) * 0.09 * dt;
    cat.blink -= dt; if (cat.blink < -6) cat.blink = rnd(90, 260);
    if (cat.bubbleT > 0) cat.bubbleT -= dt;

    /* camera */
    var vy = cat.y - W.scrollY, ih = W.innerHeight;
    var follow = (t - freeCam > 1400) || mv !== 0 || !cat.grounded;
    if (cameraOn && follow && !cat.sleep) {
      if (vy < ih * 0.28) scrollToY(W.scrollY + (vy - ih * 0.28) * 0.14 * dt);
      else if (vy > ih * 0.82) scrollToY(W.scrollY + (vy - ih * 0.82) * 0.14 * dt);
    }

    /* flyers */
    for (var i = flyers.length - 1; i >= 0; i--) {
      var f = flyers[i];
      f.vy += G * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
      f.el.style.setProperty("transform", "translate(" + f.x.toFixed(1) + "px," + f.y.toFixed(1) + "px) rotate(" + f.rot.toFixed(1) + "deg)", "important");
      var screenY = f.cy + f.y - W.scrollY;
      if (!f.crashed && screenY > ih + 40) { f.crashed = true; sfx("crash"); }
      if (screenY > ih + 600 || f.y > 4000) { f.el.style.setProperty("visibility", "hidden", "important"); flyers.splice(i, 1); }
    }

    /* hairballs */
    for (var b = balls.length - 1; b >= 0; b--) {
      var ball = balls[b];
      ball.vy += 0.22 * dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.rot += 0.3 * dt; ball.life -= dt;
      var hitP = null;
      for (var j = 0; j < list.length; j++) {
        var q = list[j];
        if (q.gone || q.ledge || q.area > W.innerWidth * W.innerHeight * 0.45) continue;
        if (ball.x > q.l && ball.x < q.r && ball.y > q.t && ball.y < q.b) { if (!hitP || q.area < hitP.area) hitP = q; }
      }
      var sxB = ball.x - W.scrollX;
      if (hitP) {
        burst(ball.x, ball.y, 10, "fur"); floatText(ball.x, ball.y - 20, "SPLAT", "#6b7d3a", 16);
        knock(hitP, ball.vx > 0 ? 1 : -1, 1.4, "hairball"); balls.splice(b, 1);
      } else if (ball.y > groundY() + 2 || ball.life <= 0 || sxB < -40 || sxB > W.innerWidth + 40) {
        burst(ball.x, M.min(ball.y, groundY() - 2), 6, "fur"); balls.splice(b, 1);
      }
    }

    /* particles */
    for (var k = parts.length - 1; k >= 0; k--) {
      var pt = parts[k];
      pt.life -= dt;
      if (pt.kind === "text") { pt.y += pt.vy * dt; pt.x += pt.vx * dt; }
      else { pt.vy += 0.35 * dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.rot += pt.vr * dt; }
      if (pt.life <= 0) parts.splice(k, 1);
    }
    if (parts.length > 400) parts.splice(0, parts.length - 400);

    /* HUD */
    if (frame % 5 === 0) {
      if (t - lastKnock > 1600) combo = 1;
      scoreEl.textContent = score.toLocaleString("en-US");
      knockedEl.textContent = knocked; comboEl.textContent = "x" + combo;
      rankEl.textContent = rank();
    }

    if (opts.autoRestore && knocked - lastRestoreKnocked >= opts.autoRestore && t - lastKnock > 1400 && !flyers.length) {
      restore(true);
      meow(pick(["Again.", "Mrrp. Again.", "Put it back. I'll wait."]));
    }

    draw(t);
  }

  /* ---------- drawing ---------- */
  var C = { fur: "#f5841f", dark: "#c45a0b", light: "#ffd9ad", line: "#3a1c05", pink: "#ff9aa8", eye: "#a6e05a" };
  function limb(x1, y1, x2, y2, w) {
    ctx.lineCap = "round";
    ctx.strokeStyle = C.line; ctx.lineWidth = w + 3;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = C.fur; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function paw(x, y) {
    ctx.fillStyle = C.light; ctx.strokeStyle = C.line; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x, y, 4.2, 0, 6.283); ctx.fill(); ctx.stroke();
  }
  function tail(bx, by, cx1, cy1, cx2, cy2, tx, ty) {
    ctx.lineCap = "round";
    ctx.strokeStyle = C.line; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.bezierCurveTo(cx1, cy1, cx2, cy2, tx, ty); ctx.stroke();
    ctx.strokeStyle = C.fur; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.bezierCurveTo(cx1, cy1, cx2, cy2, tx, ty); ctx.stroke();
    ctx.strokeStyle = C.dark; ctx.lineWidth = 6; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.bezierCurveTo(cx1, cy1, cx2, cy2, tx, ty); ctx.stroke();
    ctx.setLineDash([]);
  }
  function ear(a, b, c, inner) {
    ctx.fillStyle = C.fur; ctx.strokeStyle = C.line; ctx.lineWidth = 1.8; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (inner) {
      ctx.fillStyle = C.pink;
      ctx.beginPath(); ctx.moveTo(a[0] + (b[0] - a[0]) * 0.3 + 1, a[1] + (b[1] - a[1]) * 0.3);
      ctx.lineTo(b[0] + (a[0] + c[0] - 2 * b[0]) * 0.18, b[1] + 3); ctx.lineTo(c[0] + (b[0] - c[0]) * 0.3 - 1, c[1] + (b[1] - c[1]) * 0.3); ctx.closePath(); ctx.fill();
    }
  }
  function head(hx, hy, mood) {
    ear([hx - 9, hy - 5], [hx - 7, hy - 19], [hx - 1, hy - 10], true);
    ear([hx + 2, hy - 10], [hx + 9, hy - 19], [hx + 11, hy - 4], true);
    ctx.fillStyle = C.fur; ctx.strokeStyle = C.line; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.ellipse(hx, hy, 12.5, 11.2, 0, 0, 6.283); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = C.dark; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(hx - 2, hy - 10.5); ctx.lineTo(hx - 1, hy - 6); ctx.moveTo(hx + 2.5, hy - 10.5); ctx.lineTo(hx + 2.5, hy - 6.5); ctx.stroke();
    ctx.fillStyle = C.light;
    ctx.beginPath(); ctx.ellipse(hx + 6.5, hy + 4.5, 6.5, 4.8, 0, 0, 6.283); ctx.fill();
    var ex1 = hx - 1.5, ex2 = hx + 6.5, ey = hy - 1.5;
    if (mood === "closed") {
      ctx.strokeStyle = C.line; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(ex1, ey, 2.6, 0.2, 2.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(ex2, ey, 2.6, 0.2, 2.9); ctx.stroke();
    } else if (mood === "mad") {
      ctx.strokeStyle = C.line; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ex1 - 3, ey - 2); ctx.lineTo(ex1 + 2.5, ey + 0.5); ctx.lineTo(ex1 - 3, ey + 2.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex2 + 3, ey - 2); ctx.lineTo(ex2 - 2.5, ey + 0.5); ctx.lineTo(ex2 + 3, ey + 2.5); ctx.stroke();
    } else {
      [ex1, ex2].forEach(function (ex) {
        ctx.fillStyle = C.eye; ctx.strokeStyle = C.line; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.ellipse(ex, ey, 3, 3.6, 0, 0, 6.283); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#111";
        ctx.beginPath(); ctx.ellipse(ex + 0.6, ey, mood === "wide" ? 2.2 : 1, 2.9, 0, 0, 6.283); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex + 1.4, ey - 1.4, 0.8, 0, 6.283); ctx.fill();
      });
    }
    ctx.fillStyle = C.pink;
    ctx.beginPath(); ctx.moveTo(hx + 9.5, hy + 1.5); ctx.lineTo(hx + 13, hy + 1.5); ctx.lineTo(hx + 11.2, hy + 3.8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 1.1;
    if (mood === "cough") {
      ctx.fillStyle = "#5a1a1a"; ctx.beginPath(); ctx.ellipse(hx + 10.5, hy + 7, 2.6, 2.2, 0, 0, 6.283); ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(hx + 8.5, hy + 5.5); ctx.quadraticCurveTo(hx + 9.8, hy + 7, hx + 11.2, hy + 5); ctx.quadraticCurveTo(hx + 12.6, hy + 7, hx + 14, hy + 5.5); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(58,28,5,.55)"; ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(hx + 12, hy + 3); ctx.lineTo(hx + 23, hy + 0.5);
    ctx.moveTo(hx + 12, hy + 4.5); ctx.lineTo(hx + 23, hy + 5);
    ctx.moveTo(hx + 1, hy + 4); ctx.lineTo(hx - 8, hy + 3);
    ctx.stroke();
  }
  function drawCat(t) {
    var sx = cat.x - W.scrollX, sy = cat.y - W.scrollY;
    if (sy < -120 || sy > W.innerHeight + 120) {
      if (!hudOn) return;
      ctx.fillStyle = "#ff7a1a";
      var ay = sy < 0 ? 18 : W.innerHeight - 18;
      ctx.beginPath(); ctx.moveTo(sx, ay + (sy < 0 ? -10 : 10)); ctx.lineTo(sx - 9, ay); ctx.lineTo(sx + 9, ay); ctx.closePath(); ctx.fill();
      return;
    }
    if (cat.grounded) {
      ctx.fillStyle = "rgba(0,0,0,.18)";
      ctx.beginPath(); ctx.ellipse(sx, sy, 24 * S, 4, 0, 0, 6.283); ctx.fill();
    }
    ctx.save();
    ctx.translate(sx, sy);
    var sqY = 1, sqX = 1;
    if (cat.land > 0) { sqY = 1 - cat.land * 0.025; sqX = 1 + cat.land * 0.02; }
    if (cat.coughT > 8) { var c = M.sin(cat.coughT * 0.9) * 0.06; sqY -= c; sqX += c; }
    ctx.scale(cat.face * S * sqX, S * sqY);

    if (cat.sleep) {
      tail(-18, -6, -30, 4, 0, 8, 20, 1);
      ctx.fillStyle = C.fur; ctx.strokeStyle = C.line; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.ellipse(-2, -12, 22, 12, 0, 0, 6.283); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = C.dark; ctx.lineWidth = 2.6; ctx.lineCap = "round";
      for (var i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-14 + i * 7, -23); ctx.quadraticCurveTo(-11 + i * 7, -17, -13 + i * 7, -12); ctx.stroke(); }
      var br = M.sin(t * 0.003) * 0.6;
      head(14, -12 + br, "closed");
      ctx.restore();
      ctx.fillStyle = "#0d0d0d"; ctx.font = "800 " + (12 + (t / 300 % 3) * 2) + "px " + FONT;
      ctx.fillText("z", sx + 22, sy - 34 - (t / 30 % 20));
      ctx.font = "800 10px " + FONT; ctx.fillText("z", sx + 30, sy - 48 - (t / 40 % 14));
      return;
    }

    var run = cat.grounded && M.abs(cat.vx) > 0.5;
    var ph = cat.anim;
    var air = !cat.grounded;
    var bob = run ? M.abs(M.sin(ph)) * -2 : 0;
    var by = -17 + bob;

    /* tail */
    var sway = M.sin(t * 0.004) * 5;
    if (run) tail(-19, by - 2, -30, by - 6, -38, by - 14, -44, by - 18 + M.sin(ph * 2) * 3);
    else if (air) tail(-19, by - 2, -30, by + 2, -40, by - 2, -46, by - 12);
    else tail(-19, by - 2, -32, by - 4, -30 + sway, by - 26, -36 + sway, by - 30);

    /* far legs */
    var la = run ? M.sin(ph) * 0.7 : 0, lb = run ? M.sin(ph + M.PI) * 0.7 : 0;
    var legLen = 12;
    function legEnd(hx, a) { return [hx + M.sin(a) * legLen, by + 6 + M.cos(a) * legLen * 0.95]; }
    ctx.globalAlpha = 0.85;
    var e1, e2;
    if (air) { e1 = [-20, by + 14]; e2 = [20, by + 13]; }
    else { e1 = legEnd(-11, lb); e2 = legEnd(13, la); }
    limb(-11, by + 4, e1[0], M.min(e1[1], 0), 5); limb(13, by + 4, e2[0], M.min(e2[1], 0), 5);
    ctx.globalAlpha = 1;

    /* body */
    ctx.fillStyle = C.fur; ctx.strokeStyle = C.line; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.ellipse(0, by, 21, 11.5, 0, 0, 6.283); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.light;
    ctx.beginPath(); ctx.ellipse(4, by + 6, 13, 4.6, 0, 0, 6.283); ctx.fill();
    ctx.strokeStyle = C.dark; ctx.lineWidth = 2.6; ctx.lineCap = "round";
    for (var s = 0; s < 3; s++) { ctx.beginPath(); ctx.moveTo(-12 + s * 7, by - 11); ctx.quadraticCurveTo(-9 + s * 7, by - 5, -11 + s * 7, by - 1); ctx.stroke(); }

    /* near legs */
    var n1, n2;
    if (air) { n1 = [-16, by + 15]; n2 = [24, by + 12]; }
    else { n1 = legEnd(-16, la); n2 = legEnd(9, lb); }
    limb(-16, by + 5, n1[0], M.min(n1[1], 0), 5.5); paw(n1[0], M.min(n1[1], 0) - 1);

    var mood = "normal";
    if (cat.swatT > 0) {
      var pr = 1 - cat.swatT / 16, ext = M.sin(pr * M.PI);
      mood = "mad";
      var ax, ay2;
      if (cat.swatDown) { ax = 14 + ext * 8; ay2 = by + 10 + ext * 14; }
      else { ax = 14 + ext * 26; ay2 = by - 4 - ext * 10 + pr * 14; }
      limb(12, by + 2, ax, ay2, 5.5); paw(ax, ay2);
    } else if (cat.scratchAnim > 0) {
      mood = "mad";
      var sc = M.sin(cat.scratchAnim * 0.9);
      limb(12, by + 2, 26 + sc * 4, by - 2 + sc * 9, 5.5); paw(26 + sc * 4, by - 2 + sc * 9);
      limb(8, by + 3, 22 - sc * 4, by + 2 - sc * 8, 5); paw(22 - sc * 4, by + 2 - sc * 8);
    } else {
      limb(9, by + 5, n2[0], M.min(n2[1], 0), 5.5); paw(n2[0], M.min(n2[1], 0) - 1);
    }
    if (cat.coughT > 0) mood = "cough";
    else if (cat.blink < 0) mood = "closed";
    else if (laser && mood === "normal") mood = "wide";

    head(21, by - 10 + (run ? M.sin(ph * 2) * 0.8 : 0), mood);
    ctx.restore();

    if (cat.bubbleT > 0 && cat.bubble) {
      ctx.font = "700 13px " + FONT;
      var tw = ctx.measureText(cat.bubble).width, bw = tw + 18, bh = 26;
      var bx = clamp(sx - bw / 2, 6, W.innerWidth - bw - 6), byy = sy - 62 * S - bh;
      ctx.globalAlpha = M.min(1, cat.bubbleT / 12);
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#0d0d0d"; ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, byy, bw, bh, 10); else ctx.rect(bx, byy, bw, bh);
      ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx - 5, byy + bh - 1); ctx.lineTo(sx, byy + bh + 7); ctx.lineTo(sx + 5, byy + bh - 1); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(sx - 5, byy + bh); ctx.lineTo(sx, byy + bh + 7); ctx.lineTo(sx + 5, byy + bh); ctx.stroke();
      ctx.fillStyle = "#0d0d0d"; ctx.textBaseline = "middle"; ctx.fillText(cat.bubble, bx + 9, byy + bh / 2 + 1); ctx.textBaseline = "alphabetic";
      ctx.globalAlpha = 1;
    }
  }
  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W.innerWidth, W.innerHeight);
    var ox = W.scrollX, oy = W.scrollY;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a;
      if (p.kind === "text") {
        ctx.font = "900 " + p.s + "px " + FONT; ctx.textAlign = "center";
        ctx.lineWidth = 4; ctx.strokeStyle = "#fff"; ctx.strokeText(p.txt, p.x - ox, p.y - oy);
        ctx.fillStyle = p.c; ctx.fillText(p.txt, p.x - ox, p.y - oy); ctx.textAlign = "left";
      } else if (p.kind === "fur") {
        ctx.strokeStyle = p.c; ctx.lineWidth = 2; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(p.x - ox, p.y - oy); ctx.lineTo(p.x - ox + M.cos(p.rot) * p.s * 1.6, p.y - oy + M.sin(p.rot) * p.s * 1.6); ctx.stroke();
      } else if (p.kind === "dust") {
        ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x - ox, p.y - oy, p.s, 0, 6.283); ctx.fill();
      } else {
        ctx.save(); ctx.translate(p.x - ox, p.y - oy); ctx.rotate(p.rot);
        ctx.fillStyle = p.c; ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(-p.s, -p.s * 0.6); ctx.lineTo(p.s, -p.s * 0.2); ctx.lineTo(-p.s * 0.2, p.s); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    for (var b = 0; b < balls.length; b++) {
      var ball = balls[b], bx = ball.x - ox, by = ball.y - oy;
      ctx.save(); ctx.translate(bx, by); ctx.rotate(ball.rot);
      ctx.fillStyle = "#8a7a4e"; ctx.beginPath(); ctx.arc(0, 0, ball.r, 0, 6.283); ctx.fill();
      ctx.strokeStyle = "#5d5232"; ctx.lineWidth = 1.4; ctx.lineCap = "round";
      for (var k = 0; k < 9; k++) { var an = k * 0.7; ctx.beginPath(); ctx.moveTo(M.cos(an) * 3, M.sin(an) * 3); ctx.lineTo(M.cos(an + 0.4) * (ball.r + 3), M.sin(an + 0.4) * (ball.r + 3)); ctx.stroke(); }
      ctx.fillStyle = "#c89b5e"; ctx.beginPath(); ctx.arc(-2, -2, 2.4, 0, 6.283); ctx.fill();
      ctx.restore();
    }
    drawCat(t);
    if (laser && mouseInScope()) {
      var g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 14);
      g.addColorStop(0, "rgba(255,40,40,.9)"); g.addColorStop(0.3, "rgba(255,0,0,.45)"); g.addColorStop(1, "rgba(255,0,0,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 14, 0, 6.283); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 2, 0, 6.283); ctx.fill();
    }
  }

  W.__catChaos = { quit: quit, restore: restore };
  say("An orange cat has entered the website. Arrow keys to move, J to swat.");
  step();
}
