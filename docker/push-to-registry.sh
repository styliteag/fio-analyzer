#!/bin/bash

# FIO Analyzer Docker Registry Push Script

set -e

# Configuration
REGISTRY_URL="${DOCKER_REGISTRY:-docker.io}"  # Default to Docker Hub
NAMESPACE="${DOCKER_NAMESPACE:-styliteag}"  # Change this to your username/organization

# Read version from VERSION file
if [ -f "../VERSION" ]; then
    VERSION=$(cat "../VERSION")
    IMAGE_TAG="${IMAGE_TAG:-v${VERSION}}"
else
    IMAGE_TAG="${IMAGE_TAG:-latest}"
fi

echo "🚀 Pushing FIO Analyzer images to registry..."
echo "Registry: ${REGISTRY_URL}"
echo "Namespace: ${NAMESPACE}"
echo "Tag: ${IMAGE_TAG}"
echo ""


# Build the images first
echo "🔨 Building images..."
docker compose build

# Get the image IDs
NGINX_IMAGE=$(docker images -q fio-analyzer_nginx)
BACKEND_IMAGE=$(docker images -q fio-analyzer_backend) 
FRONTEND_IMAGE=$(docker images -q fio-analyzer_frontend)

if [ -z "$NGINX_IMAGE" ] || [ -z "$BACKEND_IMAGE" ] || [ -z "$FRONTEND_IMAGE" ]; then
    echo "❌ Images not found. Make sure to build them first with 'docker compose build'"
    exit 1
fi

# Tag images for registry
echo "🏷️  Tagging images..."
docker tag fio-analyzer_nginx ${REGISTRY_URL}/${NAMESPACE}/fio-analyzer-nginx:${IMAGE_TAG}
docker tag fio-analyzer_backend ${REGISTRY_URL}/${NAMESPACE}/fio-analyzer-backend:${IMAGE_TAG}
docker tag fio-analyzer_frontend ${REGISTRY_URL}/${NAMESPACE}/fio-analyzer-frontend:${IMAGE_TAG}

# Push images
echo "📤 Pushing images to registry..."
docker push ${REGISTRY_URL}/${NAMESPACE}/fio-analyzer-nginx:${IMAGE_TAG}
docker push ${REGISTRY_URL}/${NAMESPACE}/fio-analyzer-backend:${IMAGE_TAG}
docker push ${REGISTRY_URL}/${NAMESPACE}/fio-analyzer-frontend:${IMAGE_TAG}

docker push ${REGISTRY_URL}/${NAMESPACE}/fio-analyzer-nginx:latest
docker push ${REGISTRY_URL}/${NAMESPACE}/fio-analyzer-backend:latest
docker push ${REGISTRY_URL}/${NAMESPACE}/fio-analyzer-frontend:latest

echo ""
echo "✅ Images pushed successfully!"
echo ""
echo "📋 Image URLs:"
echo "   Nginx:    ${REGISTRY_URL}/${NAMESPACE}/fio-analyzer-nginx:${IMAGE_TAG}"
echo "   Backend:  ${REGISTRY_URL}/${NAMESPACE}/fio-analyzer-backend:${IMAGE_TAG}"
echo "   Frontend: ${REGISTRY_URL}/${NAMESPACE}/fio-analyzer-frontend:${IMAGE_TAG}"
echo ""
echo "🚀 To deploy these images, use:"
echo "   IMAGE_TAG=${IMAGE_TAG} DOCKER_NAMESPACE=${NAMESPACE} docker compose -f compose.prod.yml up -d"