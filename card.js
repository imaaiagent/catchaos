// Score cards for sharing on X: the share page (/s) and the 1200x630 image (/card.png).

export const RANKS = [
  "Suspiciously calm",
  "Testing the edge of the table",
  "Mildly inconvenient",
  "Knocking things off tables",
  "Professional menace",
  "Absolute unit of chaos",
  "One brain cell, full power",
  "The website belongs to the cat now",
];

const FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@700;900&family=Plus+Jakarta+Sans:wght@500;700;800&display=swap" rel="stylesheet">';

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function int(v, min, max, fallback) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

// Everything in a share link comes from the visitor, so it is clamped and whitelisted.
export function parseScore(q) {
  const score = int(q.score, 0, 99999999, 0);
  const knocked = int(q.knocked, 0, 99999, 0);
  const combo = int(q.combo, 1, 999, 1);
  const rank = int(q.rank, 0, RANKS.length - 1, 0);
  let site = String(q.site || "").toLowerCase().replace(/^www\./, "");
  if (site !== "demo" && !/^[a-z0-9.-]{1,60}$/.test(site)) site = "";
  return { score, knocked, combo, rank, site, intro: q.intro === "1" };
}

export function siteLabel(site) {
  if (site === "demo") return "a very fragile porcelain shop";
  return site || "a website";
}

export function shareQuery(d) {
  return new URLSearchParams({ score: d.score, knocked: d.knocked, combo: d.combo, rank: d.rank, site: d.site }).toString();
}

export function catSvg(width) {
  const o = "#3a1c05", fur = "#f5841f", dk = "#c45a0b", lt = "#ffd9ad", pk = "#ff9aa8";
  const limb = (x1, y1, x2, y2, w = 5.5) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${o}" stroke-width="${w + 3}" stroke-linecap="round"/>` +
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${fur}" stroke-width="${w}" stroke-linecap="round"/>`;
  const paw = (x, y) => `<circle cx="${x}" cy="${y}" r="4.2" fill="${lt}" stroke="${o}" stroke-width="1.6"/>`;
  const tail = "M-19 -19 C-32 -21 -28 -44 -36 -48";
  let stripes = "";
  for (let s = 0; s < 3; s++) stripes += `<path d="M${-12 + s * 7} -28 Q${-9 + s * 7} -22 ${-11 + s * 7} -18" stroke="${dk}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  const eye = (x) =>
    `<ellipse cx="${x}" cy="-28.5" rx="3" ry="3.6" fill="#a6e05a" stroke="${o}" stroke-width="1.2"/>` +
    `<ellipse cx="${x + 0.6}" cy="-28.5" rx="1" ry="2.9" fill="#111"/><circle cx="${x + 1.4}" cy="-29.9" r=".8" fill="#fff"/>`;
  return `<svg width="${width}" viewBox="-52 -62 120 66" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse cx="0" cy="0" rx="26" ry="3.5" fill="rgba(0,0,0,.35)"/>
  <path d="${tail}" stroke="${o}" stroke-width="9" fill="none" stroke-linecap="round"/>
  <path d="${tail}" stroke="${fur}" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="${tail}" stroke="${dk}" stroke-width="6" fill="none" stroke-dasharray="3 4"/>
  <g opacity=".85">${limb(-11, -13, -11, 0, 5)}${limb(13, -13, 13, 0, 5)}</g>
  <ellipse cx="0" cy="-17" rx="21" ry="11.5" fill="${fur}" stroke="${o}" stroke-width="1.8"/>
  <ellipse cx="4" cy="-11" rx="13" ry="4.6" fill="${lt}"/>
  ${stripes}
  ${limb(-16, -12, -16, -1)}${paw(-16, -2)}
  ${limb(12, -15, 37, -31)}${paw(37, -31)}
  <path d="M12 -32 L14 -46 L20 -37 Z" fill="${fur}" stroke="${o}" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M14.5 -35 L15.5 -42 L18.5 -37 Z" fill="${pk}"/>
  <path d="M23 -37 L30 -46 L32 -31 Z" fill="${fur}" stroke="${o}" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M25.5 -37 L29.2 -42 L30 -34 Z" fill="${pk}"/>
  <ellipse cx="21" cy="-27" rx="12.5" ry="11.2" fill="${fur}" stroke="${o}" stroke-width="1.8"/>
  <path d="M19 -37.5 L20 -33 M23.5 -37.5 L23.5 -33.5" stroke="${dk}" stroke-width="2" stroke-linecap="round"/>
  <ellipse cx="27.5" cy="-22.5" rx="6.5" ry="4.8" fill="${lt}"/>
  ${eye(19.5)}${eye(27.5)}
  <path d="M30.5 -25.5 L34 -25.5 L32.2 -23.2 Z" fill="${pk}"/>
  <path d="M29.5 -21.5 Q30.8 -20 32.2 -22 Q33.6 -20 35 -21.5" stroke="${o}" stroke-width="1.1" fill="none"/>
  <path d="M33 -24 L44 -26.5 M33 -22.5 L44 -22" stroke="rgba(58,28,5,.55)" stroke-width=".9"/>
  <g transform="translate(50 -46) rotate(32) scale(.72)">
    <path d="M-5 -10 h10 v3 c6 4 8 9 8 15 c0 8 -6 13 -13 13 c-7 0 -13 -5 -13 -13 c0 -6 2 -11 8 -15 z" fill="#f6f1ea" stroke="#2a4b9b" stroke-width="1.4"/>
    <path d="M-6 6 c3 -4 9 -4 12 0" stroke="#2a4b9b" stroke-width="1.3" fill="none"/>
    <circle cx="0" cy="1" r="1.6" fill="#2a4b9b"/>
  </g>
  <path d="M44 -14 l3 -2 l1 3 z M50 -8 l4 0 l-2 3 z M40 -6 l2 -3 l2 3 z" fill="#f6f1ea" opacity=".85"/>
</svg>`;
}

const PAW = '<svg width="30" height="30" viewBox="0 0 40 40" aria-hidden="true"><ellipse cx="20" cy="26" rx="9" ry="8" fill="#ff7a1a"/><circle cx="9" cy="16" r="4.2" fill="#ff7a1a"/><circle cx="16" cy="9" r="4.2" fill="#ff7a1a"/><circle cx="24" cy="9" r="4.2" fill="#ff7a1a"/><circle cx="31" cy="16" r="4.2" fill="#ff7a1a"/></svg>';

export function cardHtml(d, host) {
  const site = siteLabel(d.site);
  const intro = d.intro;
  const main = intro
    ? `<div class="big intro">Knock any website off the table.</div>
       <div class="line">Type an address. Let the cat in.</div>`
    : `<div class="line">My cat knocked <b>${d.knocked.toLocaleString("en-US")}</b> ${d.knocked === 1 ? "thing" : "things"} off</div>
       <div class="site">${esc(site)}</div>
       <div class="big">${d.score.toLocaleString("en-US")}<span>points</span></div>
       <div class="pill">${esc(RANKS[d.rank])}</div>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${FONTS}<style>
*{box-sizing:border-box;margin:0}
html,body{width:1200px;height:630px;overflow:hidden}
body{background:radial-gradient(700px 460px at 82% 40%,rgba(255,122,26,.28),transparent 70%),#000;color:#f6f1ea;font-family:"Plus Jakarta Sans","Segoe UI",system-ui,sans-serif;position:relative}
.brand{position:absolute;left:70px;top:56px;display:flex;align-items:center;gap:12px;font:700 26px/1 Unbounded,"Arial Black",sans-serif}
.left{position:absolute;left:70px;top:140px;width:660px}
.line{font-size:30px;font-weight:700;color:#a39d95}
.line b{color:#f6f1ea}
.site{font:900 54px/1.1 Unbounded,"Arial Black",sans-serif;color:#ff7a1a;letter-spacing:-.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:6px 0 18px}
.big{font:900 132px/1 Unbounded,"Arial Black",sans-serif;letter-spacing:-.05em;display:flex;align-items:baseline;gap:18px}
.big span{font:800 26px/1 "Plus Jakarta Sans",sans-serif;letter-spacing:0;color:#a39d95}
.big.intro{font-size:76px;line-height:1.02;letter-spacing:-.04em;display:block;margin-bottom:22px}
.pill{display:inline-block;margin-top:24px;border:2px solid #ff7a1a;color:#ffa24d;background:rgba(255,122,26,.1);border-radius:999px;padding:10px 22px;font-size:26px;font-weight:800}
.cat{position:absolute;right:30px;bottom:56px}
.foot{position:absolute;left:70px;right:70px;bottom:40px;display:flex;justify-content:space-between;font-size:22px;font-weight:700;color:#6f6a64}
.foot b{color:#f6f1ea}
.edge{position:absolute;left:0;right:0;bottom:0;height:12px;background:#ff7a1a}
</style></head><body>
<div class="brand">${PAW}Cat Chaos</div>
<div class="left">${main}</div>
<div class="cat">${catSvg(470)}</div>
<div class="foot"><span>${intro ? "" : "Can your cat do worse?"}</span><b>${esc(host)}</b></div>
<div class="edge"></div>
</body></html>`;
}

export function sharePageHtml(d, origin) {
  const site = siteLabel(d.site);
  const title = `${d.score.toLocaleString("en-US")} points on ${site} | Cat Chaos`;
  const desc = `An orange cat knocked ${d.knocked} ${d.knocked === 1 ? "thing" : "things"} off ${site}. Rank: ${RANKS[d.rank]}. Can your cat do worse?`;
  const img = `${origin}/card.png?${shareQuery(d)}`;
  const url = `${origin}/s?${shareQuery(d)}`;
  const replay = d.site === "demo" ? "/demo" : d.site ? `/play?url=${encodeURIComponent("https://" + d.site)}` : "/";
  const replayLabel = d.site === "demo" ? "Wreck the porcelain shop" : d.site ? `Wreck ${esc(d.site)} yourself` : "Pick a website";
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:url" content="${esc(url)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(img)}">
<meta name="theme-color" content="#000000">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐈</text></svg>">
${FONTS}
<style>
:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
*,*::before,*::after{box-sizing:inherit}
body{margin:0;min-height:100vh;display:flex;flex-direction:column;background:radial-gradient(800px 460px at 80% 20%,rgba(255,122,26,.18),transparent 65%),#000;color:#f6f1ea;font:400 17px/1.6 "Plus Jakarta Sans","Segoe UI",system-ui,sans-serif}
main{flex:1;display:flex;align-items:center;padding:56px 0}
.wrap{width:100%;max-width:1060px;margin:0 auto;padding:0 28px;display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:40px;align-items:center}
.line{font-size:20px;font-weight:700;color:#a39d95;margin:0}
.line b{color:#f6f1ea}
.site{font:900 clamp(28px,4vw,44px)/1.1 Unbounded,"Arial Black",sans-serif;color:#ff7a1a;letter-spacing:-.03em;margin:6px 0 14px;overflow-wrap:anywhere}
.big{font:900 clamp(64px,10vw,120px)/1 Unbounded,"Arial Black",sans-serif;letter-spacing:-.05em;margin:0}
.unit{font-size:18px;font-weight:800;color:#a39d95}
.pill{display:inline-block;margin:18px 0 30px;border:2px solid #ff7a1a;color:#ffa24d;background:rgba(255,122,26,.1);border-radius:999px;padding:8px 18px;font-weight:800}
.actions{display:flex;flex-wrap:wrap;gap:12px}
.go{display:inline-block;text-decoration:none;background:#ff7a1a;color:#000;font-weight:800;padding:16px 24px;border-radius:999px;box-shadow:0 4px 0 #b84f06}
.go:hover{background:#ffa24d}
.ghost{display:inline-block;text-decoration:none;color:#f6f1ea;font-weight:800;padding:14px 22px;border-radius:999px;border:1.5px solid #2b2b2b;background:#161616}
.ghost:hover{border-color:#ff7a1a;color:#ffa24d}
:focus-visible{outline:3px solid #ff7a1a;outline-offset:3px}
.cat svg{width:100%;height:auto}
.edge{height:8px;background:#ff7a1a}
.top{width:100%;max-width:1060px;margin:0 auto;padding:26px 28px 0}
.top .brand{display:inline-flex;align-items:center;gap:10px;text-decoration:none;color:#f6f1ea;font:700 19px/1 Unbounded,"Arial Black",sans-serif}
@media (max-width:760px){.wrap{grid-template-columns:1fr}.cat{order:-1;max-width:340px}}
</style></head><body>
<header class="top"><a class="brand" href="/">${PAW}Cat Chaos</a></header>
<main><div class="wrap">
  <div>
    <p class="line">This cat knocked <b>${d.knocked.toLocaleString("en-US")}</b> ${d.knocked === 1 ? "thing" : "things"} off</p>
    <div class="site">${esc(site)}</div>
    <p class="big">${d.score.toLocaleString("en-US")}</p>
    <div class="unit">points${d.combo > 1 ? `, best combo x${d.combo}` : ""}</div>
    <div class="pill">${esc(RANKS[d.rank])}</div>
    <div class="actions">
      <a class="go" href="/">Let your cat in</a>
      <a class="ghost" href="${esc(replay)}">${replayLabel}</a>
    </div>
  </div>
  <div class="cat">${catSvg(460)}</div>
</div></main>
<div class="edge" aria-hidden="true"></div>
</body></html>`;
}
