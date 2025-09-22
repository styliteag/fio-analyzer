#!/bin/bash

# setup-plan.sh - Setup implementation plan for the current feature

set -e

# Parse arguments
JSON_OUTPUT=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --json)
            JSON_OUTPUT=true
            shift
            ;;
        *)
            shift
            ;;
    esac
done

# Get current branch name
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")

# Find the most recent feature spec file
SPECS_DIR="/Users/bonis/src/fio-analyzer/.specify/specs"
FEATURE_SPEC=$(find "$SPECS_DIR" -name "*.md" -type f -exec ls -t {} + | head -1 2>/dev/null || echo "")

if [[ -z "$FEATURE_SPEC" ]]; then
    echo "Error: No feature specification found in $SPECS_DIR" >&2
    exit 1
fi

# Create implementation plan path
IMPL_PLAN="/Users/bonis/src/fio-analyzer/.specify/plans/$(basename "$FEATURE_SPEC" .md)-plan.md"

# Ensure plans directory exists
mkdir -p "$(dirname "$IMPL_PLAN")"

if [[ "$JSON_OUTPUT" == "true" ]]; then
    echo "{\"FEATURE_SPEC\":\"$FEATURE_SPEC\",\"IMPL_PLAN\":\"$IMPL_PLAN\",\"SPECS_DIR\":\"$SPECS_DIR\",\"BRANCH\":\"$CURRENT_BRANCH\"}"
else
    echo "Feature Spec: $FEATURE_SPEC"
    echo "Implementation Plan: $IMPL_PLAN"
    echo "Specs Directory: $SPECS_DIR"
    echo "Branch: $CURRENT_BRANCH"
fi