FROM node:18-alpine

# Add version label
COPY VERSION /app/VERSION
LABEL version="$(cat /app/VERSION)"

# Install build dependencies for native modules
# RUN apk add --no-cache python3 make g++

WORKDIR /app

# COPY backend/package*.json ./

# Copy source code (node_modules excluded by .dockerignore)
COPY backend/ ./

# Check if node_modules exists and quit if it does (It should be ignored by .dockerignore)
RUN if [ -d "node_modules" ]; then echo "node_modules directory exists"; exit 1; fi

# Install dependencies with clean compilation
RUN npm ci --only=production

EXPOSE 8000

CMD [ "npm", "start" ] 