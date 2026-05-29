FROM node:20-alpine

# Place workdir at backend/ level so ../shared resolves correctly
WORKDIR /build/backend

# Install dependencies first (layer cache optimisation)
COPY backend/package*.json ./
RUN npm install

# Copy shared types (type-only imports — fully erased at compile time)
COPY shared/ /build/shared/

# Copy backend source
COPY backend/tsconfig.json ./
COPY backend/src/ ./src/

RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
