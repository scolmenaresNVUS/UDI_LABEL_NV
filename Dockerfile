FROM node:22-alpine

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
RUN npm run build

# Remove devDependencies after build
RUN cd client && npm prune --production && \
    cd ../server && npm prune --production && \
    cd .. && npm prune --production

EXPOSE 3001

CMD ["npm", "run", "start"]
