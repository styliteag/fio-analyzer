FROM nginx:alpine

# Add version label
COPY VERSION /app/VERSION
LABEL version="$(cat /app/VERSION)"

# Copy custom nginx configuration
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]