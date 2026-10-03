# Orange Cat Chaos

Type any website address and an orange cat walks onto the page and knocks everything off it.

## How it works

- `GET /` is the landing page with the address field and the bookmarklet.
- `GET /play?url=...` fetches the page on the server, removes the site's own scripts, points relative links and images back at the original site with a `<base>` tag, and injects the cat.
- `GET /demo` is a built-in fragile porcelain shop to wreck.
- `GET /healthz` returns `ok` for Railway's health check.

## Run locally

```bash
npm install
npm start
# open http://localhost:3000
```

Requires Node 20 or newer.

## Deploy to Railway

1. Push this folder to a GitHub repository.
2. In Railway, create a new project and choose **Deploy from GitHub repo**.
3. Pick the repository. Railway detects Node, runs `npm install`, and starts it with `npm start`.
4. Open **Settings > Networking** and click **Generate Domain** to get a public URL.

No environment variables are needed. Railway sets `PORT` automatically.

You can also deploy from your terminal with the Railway CLI: `railway init`, then `railway up`.

## Safety built in

The server fetches pages on behalf of visitors, so it is locked down:

- Only `http` and `https` on ports 80 and 443.
- Every DNS answer is checked at connect time, and each redirect is checked again, so nobody can make the server reach `localhost`, private networks, or cloud metadata addresses.
- Pages over 6 MB, slow responses (12 s), and more than 5 redirects are refused.
- Each IP can open 30 pages per minute.
- Served pages carry a Content-Security-Policy that only allows the cat's own scripts to run, and forms on proxied pages can't submit anywhere.

## Limits

- Pages are shown without their own JavaScript. Sites that build everything client-side (some web apps) may look empty.
- Some sites block server requests (Cloudflare challenges, 403 responses). The bookmarklet on the landing page works on those, since it runs on the real page in your browser.
- Web fonts from other sites may fall back to system fonts when the original site doesn't allow cross-origin font loading.
- The cache and rate limiter live in memory, which is fine for a single Railway instance.

## Files

```
server.js            Express server, fetching, sanitizing, safety checks
public/index.html    Landing page
public/cat-chaos.js  The game engine (also used as the bookmarklet)
public/boot.js       Starts the cat and keeps links inside Cat Chaos
public/demo.html     Demo porcelain shop
public/error.html    Friendly error page
public/shared.css    Shared styles
railway.json         Railway start command and health check
```
