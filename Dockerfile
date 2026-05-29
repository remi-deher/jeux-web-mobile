# ==========================================
# Stage 1: Build the Angular frontend
# ==========================================
FROM node:20-alpine AS frontend-build
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm install
COPY shared/ /build/shared/
COPY frontend/ .
RUN npm run build -- --configuration production

# ==========================================
# Stage 2: Build the Node.js backend
# ==========================================
FROM node:20-alpine AS backend-build
WORKDIR /build/backend
COPY backend/package*.json ./
RUN npm install
COPY shared/ /build/shared/
COPY backend/tsconfig.json ./
COPY backend/src/ ./src/
RUN npm run build

# ==========================================
# Stage 3: Monolith Runtime
# ==========================================
FROM node:20-alpine

# Install Nginx
RUN apk add --no-cache nginx

# Create app directory
WORKDIR /app

# Copy backend built files and node_modules
COPY --from=backend-build /build/backend/package*.json ./backend/
COPY --from=backend-build /build/backend/node_modules ./backend/node_modules
COPY --from=backend-build /build/backend/dist ./backend/dist
COPY shared/ /build/shared/

# Copy frontend static files
COPY --from=frontend-build /build/frontend/dist/frontend/browser /usr/share/nginx/html

# Copy Nginx config (modified to proxy to localhost)
COPY nginx.monolith.conf /etc/nginx/http.d/default.conf

# Copy entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Expose Nginx port
EXPOSE 80

# Run both Nginx and Node.js
CMD ["/app/entrypoint.sh"]
