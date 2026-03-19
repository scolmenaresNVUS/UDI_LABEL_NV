FROM node:22-alpine AS build

WORKDIR /app

# Copy all package files
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install all dependencies (including devDependencies for build)
RUN npm ci && \
    cd client && npm ci && \
    cd ../server && npm ci

# Copy source code
COPY . .

# Build client and server
RUN cd client && npm run build && cd ../server && npm run build

# --- Production stage ---
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY server/package*.json ./server/

# Install only production dependencies for server
RUN cd server && npm ci --omit=dev

# Copy built assets from build stage
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/server/dist ./server/dist

ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "server/dist/app.js"]
