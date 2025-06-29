FROM node:18-alpine

# Add version label
COPY VERSION /app/VERSION
LABEL version="$(cat /app/VERSION)"

WORKDIR /app

# Copy package files
# COPY frontend/package*.json ./

# Copy source code
COPY frontend/. .

# Check if node_modules exists and quit if it does (It should be ignored by .dockerignore)
RUN if [ -d "node_modules" ]; then echo "node_modules directory exists"; exit 1; fi

# Install dependencies
RUN npm ci

# Build the application (skip TypeScript checking)
RUN npm run build:prod

# Install serve to run the built app
RUN npm install -g serve

# Expose port
EXPOSE 3000

# Serve the built application
CMD ["serve", "-s", "dist", "-l", "3000"] 