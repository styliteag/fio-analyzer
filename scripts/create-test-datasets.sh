#!/bin/bash

# Exit on error, undefined variables, and pipe failures
set -euo pipefail

# Script to create ZFS test datasets for fio-analyzer
# Usage: ./create-test-datasets.sh <pool_name>

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# Configuration
readonly TESTNAME="tests"
readonly RECORDSIZE="64k"

# Function to print error messages
error() {
    echo -e "${RED}ERROR: $*${NC}" >&2
}

# Function to print success messages
success() {
    echo -e "${GREEN}SUCCESS: $*${NC}"
}

# Function to print warning messages
warning() {
    echo -e "${YELLOW}WARNING: $*${NC}"
}

# Function to print info messages
info() {
    echo "INFO: $*"
}

# Function to check if running as root or with sudo
check_privileges() {
    if [[ $EUID -ne 0 ]]; then
        warning "This script may require root privileges to manage ZFS datasets"
        warning "If commands fail, try running with sudo"
    fi
}

# Function to check if zfs command exists
check_zfs_installed() {
    if ! command -v zfs &> /dev/null; then
        error "zfs command not found. Please install ZFS first."
        exit 1
    fi
}

# Function to display usage
usage() {
    cat << EOF
Usage: $0 <pool_name>

Creates test datasets for fio-analyzer in the specified ZFS pool.

Arguments:
    pool_name    Name of the ZFS pool where test datasets will be created

Example:
    $0 mypool

This will create:
    - mypool/tests (parent dataset with 64k recordsize)
    - mypool/tests/syncon (dataset with sync enabled)
    - mypool/tests/syncoff (dataset with sync disabled)
EOF
    exit 1
}

# Function to check if ZFS pool exists
pool_exists() {
    local pool=$1
    if ! zfs list -H -o name "$pool" &> /dev/null; then
        return 1
    fi
    return 0
}

# Function to check if ZFS dataset exists
dataset_exists() {
    local dataset=$1
    if zfs list -H -o name "$dataset" &> /dev/null; then
        return 0
    fi
    return 1
}

# Function to create dataset with error handling
create_dataset() {
    local dataset=$1
    local description=$2
    
    if dataset_exists "$dataset"; then
        warning "Dataset '$dataset' already exists, skipping creation"
        return 0
    fi
    
    info "Creating dataset: $dataset ($description)"
    if zfs create "$dataset"; then
        success "Created dataset: $dataset"
        return 0
    else
        error "Failed to create dataset: $dataset"
        return 1
    fi
}

# Function to set ZFS property with error handling
set_zfs_property() {
    local property=$1
    local value=$2
    local dataset=$3
    local description=$4
    
    info "Setting $property=$value on $dataset ($description)"
    if zfs set "$property=$value" "$dataset"; then
        success "Set $property=$value on $dataset"
        return 0
    else
        error "Failed to set $property=$value on $dataset"
        return 1
    fi
}

# Main script starts here

# Check for help flag
if [[ "${1:-}" == "-h" ]] || [[ "${1:-}" == "--help" ]]; then
    usage
fi

# Validate arguments
if [[ $# -ne 1 ]]; then
    error "Invalid number of arguments"
    usage
fi

POOL=$1

# Validate pool name (basic check for valid characters)
if [[ ! "$POOL" =~ ^[a-zA-Z0-9_/-]+$ ]]; then
    error "Invalid pool name: '$POOL'. Pool name should contain only alphanumeric characters, hyphens, and underscores."
    exit 1
fi

# Perform prerequisite checks
info "Starting ZFS test dataset creation for pool: $POOL"
check_zfs_installed
check_privileges

# Check if pool exists
if ! pool_exists "$POOL"; then
    error "ZFS pool '$POOL' does not exist"
    error "Available pools:"
    zpool list -H -o name 2>/dev/null || echo "  (none found or insufficient privileges)"
    exit 1
fi

success "ZFS pool '$POOL' found"

# Create parent test dataset
PARENT_DATASET="$POOL/$TESTNAME"
if ! dataset_exists "$PARENT_DATASET"; then
    create_dataset "$PARENT_DATASET" "parent test dataset" || exit 1
    set_zfs_property "recordsize" "$RECORDSIZE" "$PARENT_DATASET" "optimize for testing" || exit 1
else
    warning "Parent dataset '$PARENT_DATASET' already exists"
    # Verify and update recordsize if needed
    current_recordsize=$(zfs get -H -o value recordsize "$PARENT_DATASET" 2>/dev/null || echo "unknown")
    if [[ "$current_recordsize" != "$RECORDSIZE" ]]; then
        warning "Current recordsize is $current_recordsize, updating to $RECORDSIZE"
        set_zfs_property "recordsize" "$RECORDSIZE" "$PARENT_DATASET" "optimize for testing" || warning "Failed to update recordsize"
    fi
fi

# Create sync-enabled dataset
SYNCON_DATASET="$PARENT_DATASET/syncon"
create_dataset "$SYNCON_DATASET" "sync enabled" || exit 1

# Create sync-disabled dataset
SYNCOFF_DATASET="$PARENT_DATASET/syncoff"
create_dataset "$SYNCOFF_DATASET" "sync disabled" || exit 1
set_zfs_property "sync" "disabled" "$SYNCOFF_DATASET" "disable sync for testing" || exit 1

# Summary
echo ""
success "All test datasets created successfully!"
info "Summary of created datasets:"
zfs list -r "$PARENT_DATASET" -o name,used,avail,refer,mountpoint,sync,recordsize 2>/dev/null || \
    zfs list -r "$PARENT_DATASET" 2>/dev/null

exit 0