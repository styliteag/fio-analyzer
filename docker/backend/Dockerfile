FROM node:18-alpine

WORKDIR /app

# Copy package files first for better layer caching
COPY backend/package*.json ./

# Install production dependencies only
RUN npm ci --only=production --no-audit --no-fund

# Copy source code
COPY backend/ ./

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

EXPOSE 8000

CMD [ "npm", "start" ] 