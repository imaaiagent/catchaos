# Orange Cat Chaos

Type any website address and an orange cat walks onto the page and knocks everything off it.

## How it works

- `GET /` is the landing page with the address field and the bookmarklet.
- `GET /play?url=...` fetches the page on the server, removes the site's own scripts, points relative links and images back at the original site with a `<base>` tag, and injects the cat.
- If the plain page turns out to be an empty app shell (sites built with React, Vue, Next and similar) or the plain request is refused, the server opens it in headless Chromium, waits for it to finish rendering, and gives the cat that finished page instead. Add `&render=1` to force this.
- `GET /demo` is a built-in fragile porcelain shop to wreck.
- `GET /healthz` returns `ok` for Railway's health check.

## Run locally

```bash
npm install
npm start
# open http://localhost:3000
```

Requires Node 20 or newer. For the full-browser fallback locally, also run `npx playwright install chromium` once. Without it, the server still works and serves plain pages.

## Deploy to Railway

1. Push this folder to a GitHub repository.
2. In Railway, create a new project and choose **Deploy from GitHub repo**.
3. Pick the repository. Railway sees the `Dockerfile` (via `railway.json`) and builds from the official Playwright image, which already includes Chromium.
4. Open **Settings > Networking** and click **Generate Domain** to get a public URL.

No environment variables are needed. Railway sets `PORT` automatically.

Optional: `MAX_RENDERS` sets how many full-browser renders run at once (default 2). Each one uses roughly 300 to 500 MB of memory while it runs, so raise it only if your Railway plan has the memory for it.

You can also deploy from your terminal with the Railway CLI: `railway init`, then `railway up`.

## Safety built in

The server fetches pages on behalf of visitors, so it is locked down:

- Only `http` and `https` on ports 80 and 443.
- Every DNS answer is checked at connect time, and each redirect is checked again, so nobody can make the server reach `localhost`, private networks, or cloud metadata addresses.
- Pages over 6 MB, slow responses (12 s), and more than 5 redirects are refused.
- Each IP can open 30 pages per minute, and at most 10 of those can use the full browser.
- The headless browser sends all of its traffic through a small proxy inside the server that resolves every hostname itself and refuses private addresses, so a rendered page, its redirects and its websockets can't reach internal services either.
- Served pages carry a Content-Security-Policy that only allows the cat's own scripts to run, and forms on proxied pages can't submit anywhere.

## Limits

- Pages are a still snapshot. Anything the site does live (charts updating, chat widgets, logins) stops where it was when the snapshot was taken.
- Full-browser loads take a few seconds longer than plain ones.
- Some sites block server requests (Cloudflare challenges, 403 responses). The bookmarklet on the landing page works on those, since it runs on the real page in your browser.
- Web fonts from other sites may fall back to system fonts when the original site doesn't allow cross-origin font loading.
- The cache and rate limiter live in memory, which is fine for a single Railway instance.

## Files

```
server.js            Express server, fetching, sanitizing, safety checks
render.js            Headless Chromium fallback and its safety proxy
Dockerfile           Build for Railway (Playwright image with Chromium)
public/index.html    Landing page
public/cat-chaos.js  The game engine (also used as the bookmarklet)
public/boot.js       Starts the cat and keeps links inside Cat Chaos
public/demo.html     Demo porcelain shop
public/error.html    Friendly error page
public/shared.css    Shared styles
railway.json         Tells Railway to build from the Dockerfile, plus the health check
```
