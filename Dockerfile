# Official Playwright image: Node + Chromium + every system library it needs.
# The tag must match the "playwright" version in package.json.
FROM mcr.microsoft.com/playwright:v1.56.0-noble

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

CMD ["node", "server.js"]
