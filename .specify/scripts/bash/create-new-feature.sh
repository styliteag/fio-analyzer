#!/bin/bash

# create-new-feature.sh - Create a new feature branch and spec file

set -e

# Parse arguments
JSON_OUTPUT=false
FEATURE_DESCRIPTION=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --json)
            JSON_OUTPUT=true
            shift
            ;;
        *)
            FEATURE_DESCRIPTION="$1"
            shift
            ;;
    esac
done

if [[ -z "$FEATURE_DESCRIPTION" ]]; then
    echo "Error: Feature description is required" >&2
    exit 1
fi

# Generate branch name from description
BRANCH_NAME=$(echo "$FEATURE_DESCRIPTION" | \
    sed 's/[^a-zA-Z0-9 ]//g' | \
    tr '[:upper:]' '[:lower:]' | \
    sed 's/  */ /g' | \
    sed 's/^ *//;s/ *$//' | \
    tr ' ' '-' | \
    sed 's/--*/-/g' | \
    cut -c1-50)

# Add feature prefix
BRANCH_NAME="feature/performance-graphs-visualization"

# Create and checkout new branch
git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME" 2>/dev/null || true

# Create spec file path
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
SPEC_FILE="/Users/bonis/src/fio-analyzer/.specify/specs/performance-graphs-visualization-${TIMESTAMP}.md"

# Ensure specs directory exists
mkdir -p "$(dirname "$SPEC_FILE")"

# Create initial spec file
cat > "$SPEC_FILE" << 'EOF'
# Feature Specification Template

## Overview
[Feature overview will be filled by specification process]

## Requirements
[Requirements will be filled by specification process]

## Implementation Plan
[Implementation plan will be filled by specification process]
EOF

if [[ "$JSON_OUTPUT" == "true" ]]; then
    echo "{\"BRANCH_NAME\":\"$BRANCH_NAME\",\"SPEC_FILE\":\"$SPEC_FILE\"}"
else
    echo "Branch: $BRANCH_NAME"
    echo "Spec file: $SPEC_FILE"
fi