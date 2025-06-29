#!/bin/bash

# FIO Performance Testing Script
# This script runs FIO tests with multiple block sizes and uploads results to the backend

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to load .env file
load_env() {
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local env_file="$script_dir/.env"
    
    if [ -f "$env_file" ]; then
        print_status "Loading configuration from $env_file"
        # Export variables from .env file
        set -a
        source "$env_file"
        set +a
    else
        print_status "No .env file found at $env_file, using defaults and environment variables"
    fi
}

# Configuration Variables with defaults
set_defaults() {
    HOSTNAME="${HOSTNAME:-$(hostname)}"
    PROTOCOL="${PROTOCOL:-unknown}"
    DESCRIPTION="${DESCRIPTION:-script_test}"
    TEST_SIZE="${TEST_SIZE:-10M}"
    NUM_JOBS="${NUM_JOBS:-4}"
    RUNTIME="${RUNTIME:-30}"
    BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
    TARGET_DIR="${TARGET_DIR:-/tmp/fio_test}"
    USERNAME="${USERNAME:-admin}"
    PASSWORD="${PASSWORD:-admin}"
    
    # Parse BLOCK_SIZES from comma-separated string if provided
    if [ -n "$BLOCK_SIZES" ] && [ "$BLOCK_SIZES" != "4k,64k,1M" ]; then
        IFS=',' read -ra BLOCK_SIZES_ARRAY <<< "$BLOCK_SIZES"
        BLOCK_SIZES=("${BLOCK_SIZES_ARRAY[@]}")
    else
        BLOCK_SIZES=("4k" "64k" "1M")
    fi
    
    # Parse TEST_PATTERNS from comma-separated string if provided
    if [ -n "$TEST_PATTERNS" ] && [ "$TEST_PATTERNS" != "read,write,randread,randwrite" ]; then
        IFS=',' read -ra TEST_PATTERNS_ARRAY <<< "$TEST_PATTERNS"
        TEST_PATTERNS=("${TEST_PATTERNS_ARRAY[@]}")
    else
        TEST_PATTERNS=("read" "write" "randread" "randwrite")
    fi
}

# Function to check if fio is installed
check_fio() {
    if ! command -v fio &> /dev/null; then
        print_error "FIO is not installed. Please install fio first."
        exit 1
    fi
}

# Function to check if curl is installed
check_curl() {
    if ! command -v curl &> /dev/null; then
        print_error "curl is not installed. Please install curl first."
        exit 1
    fi
}

# Function to create target directory
setup_target_dir() {
    if [ ! -d "$TARGET_DIR" ]; then
        print_status "Creating target directory: $TARGET_DIR"
        mkdir -p "$TARGET_DIR" || {
            print_error "Failed to create target directory: $TARGET_DIR"
            exit 1
        }
    fi
}

# Function to run FIO test
run_fio_test() {
    local block_size=$1
    local pattern=$2
    local output_file=$3
    
    print_status "Running FIO test: ${pattern} with ${block_size} block size"
    
    fio --name="test_${pattern}_${block_size}" \
        --rw="$pattern" \
        --bs="$block_size" \
        --size="$TEST_SIZE" \
        --numjobs="$NUM_JOBS" \
        --runtime="$RUNTIME" \
        --time_based \
        --group_reporting \
        --iodepth=1 \
        --direct=1 \
        --filename="${TARGET_DIR}/fio_test_${pattern}_${block_size}" \
        --output-format=json \
        --output="$output_file" \
        --ioengine=psync \
        --norandommap \
        --randrepeat=0 \
        --thread 2>/dev/null
    echo "FIO test completed: ${pattern} with ${block_size}"
    # delete the file
    rm "${TARGET_DIR}/fio_test_${pattern}_${block_size}" || true

    if [ $? -eq 0 ]; then
        print_success "FIO test completed: ${pattern} with ${block_size}"
        return 0
    else
        print_error "FIO test failed: ${pattern} with ${block_size}"
        return 1
    fi
}

# Function to upload results to backend
upload_results() {
    local json_file=$1
    local test_name=$2
    
    print_status "Uploading results: $test_name"
    
    response=$(curl -s -w "%{http_code}" \
        -X POST \
        -u "$USERNAME:$PASSWORD" \
        -F "file=@$json_file" \
        -F "drive_model=unknown" \
        -F "drive_type=unknown" \
        -F "hostname=$HOSTNAME" \
        -F "protocol=$PROTOCOL" \
        -F "description=$DESCRIPTION" \
        "$BACKEND_URL/api/import")
    
    http_code="${response: -3}"
    response_body="${response%???}"
    
    if [ "$http_code" -eq 200 ]; then
        print_success "Upload successful: $test_name"
        echo "Response: $response_body"
    else
        print_error "Upload failed: $test_name (HTTP $http_code)"
        echo "Response: $response_body"
        return 1
    fi
}

# Function to cleanup test files
cleanup() {
    print_status "Cleaning up test files..."
    rm -f "${TARGET_DIR}/fio_test_"*
    rm -f /tmp/fio_results_*.json
}

# Function to display configuration
show_config() {
    echo "========================================="
    echo "FIO Performance Test Configuration"
    echo "========================================="
    echo "Hostname:     $HOSTNAME"
    echo "Protocol:     $PROTOCOL"
    echo "Description:  $DESCRIPTION"
    echo "Test Size:    $TEST_SIZE"
    echo "Num Jobs:     $NUM_JOBS"
    echo "Runtime:      ${RUNTIME}s"
    echo "Backend URL:  $BACKEND_URL"
    echo "Target Dir:   $TARGET_DIR"
    echo "Username:     $USERNAME"
    echo "Block Sizes:  ${BLOCK_SIZES[*]}"
    echo "Patterns:     ${TEST_PATTERNS[*]}"
    echo "========================================="
    echo
}

# Function to run all tests
run_all_tests() {
    local total_tests=$((${#BLOCK_SIZES[@]} * ${#TEST_PATTERNS[@]}))
    local current_test=0
    local successful_uploads=0
    local failed_uploads=0
    
    print_status "Starting $total_tests FIO performance tests..."
    
    for block_size in "${BLOCK_SIZES[@]}"; do
        for pattern in "${TEST_PATTERNS[@]}"; do
            current_test=$((current_test + 1))
            print_status "Test $current_test/$total_tests: ${pattern} with ${block_size}"
            
            output_file="/tmp/fio_results_${pattern}_${block_size}_$(date +%s).json"
            
            if run_fio_test "$block_size" "$pattern" "$output_file"; then
                if upload_results "$output_file" "${pattern}_${block_size}"; then
                    successful_uploads=$((successful_uploads + 1))
                else
                    failed_uploads=$((failed_uploads + 1))
                fi
                rm -f "$output_file"
            else
                failed_uploads=$((failed_uploads + 1))
            fi
            
            echo
        done
    done
    
    # Summary
    echo "========================================="
    echo "Test Summary"
    echo "========================================="
    echo "Total tests:      $total_tests"
    echo "Successful:       $successful_uploads"
    echo "Failed:           $failed_uploads"
    echo "========================================="
    
    if [ $failed_uploads -gt 0 ]; then
        print_warning "Some tests failed. Check the output above for details."
        return 1
    else
        print_success "All tests completed successfully!"
        return 0
    fi
}

# Main function
main() {
    echo "FIO Performance Testing Script"
    echo "============================="
    echo
    
    # Load configuration
    load_env
    set_defaults
    
    # Check prerequisites
    check_fio
    check_curl
    
    # Show configuration
    show_config
    
    # Setup
    setup_target_dir
    
    # Run tests
    if run_all_tests; then
        print_success "Performance testing completed successfully!"
    else
        print_error "Performance testing completed with errors."
        exit 1
    fi
    
    # Cleanup
    cleanup
    
    print_success "All done!"
}

# Handle script interruption
trap 'print_warning "Script interrupted. Cleaning up..."; cleanup; exit 1' INT TERM

# Show help if requested
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    cat << EOF
FIO Performance Testing Script

Usage: $0 [options]

Configuration:
  The script loads configuration from a .env file in the same directory.
  Copy .env.example to .env and customize the values.
  Environment variables override .env file settings.

Configuration Variables:
  HOSTNAME       - Server hostname (default: current hostname)
  PROTOCOL       - Storage protocol (default: unknown)
  DESCRIPTION    - Test description (default: "script_test")
  TEST_SIZE      - Size of test file (default: 10M)
  NUM_JOBS       - Number of parallel jobs (default: 4)
  RUNTIME        - Test runtime in seconds (default: 30)
  BACKEND_URL    - Backend API URL (default: http://localhost:8000)
  TARGET_DIR     - Directory for test files (default: /tmp/fio_test)
  USERNAME       - Authentication username (default: admin)
  PASSWORD       - Authentication password (default: admin)
  BLOCK_SIZES    - Comma-separated block sizes (default: 4k,64k,1M)
  TEST_PATTERNS  - Comma-separated test patterns (default: read,write,randread,randwrite)

Examples:
  # Setup configuration file
  cp .env.example .env
  # Edit .env with your settings, then:
  $0
  
  # Override with environment variables
  HOSTNAME="web01" PROTOCOL="iSCSI" DESCRIPTION="Production test" $0
  
  # Large test with custom patterns
  TEST_SIZE="10G" RUNTIME="300" NUM_JOBS="8" TEST_PATTERNS="read,write" $0

EOF
    exit 0
fi

# Run main function
main "$@"