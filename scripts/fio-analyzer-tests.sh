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
    HOSTNAME="${HOSTNAME:-$(hostname -s)}"
    PROTOCOL="${PROTOCOL:-unknown}"
    DESCRIPTION="${DESCRIPTION:-script_test}"
    # Sanitize the description change " " to "_" and remove any special charaters
    DESCRIPTION=$(echo "$DESCRIPTION" | sed 's/ /_/g' | sed 's/[^-a-zA-Z0-9_,;:]//g')
    DRIVE_TYPE="${DRIVE_TYPE:-unknown}"
    DRIVE_MODEL="${DRIVE_MODEL:-unknown}"
    TEST_SIZE="${TEST_SIZE:-100M}"
    NUM_JOBS="${NUM_JOBS:-4}"
    DIRECT="${DIRECT:-1}"
    RUNTIME="${RUNTIME:-20}"
    BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
    TARGET_DIR="${TARGET_DIR:-/tmp/fio_test}"
    USERNAME="${USERNAME:-uploader}"
    PASSWORD="${PASSWORD:-uploaderpassword}"
    
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

    # Parse NUM_JOBS from comma-separated string if provided
    if [ -n "$NUM_JOBS" ] && [ "$NUM_JOBS" != "4" ]; then
        IFS=',' read -ra NUM_JOBS_ARRAY <<< "$NUM_JOBS"
        NUM_JOBS=("${NUM_JOBS_ARRAY[@]}")
    else
        NUM_JOBS=("4")
    fi
    
    # Parse DIRECT from comma-separated string if provided
    if [ -n "$DIRECT" ] && [ "$DIRECT" != "1" ]; then
        IFS=',' read -ra DIRECT_ARRAY <<< "$DIRECT"
        DIRECT=("${DIRECT_ARRAY[@]}")
    else
        DIRECT=("1")
    fi

    # Parse TEST_SIZE from comma-separated string if provided
    if [ -n "$TEST_SIZE" ] && [ "$TEST_SIZE" != "10M" ]; then
        IFS=',' read -ra TEST_SIZE_ARRAY <<< "$TEST_SIZE"
        TEST_SIZE=("${TEST_SIZE_ARRAY[@]}")
    else
        TEST_SIZE=("10M")
    fi

    # Parse SYNC from comma-separated string if provided
    if [ -n "$SYNC" ] && [ "$SYNC" != "1" ]; then
        IFS=',' read -ra SYNC_ARRAY <<< "$SYNC"
        SYNC=("${SYNC_ARRAY[@]}")
    else
        SYNC=("1")
    fi

    # Parse IODEPTH from comma-separated string if provided
    if [ -n "$IODEPTH" ] && [ "$IODEPTH" != "1" ]; then
        IFS=',' read -ra IODEPTH_ARRAY <<< "$IODEPTH"
        IODEPTH=("${IODEPTH_ARRAY[@]}")
    else
        IODEPTH=("1")
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

# Function to check if libaio is available
check_libaio() {
    print_status "Checking for libaio availability..."
    
    # Test if libaio engine can actually be loaded by running a minimal test
    local test_output
    test_output=$(fio --name=test --ioengine=libaio --rw=read --bs=4k --size=1M --filename=/dev/null --runtime=1 --time_based 2>&1)
    
    if echo "$test_output" | grep -q "engine libaio not loadable"; then
        print_warning "libaio engine not available - using psync engine"
        IOENGINE="psync"
        # Psync is a sync engine that uses the POSIX pwrite() function to write data to the file.
        # It can only have a iodepth of 1.
        #IODEPTH=1
    else
        print_success "libaio engine is available - will use for better performance"
        IOENGINE="libaio"
    fi
}

# Function to check API connectivity
check_api_connectivity() {
    print_status "Checking API connectivity to $BACKEND_URL"
    
    # Test basic connectivity to the API endpoint
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 30 "$BACKEND_URL/api/test-runs" 2>/dev/null)
    local curl_exit_code=$?
    
    if [ $curl_exit_code -ne 0 ]; then
        print_error "Cannot connect to API server at $BACKEND_URL"
        print_error "Please check:"
        print_error "  - Server is running and accessible"
        print_error "  - URL is correct (current: $BACKEND_URL)"
        print_error "  - Network connectivity"
        print_error "  - Firewall settings"
        exit 1
    fi
    
    # Check if we get a valid HTTP response (200, 401, etc. are all valid responses)
    if [[ "$http_code" =~ ^[0-9]{3}$ ]]; then
        print_success "API server is reachable (HTTP $http_code)"
    else
        print_error "Invalid response from API server: $http_code"
        exit 1
    fi
}

# Function to validate credentials
check_credentials() {
    print_status "Validating credentials for user '$USERNAME'"
    
    # First try to access test-runs endpoint (admin-only)
    local response
    response=$(curl -s -w "%{http_code}" -u "$USERNAME:$PASSWORD" \
        --connect-timeout 10 --max-time 30 \
        "$BACKEND_URL/api/test-runs" 2>/dev/null)
    
    local curl_exit_code=$?
    if [ $curl_exit_code -ne 0 ]; then
        print_error "Network error while validating credentials"
        exit 1
    fi
    
    local http_code="${response: -3}"
    local response_body="${response%???}"
    
    case "$http_code" in
        200)
            print_success "Credentials validated successfully"
            print_status "User '$USERNAME' has full admin access"
            return 0
            ;;
        401)
            print_error "Authentication failed: Invalid username or password"
            print_error "Please check your credentials:"
            print_error "  - Username: $USERNAME"
            print_error "  - Password: [hidden]"
            print_error "  - Verify credentials are correct in your .env file"
            exit 1
            ;;
        403)
            print_status "User '$USERNAME' does not have admin access, checking upload permissions..."
            # Test upload endpoint for upload-only users
            local upload_response
            upload_response=$(curl -s -w "%{http_code}" -u "$USERNAME:$PASSWORD" \
                --connect-timeout 10 --max-time 30 \
                -X GET "$BACKEND_URL/api/import" 2>/dev/null)
            
            local upload_http_code="${upload_response: -3}"
            
            case "$upload_http_code" in
                405)
                    # Method Not Allowed is expected for GET on /api/import (it only accepts POST)
                    # This means the user can access the endpoint but wrong method
                    print_success "Credentials validated successfully"
                    print_status "User '$USERNAME' has upload-only access"
                    return 0
                    ;;
                404)
                    # Some servers return 404 for GET on POST-only routes instead of 405
                    # Test with a POST request to validate upload permissions
                    print_status "Testing upload endpoint with POST request..."
                    local post_response
                    post_response=$(curl -s -w "%{http_code}" -u "$USERNAME:$PASSWORD" \
                        --connect-timeout 10 --max-time 30 \
                        -X POST "$BACKEND_URL/api/import" 2>/dev/null)
                    
                    local post_http_code="${post_response: -3}"
                    
                    case "$post_http_code" in
                        400)
                            # Bad Request - expected when no file is uploaded, but user is authenticated
                            print_success "Credentials validated successfully"
                            print_status "User '$USERNAME' has upload-only access"
                            return 0
                            ;;
                        401)
                            print_error "Authentication failed: Invalid username or password"
                            exit 1
                            ;;
                        403)
                            print_error "Access denied: User '$USERNAME' does not have upload permissions"
                            exit 1
                            ;;
                        *)
                            print_error "Cannot validate upload permissions (HTTP $post_http_code)"
                            exit 1
                            ;;
                    esac
                    ;;
                401)
                    print_error "Authentication failed: Invalid username or password"
                    exit 1
                    ;;
                403)
                    print_error "Access denied: User '$USERNAME' does not have upload permissions"
                    exit 1
                    ;;
                200)
                    # Unexpected but valid response
                    print_success "Credentials validated successfully"
                    print_status "User '$USERNAME' has upload access"
                    return 0
                    ;;
                *)
                    print_error "Cannot validate upload permissions (HTTP $upload_http_code)"
                    exit 1
                    ;;
            esac
            ;;
        *)
            print_error "Unexpected response while validating credentials (HTTP $http_code)"
            print_error "Response: $response_body"
            exit 1
            ;;
    esac
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
    #"$block_size" "$pattern" "$output_file" "$num_jobs" "$direct" "$test_size" "$sync" "$iodepth"; then
    local block_size=$1
    local pattern=$2
    local output_file=$3
    local num_jobs=$4
    local direct=$5
    local test_size=$6
    local sync=$7
    local iodepth=$8

    print_status "Running FIO test: ${pattern} with ${block_size} block size"
    
    fio --name="${DESCRIPTION},pattern:${pattern},block_size:${block_size},num_jobs:${num_jobs},direct:${direct},test_size:${test_size},sync:${sync},iodepth:${iodepth},date:$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --rw="$pattern" \
        --bs="$block_size" \
        --size="$test_size" \
        --numjobs="$num_jobs" \
        --runtime="$RUNTIME" \
        --time_based \
        --group_reporting \
        --iodepth="$iodepth" \
        --direct="$direct" \
        --sync="$sync" \
        --filename="${TARGET_DIR}/fio_test_${pattern}_${block_size}" \
        --output-format=json \
        --output="$output_file" \
        --ioengine="$IOENGINE" \
        --norandommap \
        --randrepeat=0 \
        --thread 2>/dev/null
    echo "FIO test completed: ${pattern} with ${block_size}"
    # delete the file
    rm "${TARGET_DIR}/fio_test_${pattern}_${block_size}" || true

    exit 0
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
        -F "drive_model=$DRIVE_MODEL" \
        -F "drive_type=$DRIVE_TYPE" \
        -F "hostname=$HOSTNAME" \
        -F "protocol=$PROTOCOL" \
        -F "description=$DESCRIPTION" \
        -F "date=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
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
    echo "Drive Model:  $DRIVE_MODEL"
    echo "Drive Type:   $DRIVE_TYPE"
    echo "Test Size:    $TEST_SIZE"
    echo "Num Jobs:     $NUM_JOBS"
    echo "Runtime:      ${RUNTIME}s"
    echo "Direct:       $DIRECT"
    echo "I/O Engine:   $IOENGINE"
    echo "I/O Depth:    $IODEPTH"
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
            for num_jobs in "${NUM_JOBS[@]}"; do
        for pattern in "${TEST_PATTERNS[@]}"; do
                for direct in "${DIRECT[@]}"; do
                    for test_size in "${TEST_SIZE[@]}"; do
                        for sync in "${SYNC[@]}"; do
                            for iodepth in "${IODEPTH[@]}"; do
                                current_test=$((current_test + 1))
                                print_status "Test $current_test/$total_tests: ${pattern} with ${block_size}"

                                output_file="/tmp/fio_results_${pattern}_${block_size}_${num_jobs}_${direct}_${test_size}_$(date +%s).json"

                                if run_fio_test "$block_size" "$pattern" "$output_file" "$num_jobs" "$direct" "$test_size" "$sync" "$iodepth"; then
                                    if upload_results "$output_file" "${pattern}_${block_size}_${num_jobs}_${direct}_${test_size}_${sync}_${iodepth}"; then
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
                    done
                done
            done
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
    check_libaio
    
    # Show configuration
    show_config
    
    # Validate API connectivity and credentials
    check_api_connectivity
    check_credentials
    
    # Confirm before starting tests (unless --yes flag is used)
    echo
    print_status "All checks passed! Ready to start FIO performance testing."
    local total_tests=$((${#BLOCK_SIZES[@]} * ${#TEST_PATTERNS[@]} * ${#NUM_JOBS[@]} * ${#DIRECT[@]} * ${#TEST_SIZE[@]} * ${#SYNC[@]} * ${#IODEPTH[@]}))
    print_status "This will run $total_tests tests with the following configuration:"
    print_status "  Block sizes: ${BLOCK_SIZES[*]}"
    print_status "  Number of jobs: ${NUM_JOBS[*]}"
    print_status "  Direct: ${DIRECT[*]}"
    print_status "  Test size: ${TEST_SIZE[*]}"
    print_status "  Sync: ${SYNC[*]}"
    print_status "  I/O Depth: ${IODEPTH[*]}"
    print_status "  Test patterns: ${TEST_PATTERNS[*]}"
    print_status "  Test duration: ${RUNTIME}s per test"
    print_status "  Estimated total time: $((total_tests * RUNTIME / 60)) minutes"
    echo
    
    # Check for --yes flag to skip confirmation
    local skip_confirmation=false
    for arg in "$@"; do
        if [ "$arg" = "--yes" ] || [ "$arg" = "-y" ]; then
            skip_confirmation=true
            break
        fi
    done
    
    if [ "$skip_confirmation" = false ]; then
        read -p "Do you want to proceed? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_warning "Test cancelled by user"
            exit 0
        fi
    else
        print_status "Auto-confirmed with --yes flag"
    fi
    
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

Options:
  -h, --help    Show this help message
  -y, --yes     Skip confirmation prompt and start tests automatically

Configuration:
  The script loads configuration from a .env file in the same directory.
  Copy .env.example to .env and customize the values.
  Environment variables override .env file settings.

Pre-flight Checks:
  The script performs the following checks before starting tests:
  1. Verifies FIO and curl are installed
  2. Checks for libaio availability (uses libaio if available for better performance)
  3. Tests API connectivity to the backend server
  4. Validates authentication credentials
  5. Confirms test configuration with user (unless --yes is used)

Configuration Variables:
  HOSTNAME       - Server hostname (default: current hostname)
  PROTOCOL       - Storage protocol (default: unknown)
  DESCRIPTION    - Test description (default: "script_test")
  DRIVE_MODEL    - Drive model (default: unknown)
  DRIVE_TYPE     - Drive type (default: unknown)
  TEST_SIZE      - Size of test file (default: 10M)
  NUM_JOBS       - Number of parallel jobs (default: 4)
  RUNTIME        - Test runtime in seconds (default: 30)
  DIRECT         - Direct I/O mode (default: 1)
  BACKEND_URL    - Backend API URL (default: http://localhost:8000)
  TARGET_DIR     - Directory for test files (default: /tmp/fio_test)
  USERNAME       - Authentication username (default: admin)
  PASSWORD       - Authentication password (default: admin)
  BLOCK_SIZES    - Comma-separated block sizes (default: 4k,64k,1M)
  TEST_PATTERNS  - Comma-separated test patterns (default: read,write,randread,randwrite)
  NUM_JOBS       - Number of parallel jobs (default: 4)
  DIRECT         - Direct I/O mode (default: 1)
  TEST_SIZE      - Size of test file (default: 10M)
  SYNC           - Sync mode (default: 1)
  IODEPTH        - I/O Depth (default: 1)

Examples:
  # Setup configuration file
  cp .env.example .env
  # Edit .env with your settings, then:
  $0
  
  # Override with environment variables
  HOSTNAME="web01" PROTOCOL="iSCSI" DESCRIPTION="Production test" DRIVE_MODEL="WD1003FZEX" DRIVE_TYPE="HDD" $0
  
  # Large test with custom patterns
  TEST_SIZE="10G" RUNTIME="300" DIRECT="1" NUM_JOBS="8" TEST_PATTERNS="read,write" $0

EOF
    exit 0
fi

# Run main function
main "$@"
