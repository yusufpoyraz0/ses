# Dockerfile — Next.js 16 multi-stage production build
# Node.js 22 LTS kullanılıyor (Next.js 16 uyumlu)

# ── Stage 1: Bağımlılıklar ────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# package-lock.json ile deterministik kurulum
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: Build ────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── Stage 3: Runtime (minimal image) ─────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Güvenlik: root olmayan kullanıcı
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# standalone output: sadece gerekli dosyalar kopyalanır (~100MB vs ~500MB)
COPY --from=builder /app/public                          ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static

# /data/videos volume mount noktası için klasör oluştur
RUN mkdir -p /data/videos && chown nextjs:nodejs /data/videos

USER nextjs

EXPOSE 3000

# Next.js standalone mode: server.js doğrudan node ile çalıştırılır
CMD ["node", "server.js"]