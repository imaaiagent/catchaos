<img width="1502" height="727" alt="image" src="https://github.com/user-attachments/assets/561ad270-75f0-46c4-bb19-8f31d9fa05b3" />

# 🐈 Cat Chaos

**Knock any website off the table.**

Type any website address and an orange cat walks onto the page, climbs the text and images, and knocks every single thing off. The real site stays untouched.

### 👉 [Play it now: (https://catchaos.online/)

Made by [@delymakesthings](https://x.com/delymakesthings). If the cat made you laugh, a ⭐ on this repo helps a lot.

---

## Try it

1. Open **[https://catchaos.online/)**.
2. Type any address, for example `en.wikipedia.org/wiki/Cat`, and hit **Let the cat in**.
3. Wreck the page with the keyboard.

No time to type? Try the [porcelain shop demo][(https://catchaos.online/demo)), or just move your mouse around the landing page. The cat chases your cursor.

## Nine ways to ruin a page

| Key | Move | What it does |
| --- | --- | --- |
| `←` `→` | Walk | Stroll across headlines, images and buttons like they're shelves |
| `↑` / `Space` | Jump | Press twice to double jump. Hold `↓` and jump to drop through a ledge |
| `J` | Swat | Smack whatever is in front. Hold `↓` to swat what's underneath |
| `K` (hold) | Scratch | Claw marks pile up until the thing breaks |
| `L` | Hairball | Cough one up and fire it across the page |
| `Shift` (hold) | Zoomies | Full 3 a.m. speed |
| `P` | Laser pointer | The cat hunts your mouse and wrecks everything near it |
| `M` | Meow | Says something. Usually a demand |
| `R` | Restore | Put the page back together so the cat can do it again |

Press `Esc` to send the cat home. On a phone, buttons appear on screen instead.

## Share your score

The score panel keeps your best score and has a **Share my score on 𝕏** button. It posts how many things your cat knocked off, which site, your score and your rank. The link shows up on X as a big score card with the cat mid-swat.

## Bookmarklet

Some sites refuse to open through the server. For those, use the bookmarklet: open the [landing page](https://catchaos-production.up.railway.app/#bookmarklet), drag the orange **Cat Chaos** button to your bookmarks bar, then click it on any website. It runs right on the page you're looking at, even pages you're logged into.

---

## How it works

- `GET /` is the landing page. A live cat plays in the hero and knocks the headline apart.
- `GET /play?url=...` fetches the page on the server, removes the site's own scripts, points links and images back at the original site with a `<base>` tag, and injects the cat.
- If the plain page is an empty app shell (React, Vue, Next and similar) or the request is refused, the server opens it in headless Chromium, waits for it to render, and gives the cat the finished page. Add `&render=1` to force this.
- `GET /demo` is a built-in fragile porcelain shop.
- `GET /s?score=...` is the page a shared score links to, with the preview tags X reads.
- `GET /card.png?score=...` draws the 1200x630 score card with headless Chromium and keeps it in memory.
- `GET /healthz` returns `ok`. `GET /version` shows which version is deployed.

## Run it yourself

```bash
git clone https://github.com/imaaiagent/catchaos.git
cd catchaos
npm install
npx playwright install chromium   # optional, for sites built with JavaScript
npm start
# open http://localhost:3000
```

Requires Node 20 or newer. Without Chromium, the server still works and serves plain pages.

### Deploy to Railway

1. Fork this repo.
2. In Railway, create a project and choose **Deploy from GitHub repo**.
3. Railway builds from the `Dockerfile` (official Playwright image, Chromium included).
4. Open **Settings > Networking** and click **Generate Domain**.

No environment variables are needed. Optional: `MAX_RENDERS` sets how many full-browser renders run at once (default 2). Each one uses about 300 to 500 MB of memory while it runs.

## Safety

The server fetches pages on behalf of visitors, so it is locked down:

- Only `http` and `https` on ports 80 and 443.
- Every DNS answer is checked at connect time, and every redirect is checked again, so nobody can make the server reach `localhost`, private networks or cloud metadata addresses.
- The headless browser sends all traffic through a small proxy inside the server that applies the same checks, so rendered pages, their redirects and their websockets can't reach internal services either.
- Pages over 6 MB, slow responses and long redirect chains are refused.
- Each IP can open 30 pages a minute, and at most 10 of those can use the full browser.
- Served pages carry a Content-Security-Policy that only lets the cat's own scripts run, and forms can't submit anywhere.

## Limits

- Pages are a still snapshot. Live parts of a site (charts, chat widgets, logins) stop where they were.
- Sites behind strict bot protection may refuse to load. Use the bookmarklet on those.
- Web fonts from other sites sometimes fall back to system fonts.

## Files

```
server.js            Express server, fetching, sanitizing, safety checks
card.js              Score card image and share page
render.js            Headless Chromium fallback and its safety proxy
Dockerfile           Railway build (Playwright image with Chromium)
railway.json         Tells Railway to use the Dockerfile, plus the health check
public/index.html    Landing page
public/cat-chaos.js  The game engine (also used as the bookmarklet)
public/boot.js       Starts the cat and keeps links inside Cat Chaos
public/demo.html     Demo porcelain shop
public/error.html    Error page
```

---

Made by [@delymakesthings](https://x.com/delymakesthings). No real websites, porcelain or cats were harmed.
