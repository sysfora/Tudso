# Stage 1: Build the backend and SSR frontend
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package definitions
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies required for tsc and vite)
RUN npm ci --include=dev

# Copy server source code and web frontend
COPY . ./

# Build backend and SSR web application
RUN npm run build

# Stage 2: Production runtime
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Copy package definitions and install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built server and web client/server assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/web/dist ./web/dist

# Create storage directories
RUN mkdir -p /app/data/releases /app/uploads

EXPOSE 3000

CMD ["node", "dist/index.js"]
