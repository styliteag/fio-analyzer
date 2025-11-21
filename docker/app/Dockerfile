# Multi-stage build combining frontend and backend
FROM node:24-alpine AS frontend-builder

# Accept build arguments  
ARG VITE_API_URL

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
# This is used during build time to set the api base url
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build:prod

# Main application stage
FROM python:3.14-alpine

WORKDIR /app

# Install nginx for serving frontend static files
RUN apk add --no-cache nginx

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Copy backend project files for uv
COPY backend/pyproject.toml backend/uv.lock ./

# Install Python dependencies with uv and create venv
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy
# Set the virtual environment path
ENV VIRTUAL_ENV=/app/.venv
ENV PATH="/app/.venv/bin:$PATH"
# Install build dependencies temporarily for compiling C extensions
RUN apk add --no-cache --virtual .build-deps \
    gcc \
    musl-dev \
    python3-dev \
    libffi-dev \
    make \
    libuv-dev

# Create virtual environment and install dependencies
RUN uv venv && \
    uv sync --frozen --no-dev

# Remove build dependencies to reduce image size
RUN apk del .build-deps

# Copy backend source
COPY backend/ ./

# Copy nginx configuration
COPY docker/app/nginx-main.conf /etc/nginx/nginx.conf

# Copy health check script
COPY docker/app/health-check.sh /app/health-check.sh

# Copy frontend build from builder stage
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Copy scripts for download (serve directly from nginx)
COPY scripts/fio-test.sh /usr/share/nginx/html/fio-test.sh

# Create nginx cache directory and startup script
RUN mkdir -p /var/cache/nginx && \
    chmod +x /app/health-check.sh && \
    echo '#!/bin/sh' > /app/start.sh && \
    echo 'echo "Starting FIO Analyzer"' >> /app/start.sh && \
    echo 'echo "Version: $(cat /app/VERSION)"' >> /app/start.sh && \
    echo 'nginx -g "daemon off;" &' >> /app/start.sh && \
    echo './.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000' >> /app/start.sh && \
    chmod +x /app/start.sh

EXPOSE 80

COPY VERSION /app/VERSION

# Image metadata
# The $VERSION and $VCS_REF are passed in as build arguments (from the .github/workflows/release-docker.yml file)
LABEL org.opencontainers.image.title="fio-analyzer" \
      org.opencontainers.image.version=$VERSION \
      org.opencontainers.image.revision=$VCS_REF \
      org.opencontainers.image.source="https://github.com/styliteag/fio-analyzer"
LABEL version=$VERSION


CMD ["/app/start.sh"]