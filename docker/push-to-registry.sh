#!/bin/bash

# FIO Analyzer Docker Registry Push Script with Multi-Architecture Support

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

echo "🚀 Building and pushing FIO Analyzer multi-architecture images to registry..."
echo "Registry: ${REGISTRY_URL}"
echo "Namespace: ${NAMESPACE}"
echo "Version Tag: ${VERSION_TAG}"
echo ""

# Set the external URL for the app so the container will be able to access the API behind a reverse proxy
EXTERNAL_URL=/api
export EXTERNAL_URL

# Create and use a multi-platform builder if it doesn't exist
BUILDER_NAME="fio-analyzer-builder"
if ! docker buildx inspect $BUILDER_NAME >/dev/null 2>&1; then
    echo "🔨 Creating multi-platform builder: $BUILDER_NAME"
    docker buildx create --name $BUILDER_NAME --use
else
    echo "🔨 Using existing multi-platform builder: $BUILDER_NAME"
    docker buildx use $BUILDER_NAME
fi

# Build and push multi-architecture images
echo "🏗️  Building multi-architecture images..."
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag ${REGISTRY_URL}/${NAMESPACE}/fio-analyzer:${VERSION_TAG} \
    --tag ${REGISTRY_URL}/${NAMESPACE}/fio-analyzer:latest \
    --file app/Dockerfile \
    --build-arg VITE_API_URL="." \
    --push \
    ..

echo ""
echo "✅ Multi-architecture images built and pushed successfully!"
echo ""
echo "📋 Image URLs:"
echo "   App:      ${REGISTRY_URL}/${NAMESPACE}/fio-analyzer:${VERSION_TAG}"
echo "   Latest:   ${REGISTRY_URL}/${NAMESPACE}/fio-analyzer:latest"
echo ""
echo "🏗️  Supported architectures:"
echo "   - linux/amd64 (x86_64)"
echo "   - linux/arm64 (ARM64)"
echo ""
echo "🚀 To deploy these images, use:"
echo "   DOCKER_NAMESPACE=${NAMESPACE} docker compose -f compose.prod.yml up -d"