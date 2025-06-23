FROM node:18-alpine

WORKDIR /app

COPY backend/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code but not the node_modules
COPY backend/ ./

# Build the application
RUN npm install

EXPOSE 8000

CMD [ "npm", "start" ] 