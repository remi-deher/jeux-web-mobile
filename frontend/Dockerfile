# Stage 1: Build the Angular application
FROM node:20-alpine AS build

# Place workdir at frontend/ level so ../shared resolves correctly
WORKDIR /build/frontend

# Install dependencies first (layer cache optimisation)
COPY frontend/package*.json ./
RUN npm install

# Copy shared types (type-only imports — fully erased at compile time)
COPY shared/ /build/shared/

# Copy frontend source
COPY frontend/ .

RUN npm run build -- --configuration production

# Stage 2: Serve with Nginx
FROM nginx:alpine

COPY --from=build /build/frontend/dist/frontend/browser /usr/share/nginx/html
COPY --from=build /build/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
