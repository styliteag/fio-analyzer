# Multi-stage build combining frontend and backend
FROM node:24-alpine AS frontend-builder

# Accept build arguments  
ARG VITE_API_URL=""

WORKDIR /app

# Copy frontend package files for better caching
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm ci --only=production

# Copy frontend source
COPY frontend/. .

# Install all dependencies for build
RUN npm install

# Build frontend with environment variable
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build:prod

# Main application stage
FROM node:24-alpine

WORKDIR /app

# Install nginx for serving frontend static files
RUN apk add --no-cache nginx

# Copy backend package files
COPY backend/package*.json ./

# Install backend dependencies
RUN EXTERNAL_URL=/api npm ci --only=production --no-audit --no-fund

# Copy backend source
COPY backend/ ./

# Copy nginx configuration
COPY docker/app/nginx-main.conf /etc/nginx/nginx.conf

# Copy frontend build from builder stage
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Copy scripts for download
COPY scripts/fio-analyzer-tests.sh /usr/share/nginx/html/fio-analyzer-tests.sh
COPY scripts/fio-analyzer-tests.sh /usr/share/nginx/html/script.sh
COPY scripts/.env.example /usr/share/nginx/html/.env.example
COPY scripts/.env.example /usr/share/nginx/html/env.example

# Create nginx cache directory and startup script
RUN mkdir -p /var/cache/nginx && \
    echo '#!/bin/sh' > /app/start.sh && \
    echo 'echo "Starting FIO Analyzer"' >> /app/start.sh && \
    echo 'echo "Version: $(cat /app/VERSION)"' >> /app/start.sh && \
    echo 'nginx -g "daemon off;" &' >> /app/start.sh && \
    echo 'npm start' >> /app/start.sh && \
    chmod +x /app/start.sh

EXPOSE 80

COPY VERSION /app/VERSION
LABEL version="$(cat /app/VERSION)"

CMD ["/app/start.sh"]