#!/bin/bash

# FIO Analyzer Docker Registry Push Script

set -e

# Configuration
REGISTRY_URL="${DOCKER_REGISTRY:-docker.io}"  # Default to Docker Hub
NAMESPACE="${DOCKER_NAMESPACE:-styliteag}"  # Change this to your username/organization

# Read version from VERSION file
if [ -f "../VERSION" ]; then
    VERSION=$(cat "../VERSION")
    VERSION_TAG="v${VERSION}"
else
    VERSION_TAG="latest"
fi

echo "🚀 Pushing FIO Analyzer images to registry..."
echo "Registry: ${REGISTRY_URL}"
echo "Namespace: ${NAMESPACE}"
echo "Tag: ${IMAGE_TAG}"
echo ""


# Build the images first
echo "🔨 Building images..."
docker compose build

# Get the image ID
IMAGE_TAG=$(docker images -q fio-analyzer_app)

# Set the external URL for the app so the coantainer will be able to access the API behind a reverse proxy
EXTERNAL_URL=/api
export EXTERNAL_URL

if [ -z "$IMAGE_TAG" ]; then
    echo "❌ Image not found. Make sure to build it first with 'docker compose build'"
    exit 1
fi

# Tag images for registry
echo "🏷️  Tagging images..."
docker tag fio-analyzer_app ${REGISTRY_URL}/${NAMESPACE}/fio-analyzer:${VERSION_TAG}
docker tag fio-analyzer_app ${REGISTRY_URL}/${NAMESPACE}/fio-analyzer:latest

# Push images
echo "📤 Pushing images to registry..."
docker push ${REGISTRY_URL}/${NAMESPACE}/fio-analyzer:${VERSION_TAG}
docker push ${REGISTRY_URL}/${NAMESPACE}/fio-analyzer:latest

echo ""
echo "✅ Images pushed successfully!"
echo ""
echo "📋 Image URL:"
echo "   App:      ${REGISTRY_URL}/${NAMESPACE}/fio-analyzer-app:${IMAGE_TAG}"
echo ""
echo "🚀 To deploy these images, use:"
echo "   IMAGE_TAG=${IMAGE_TAG} DOCKER_NAMESPACE=${NAMESPACE} docker compose -f compose.prod.yml up -d"