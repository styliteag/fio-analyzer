#!/usr/bin/env bash

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

# Function to load .env file with support for INCLUDE directive
load_env() {
    local env_file="${1:-.env}"
    local processed_files="${2:-}"  # Track processed files to prevent circular includes
    local base_dir
    
    # Get directory of the env file for resolving relative INCLUDE paths
    if [ -f "$env_file" ]; then
        base_dir=$(dirname "$(readlink -f "$env_file" 2>/dev/null || echo "$env_file")")
    else
        base_dir="$(pwd)"
    fi
    
    # Resolve absolute path for circular include detection
    local abs_path
    if [ -f "$env_file" ]; then
        abs_path=$(readlink -f "$env_file" 2>/dev/null || realpath "$env_file" 2>/dev/null || echo "$env_file")
    else
        abs_path="$env_file"
    fi
    
    # Check for circular includes
    if echo "$processed_files" | grep -q ":$abs_path:"; then
        print_error "Circular include detected: $env_file"
        return 1
    fi
    
    # Add current file to processed list
    processed_files="${processed_files}:${abs_path}:"
    
    if [ -f "$env_file" ]; then
        print_status "Loading configuration from $env_file"
        
        # Process INCLUDE directives first, then export variables
        set -a
        while IFS= read -r line || [ -n "$line" ]; do
            # Skip comments and empty lines
            if [[ "$line" =~ ^[[:space:]]*# ]] || [[ -z "${line// }" ]]; then
                continue
            fi
            
            # Check for INCLUDE directive (case-insensitive, with optional quotes)
            if [[ "$line" =~ ^[[:space:]]*[Ii][Nn][Cc][Ll][Uu][Dd][Ee][[:space:]]*=[[:space:]]*(.+)$ ]]; then
                local include_file="${BASH_REMATCH[1]}"
                # Remove quotes if present
                include_file="${include_file#\"}"
                include_file="${include_file#\'}"
                include_file="${include_file%\"}"
                include_file="${include_file%\'}"
                # Remove leading/trailing whitespace
                include_file="${include_file#"${include_file%%[![:space:]]*}"}"
                include_file="${include_file%"${include_file##*[![:space:]]}"}"
                
                # Resolve relative paths relative to the current env file's directory
                if [[ "$include_file" != /* ]]; then
                    include_file="$base_dir/$include_file"
                fi
                
                # Recursively load included file (before processing remaining variables)
                if [ -f "$include_file" ]; then
                    load_env "$include_file" "$processed_files"
                else
                    print_warning "INCLUDE file not found: $include_file (referenced from $env_file)"
                fi
            fi
        done < "$env_file"
        
        # Now process regular variables (second pass, after INCLUDEs are processed)
        while IFS= read -r line || [ -n "$line" ]; do
            # Skip comments, empty lines, and INCLUDE directives
            if [[ "$line" =~ ^[[:space:]]*# ]] || [[ -z "${line// }" ]] || [[ "$line" =~ ^[[:space:]]*[Ii][Nn][Cc][Ll][Uu][Dd][Ee][[:space:]]*= ]]; then
                continue
            fi
            
            # Export regular env variables
            if [[ "$line" =~ ^[[:space:]]*([^=]+)=(.*)$ ]]; then
                local key="${BASH_REMATCH[1]}"
                local value="${BASH_REMATCH[2]}"
                # Remove leading/trailing whitespace from key
                key="${key#"${key%%[![:space:]]*}"}"
                key="${key%"${key##*[![:space:]]}"}"
                # Remove leading/trailing whitespace from value
                value="${value#"${value%%[![:space:]]*}"}"
                value="${value%"${value##*[![:space:]]}"}"
                # Remove quotes (both single and double) from value
                value="${value#\"}"
                value="${value#\'}"
                value="${value%\"}"
                value="${value%\'}"
                # Export the variable
                export "$key=$value"
            fi
        done < "$env_file"
        set +a
    else
        print_status "No .env file found at $env_file, using defaults and environment variables"
    fi
}

# Function to load multiple .env files in order
load_env_files() {
    local env_files=("$@")
    
    if [ ${#env_files[@]} -eq 0 ]; then
        # Default to .env if no files specified
        load_env ".env"
    else
        for env_file in "${env_files[@]}"; do
            load_env "$env_file"
        done
    fi
}

# Function to generate UUID from hash (SHA256-based UUID5)
generate_uuid_from_hash() {
    local input_string="$1"

    # Generate SHA256 hash
    local hash=$(echo -n "$input_string" | sha256sum | awk '{print $1}')

    # Take first 32 chars and format as UUID (8-4-4-4-12)
    # Set version to 5 in the 13th character position (version nibble)
    # Set variant to RFC 4122 in the 17th character position
    local uuid="${hash:0:8}-${hash:8:4}-5${hash:13:3}-${hash:16:1}${hash:17:3}-${hash:20:12}"

    echo "$uuid"
}

# Configuration Variables with defaults
set_defaults() {
    HOSTNAME="${HOSTNAME:-$(hostname -s)}"
    PROTOCOL="${PROTOCOL:-unknown}"
    DRIVE_TYPE="${DRIVE_TYPE:-unknown}"
    DRIVE_MODEL="${DRIVE_MODEL:-unknown}"
    TEST_SIZE="${TEST_SIZE:-100M}"
    NUM_JOBS="${NUM_JOBS:-4}"
    DIRECT="${DIRECT:-1}"
    RUNTIME="${RUNTIME:-20}"
    BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
    TARGET_DIR="${TARGET_DIR:-./fio_tmp/}"
    USERNAME="${USERNAME:-uploader}"
    PASSWORD="${PASSWORD:-uploader}"

    DESCRIPTION="$DESCRIPTION,hostname:${HOSTNAME},protocol:${PROTOCOL},drivetype:${DRIVE_TYPE},drivemodel:${DRIVE_MODEL},run_uuid:${RUN_UUID},config_uuid:${CONFIG_UUID},pattern:${pattern},block_size:${block_size},num_jobs:${num_jobs},direct:${direct},test_size:${test_size},sync:${sync},iodepth:${iodepth},runtime:${runtime},date:$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    # Sanitize the description change " " to "_" and remove any special charaters
    DESCRIPTION=$(echo "$DESCRIPTION" | sed 's/ /_/g' | sed 's/[^-a-zA-Z0-9_,;:]//g')

    # UUID Generation
    # config_uuid: Fixed per host-config (from .env or generated from hostname)
    if [ -n "$CONFIG_UUID" ]; then
        print_status "Using CONFIG_UUID from .env: $CONFIG_UUID"
    else
        CONFIG_UUID=$(generate_uuid_from_hash "$HOSTNAME")
        print_status "Generated CONFIG_UUID from hostname: $CONFIG_UUID"
    fi

    # run_uuid: Unique per script run (random UUID4)
    if command -v uuidgen &> /dev/null; then
        RUN_UUID=$(uuidgen | tr '[:upper:]' '[:lower:]')
    else
        # Fallback: Generate from hostname + current date (not time)
        current_date=$(date -u +%Y-%m-%d)
        RUN_UUID=$(generate_uuid_from_hash "${HOSTNAME}_${current_date}")
    fi
    print_status "Generated RUN_UUID for this script run: $RUN_UUID"

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

    # Parse RUNTIME from comma-separated string if provided
    if [ -n "$RUNTIME" ] && [ "$RUNTIME" != "30" ]; then
        IFS=',' read -ra RUNTIME_ARRAY <<< "$RUNTIME"
        RUNTIME=("${RUNTIME_ARRAY[@]}")
    else
        RUNTIME=("30")
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

# Function to validate test configuration
validate_test_config() {
    print_status "Validating test configuration..."
    
    local warnings=0
    
    # Check for high job counts with small test sizes
    for num_jobs in "${NUM_JOBS[@]}"; do
        for test_size in "${TEST_SIZE[@]}"; do
            # Convert test size to bytes for comparison
            local size_bytes
            if [[ "$test_size" =~ ^([0-9]+)([KMG])$ ]]; then
                local size_num="${BASH_REMATCH[1]}"
                local size_unit="${BASH_REMATCH[2]}"
                case "$size_unit" in
                    K) size_bytes=$((size_num * 1024)) ;;
                    M) size_bytes=$((size_num * 1024 * 1024)) ;;
                    G) size_bytes=$((size_num * 1024 * 1024 * 1024)) ;;
                esac
                
                # Calculate bytes per job
                local bytes_per_job=$((size_bytes / num_jobs))
                
                # Warn if less than 1MB per job
                if [ "$bytes_per_job" -lt 1048576 ]; then
                    print_warning "Configuration issue: ${num_jobs} jobs with ${test_size} test size"
                    print_warning "  → Each job gets only $((bytes_per_job / 1024))KB"
                    print_warning "  → This may cause shared memory errors"
                    print_warning "  → Consider using TEST_SIZE=$((num_jobs))M or larger"
                    warnings=$((warnings + 1))
                fi
                
                # Critical warning for very high job counts
                if [ "$num_jobs" -ge 32 ]; then
                    print_warning "High job count detected: ${num_jobs} jobs"
                    print_warning "  → May exceed system shared memory limits"
                    print_warning "  → Recommended: NUM_JOBS=16 or less for stability"
                    print_warning "  → If you must use ${num_jobs} jobs, ensure TEST_SIZE is at least $((num_jobs * 10))M"
                    warnings=$((warnings + 1))
                fi
            fi
        done
    done
    
    if [ "$warnings" -gt 0 ]; then
        print_warning "Found $warnings potential configuration issues"
        print_status "Tests may fail with shared memory errors"
        return 1  # Return non-zero to indicate warnings
    else
        print_success "Test configuration validated successfully"
        return 0
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
    print_status "Validating upload credentials for user '$USERNAME'"

    # Test upload endpoint for upload-only users
    local upload_response
    upload_response=$(curl -s -w "%{http_code}" -u "$USERNAME:$PASSWORD" \
        --connect-timeout 10 --max-time 30 \
        -X GET "$BACKEND_URL/api/import" 2>/dev/null)

    local upload_http_code="${upload_response: -3}"

    case "$upload_http_code" in
        405)
            # Method Not Allowed is expected for GET on /api/import (it only accepts POST)
            print_success "Credentials validated successfully"
            print_status "User '$USERNAME' has upload access"
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
                    print_status "User '$USERNAME' has upload access"
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
    local num_jobs=$4
    local direct=$5
    local test_size=$6
    local sync=$7
    local iodepth=$8
    local runtime=$9

    print_status "Running FIO test: ${pattern} with ${block_size} block size, ${num_jobs} jobs"
    
    # Capture stderr to detect specific errors
    local error_file="/tmp/fio_error_$$_$(date +%s).txt"
    
    fio --name="hostname:${HOSTNAME},protocol:${PROTOCOL},drivetype:${DRIVE_TYPE},drivemodel:${DRIVE_MODEL}" \
        --description="${DESCRIPTION}" \
        --rw="$pattern" \
        --bs="$block_size" \
        --size="$test_size" \
        --numjobs="$num_jobs" \
        --runtime="$runtime" \
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
        --thread 2>"$error_file"
    
    local fio_exit_code=$?
    
    # Clean up test file
    rm -f "${TARGET_DIR}/fio_test_${pattern}_${block_size}" 2>/dev/null || true

    if [ $fio_exit_code -eq 0 ]; then
        print_success "FIO test completed: ${pattern} with ${block_size}, ${num_jobs} jobs"
        rm -f "$error_file"
        return 0
    else
        print_error "FIO test failed: ${pattern} with ${block_size}, ${num_jobs} jobs"
        
        # Check for specific error patterns and provide helpful messages
        if grep -q "failed to setup shm segment" "$error_file" 2>/dev/null; then
            print_error "  → Shared memory error detected. This usually means:"
            print_error "    • Too many jobs (${num_jobs}) for available shared memory"
            print_error "    • Test size too small (${test_size}) for ${num_jobs} jobs"
            print_warning "  → Suggestions:"
            print_warning "    • Reduce number of jobs (try NUM_JOBS=8 or less)"
            print_warning "    • Increase test size (try TEST_SIZE=100M or more)"
            print_warning "    • Check system shared memory limits: sysctl kern.sysv.shmmax"
        elif grep -q "No space left on device" "$error_file" 2>/dev/null; then
            print_error "  → Disk full error detected"
            print_warning "  → Check available space in ${TARGET_DIR}"
        elif grep -q "Permission denied" "$error_file" 2>/dev/null; then
            print_error "  → Permission error detected"
            print_warning "  → Check permissions for ${TARGET_DIR}"
        elif grep -q "file not found" "$error_file" 2>/dev/null; then
            print_error "  → File not found error"
            print_warning "  → Ensure ${TARGET_DIR} exists and is writable"
        else
            # Show the actual error if we don't recognize it
            print_error "  → FIO error output:"
            cat "$error_file" | head -5 | while IFS= read -r line; do
                print_error "    $line"
            done
        fi
        
        rm -f "$error_file"
        return 1
    fi
}

# Function to extract IOPS from FIO JSON output
extract_iops() {
    local json_file=$1
    
    # Try using jq if available (most reliable)
    if command -v jq &> /dev/null; then
        local read_iops=$(jq -r '.jobs[0].read.iops // 0' "$json_file" 2>/dev/null || echo "0")
        local write_iops=$(jq -r '.jobs[0].write.iops // 0' "$json_file" 2>/dev/null || echo "0")
        
        # Calculate total IOPS (use awk if bc not available)
        local total_iops="0"
        if command -v bc &> /dev/null; then
            total_iops=$(echo "$read_iops + $write_iops" | bc 2>/dev/null || echo "0")
        else
            total_iops=$(awk "BEGIN {printf \"%.0f\", $read_iops + $write_iops}" 2>/dev/null || echo "0")
        fi
        
        # Format IOPS values (remove decimals if whole number)
        read_iops=$(printf "%.0f" "$read_iops" 2>/dev/null || echo "$read_iops")
        write_iops=$(printf "%.0f" "$write_iops" 2>/dev/null || echo "$write_iops")
        total_iops=$(printf "%.0f" "$total_iops" 2>/dev/null || echo "$total_iops")
        
        echo "$read_iops|$write_iops|$total_iops"
        return 0
    fi
    
    # Fallback: use grep/awk to extract IOPS (less reliable but works without jq)
    local read_iops=$(grep -o '"iops"[[:space:]]*:[[:space:]]*[0-9.]*' "$json_file" 2>/dev/null | head -1 | grep -o '[0-9.]*' || echo "0")
    local write_iops=$(grep -o '"iops"[[:space:]]*:[[:space:]]*[0-9.]*' "$json_file" 2>/dev/null | tail -1 | grep -o '[0-9.]*' || echo "0")
    
    # Simple addition without bc
    local total_iops="0"
    if [ -n "$read_iops" ] && [ -n "$write_iops" ]; then
        total_iops=$(awk "BEGIN {printf \"%.0f\", $read_iops + $write_iops}" 2>/dev/null || echo "0")
    fi
    
    read_iops=$(printf "%.0f" "$read_iops" 2>/dev/null || echo "$read_iops")
    write_iops=$(printf "%.0f" "$write_iops" 2>/dev/null || echo "$write_iops")
    
    echo "$read_iops|$write_iops|$total_iops"
}

# Function to display IOPS information
display_iops() {
    local json_file=$1
    local test_name=$2
    
    local iops_data=$(extract_iops "$json_file")
    if [ -z "$iops_data" ] || [ "$iops_data" = "0|0|0" ]; then
        return 0  # Skip if no IOPS data available
    fi
    
    IFS='|' read -r read_iops write_iops total_iops <<< "$iops_data"
    
    # Display IOPS information
    echo -e "  └─ ${YELLOW}IOPS${NC}: Read=${read_iops}, Write=${write_iops}, Total=${total_iops}"
}

# Function to upload results to backend
upload_results() {
    local json_file=$1
    local test_name=$2
    
    print_status "Uploading results: $test_name"
    print_status "         Hostname: $HOSTNAME"
    print_status "      Description: $DESCRIPTION"
    print_status "         Run UUID: $RUN_UUID"
    print_status "      config_uuid: $CONFIG_UUID"
    
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
        -F "config_uuid=$CONFIG_UUID" \
        -F "run_uuid=$RUN_UUID" \
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

# Function to get maximum value from an array
get_max_value() {
    local max=0
    for val in "$@"; do
        # Skip empty values
        if [ -z "$val" ]; then
            continue
        fi
        # Remove quotes and whitespace
        val="${val#"${val%%[![:space:]]*}"}"
        val="${val%"${val##*[![:space:]]}"}"
        val="${val#\"}"
        val="${val#\'}"
        val="${val%\"}"
        val="${val%\'}"
        # Validate that value is numeric before comparison
        if [[ "$val" =~ ^[0-9]+$ ]]; then
            if [ "$val" -gt "$max" ]; then
                max=$val
            fi
        fi
    done
    echo "$max"
}

# Function to display configuration
show_config() {
    local max_runtime=$(get_max_value "${RUNTIME[@]}")
    echo "========================================="
    echo "FIO Performance Test Configuration"
    echo "========================================="
    echo "Hostname:     $HOSTNAME"
    echo "Protocol:     $PROTOCOL"
    echo "Description:  $DESCRIPTION"
    echo "Drive Model:  $DRIVE_MODEL"
    echo "Drive Type:   $DRIVE_TYPE"
    echo "Config UUID:  $CONFIG_UUID"
    echo "Run UUID:     $RUN_UUID"
    echo "Test Size:    $TEST_SIZE"
    echo "Num Jobs:     $NUM_JOBS"
    echo "Runtime:      ${RUNTIME[*]} (max: ${max_runtime}s)"
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
    local total_tests=$((${#BLOCK_SIZES[@]} * ${#TEST_PATTERNS[@]} * ${#NUM_JOBS[@]} * ${#DIRECT[@]} * ${#TEST_SIZE[@]} * ${#SYNC[@]} * ${#IODEPTH[@]} * ${#RUNTIME[@]}))
    local current_test=0
    local successful_uploads=0
    local failed_uploads=0
    local total_iops_sum=0
    local iops_count=0
    local last_iops=0
    
    print_status "Starting $total_tests FIO performance tests..."
    
    for block_size in "${BLOCK_SIZES[@]}"; do
            for num_jobs in "${NUM_JOBS[@]}"; do
        for pattern in "${TEST_PATTERNS[@]}"; do
                for direct in "${DIRECT[@]}"; do
                    for test_size in "${TEST_SIZE[@]}"; do
                        for sync in "${SYNC[@]}"; do
                            for iodepth in "${IODEPTH[@]}"; do
                                for runtime in "${RUNTIME[@]}"; do
                                    current_test=$((current_test + 1))
                                    print_status "Test $current_test/$total_tests: ${pattern} with ${block_size} ${num_jobs} ${direct} ${test_size} ${sync} ${iodepth} ${runtime}"

                                    output_file="/tmp/fio_results_${pattern}_${block_size}_${num_jobs}_${direct}_${test_size}_$(date +%s).json"

                                    if run_fio_test "$block_size" "$pattern" "$output_file" "$num_jobs" "$direct" "$test_size" "$sync" "$iodepth" "$runtime"; then
                                        # Display IOPS after successful test and collect for average
                                        if [ -f "$output_file" ]; then
                                            display_iops "$output_file" "${pattern}_${block_size}"
                                            
                                            # Extract and accumulate IOPS for average calculation
                                            local iops_data=$(extract_iops "$output_file")
                                            if [ -n "$iops_data" ] && [ "$iops_data" != "0|0|0" ]; then
                                                IFS='|' read -r read_iops write_iops total_iops <<< "$iops_data"
                                                if [ -n "$total_iops" ] && [ "$total_iops" != "0" ]; then
                                                    total_iops_sum=$(echo "$total_iops_sum + $total_iops" | bc 2>/dev/null || awk "BEGIN {printf \"%.0f\", $total_iops_sum + $total_iops}")
                                                    iops_count=$((iops_count + 1))
                                                    last_iops=$total_iops
                                                fi
                                            fi
                                        fi
                                        
                                        if upload_results "$output_file" "${pattern}_${block_size}_${num_jobs}_${direct}_${test_size}_${sync}_${iodepth}_${runtime}"; then
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
    done
    
    # Summary
    echo "========================================="
    echo "Test Summary"
    echo "========================================="
    echo "Total tests:      $total_tests"
    echo "Successful:       $successful_uploads"
    echo "Failed:           $failed_uploads"
    
    # Display IOPS statistics if available
    if [ $iops_count -gt 0 ]; then
        local avg_iops=0
        if command -v bc &> /dev/null; then
            avg_iops=$(echo "scale=0; $total_iops_sum / $iops_count" | bc)
        else
            avg_iops=$(awk "BEGIN {printf \"%.0f\", $total_iops_sum / $iops_count}")
        fi
        echo "----------------------------------------"
        echo -e "${YELLOW}IOPS${NC} Statistics:"
        echo -e "  Last test ${YELLOW}IOPS${NC}:  $last_iops"
        if [ $iops_count -gt 1 ]; then
            echo -e "  Average ${YELLOW}IOPS${NC}:    $avg_iops (from $iops_count tests)"
        fi
    fi
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
    
    # Parse command-line arguments
    local skip_confirmation=false
    local env_files=()
    local args=()
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -y|--yes)
                skip_confirmation=true
                shift
                ;;
            -e|--env-file)
                if [ -z "$2" ] || [[ "$2" =~ ^- ]]; then
                    print_error "Option $1 requires a file path"
                    exit 1
                fi
                env_files+=("$2")
                shift 2
                ;;
            *)
                args+=("$1")
                shift
                ;;
        esac
    done
    
    # Restore remaining arguments for potential future use
    set -- "${args[@]}"
    
    # Load configuration (supports multiple env files and INCLUDE directives)
    load_env_files "${env_files[@]}"
    set_defaults
    
    # Check prerequisites
    check_fio
    check_curl
    check_libaio
    
    # Show configuration
    show_config
    
    # Validate test configuration for potential issues
    validate_test_config
    local config_warnings=$?
    
    # Validate API connectivity and credentials (skip if --yes flag is used)
    if [ "$skip_confirmation" = false ]; then
        check_api_connectivity
        check_credentials
    else
        print_status "Skipping server connectivity checks due to --yes flag"
    fi
    
    # Confirm before starting tests (unless --yes flag is used)
    echo
    if [ "$config_warnings" -eq 0 ]; then
        print_status "All checks passed! Ready to start FIO performance testing."
    else
        print_warning "Configuration warnings detected! Tests may fail."
    fi
    
    local total_tests=$((${#BLOCK_SIZES[@]} * ${#TEST_PATTERNS[@]} * ${#NUM_JOBS[@]} * ${#DIRECT[@]} * ${#TEST_SIZE[@]} * ${#SYNC[@]} * ${#IODEPTH[@]} * ${#RUNTIME[@]}))
    print_status "  Block sizes: ${BLOCK_SIZES[*]}"
    print_status "  Direct: ${DIRECT[*]}"
    print_status "  Test size: ${TEST_SIZE[*]}"
    print_status "  Sync: ${SYNC[*]}"
    print_status "  I/O Depth: ${IODEPTH[*]}"
    print_status "  Runtime: ${RUNTIME[*]}"
    print_status "  Number of jobs: ${NUM_JOBS[*]}"
    local max_runtime=$(get_max_value "${RUNTIME[@]}")
    print_status "  Test patterns: ${TEST_PATTERNS[*]}"
    print_status "  Test duration: ${RUNTIME[*]} (max: ${max_runtime}s) per test"
    print_status "  Estimated total time: $((total_tests * max_runtime / 60)) minutes"
    echo
    print_status "This will run $total_tests tests with the listed configurations!"
    
    if [ "$config_warnings" -ne 0 ]; then
        echo
        print_warning "⚠️  Configuration issues detected - some tests may fail!"
        print_warning "   See warnings above for details and suggestions."
    fi
    echo
    
    if [ "$skip_confirmation" = false ]; then
        if [ "$config_warnings" -ne 0 ]; then
            read -p "Configuration warnings detected. Do you still want to proceed? (y/N): " -n 1 -r
        else
            read -p "Do you want to proceed? (y/N): " -n 1 -r
        fi
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

# Function to generate .env file
generate_env_file() {
    local env_file="${1:-.env}"
    local hostname_default
    hostname_default=$(hostname -s 2>/dev/null || echo "localhost")
    
    # Generate CONFIG_UUID from hostname
    local config_uuid
    if command -v uuidgen &> /dev/null; then
        config_uuid=$(uuidgen | tr '[:upper:]' '[:lower:]')
    else
        config_uuid=$(generate_uuid_from_hash "$hostname_default")
    fi
    
    # Check if file exists
    if [ -f "$env_file" ]; then
        print_warning ".env file already exists at $env_file"
        echo
        read -p "Do you want to overwrite it? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_warning "Generation cancelled. Existing .env file preserved."
            exit 0
        fi
        print_status "Overwriting existing .env file..."
    fi
    
    # Generate .env file content
    cat > "$env_file" << EOF
# FIO Performance Testing Configuration
# Generated on $(date -u +"%Y-%m-%d %H:%M:%S UTC")
# Edit this file to customize your test configuration

# INCLUDE directive to include other .env files
# INCLUDE=/path/to/base.env

# Host Configuration
# Hostname (default: current hostname)
# Use -vm if its a virtual machine
HOSTNAME="${hostname_default}"
# Protocol (unknown, NFS, iSCSI, Local, etc.)
PROTOCOL="local"
# Drive type (hdd, ssd, nvme, mirror, raidz1, raidz2, raidz3, etc.)
# If its a VM use "vm-hdd", "vm-ssd", "vm-nvme", "vm-mirror", "vm-raidz1", "vm-raidz2", "vm-raidz3", etc.
DRIVE_TYPE="unknown"
# Drive model (unknown, WD1003FZEX, WD1003FZEX, poolName, poolName-syncoff, poolName-syncall, etc.)
# If its a VM use the Drive model of the Hypervisor
# if there are special parameters of the drive model, use them in the format "drive-model-special-parameters"
DRIVE_MODEL="unknown"
CONFIG_UUID="${config_uuid}"

# Test Configuration
# Block sizes to test (comma-separated)
# 4k is very low ZFS uses a default of 128 KiB blocks
BLOCK_SIZES="4k,64k,128k,1M"

# Test patterns to run (comma-separated: read, write, randread, randwrite, rw, randrw)
TEST_PATTERNS="read,write,randread,randwrite,rw,randrw"

# Number of parallel jobs (comma-separated for multiple values)
NUM_JOBS="4"

# Direct I/O mode (1 = enabled, 0 = disabled, comma-separated for multiple values)
# it is the opposite of the buffered I/O mode
DIRECT="1"

# Test file size per job (comma-separated for multiple values)
# Examples: 10M, 100M, 1G
TEST_SIZE="10G"

# Sync mode (1 = enabled, 0 = disabled, comma-separated for multiple values)
SYNC="1"

# I/O Depth (comma-separated for multiple values)
IODEPTH="1"

# Test runtime in seconds (comma-separated for multiple values)
RUNTIME="60"
# Test directory default is "./fio_tmp/"
# TARGET_DIR=/mnt/pool/tests/
# DESCRIPTION="FIO-Performance-Test"

# Backend Configuration
BACKEND_URL=https://fio-analyzer.stylite-live.net
USERNAME=xxxxxxx
PASSWORD=xxxxxxx
EOF
    
    if [ $? -eq 0 ]; then
        print_success ".env file generated successfully at $env_file"
        print_status "Edit the file to customize your configuration before running tests."
    else
        print_error "Failed to generate .env file"
        exit 1
    fi
}

# Generate .env file if requested
if [ "$1" = "-g" ] || [ "$1" = "--generate-env" ]; then
    # Check if a filename was provided as second argument
    env_filename=".env"
    if [ -n "$2" ] && [[ ! "$2" =~ ^- ]]; then
        env_filename="$2"
    fi
    generate_env_file "$env_filename"
    exit 0
fi

# Generate UUID if requested
if [ "$1" = "-u" ] || [ "$1" = "--uuid" ]; then
    if command -v uuidgen &> /dev/null; then
        uuidgen | tr '[:upper:]' '[:lower:]'
    else
        # Fallback: Generate random UUID4 using /dev/urandom
        # Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
        # where x is any hexadecimal digit and y is one of 8, 9, a, or b
        uuid_hex=$(od -An -N16 -tx1 /dev/urandom 2>/dev/null | tr -d ' \n' || echo "")
        
        if [ -z "$uuid_hex" ] || [ ${#uuid_hex} -lt 32 ]; then
            # Alternative method if od fails
            uuid_hex=$(hexdump -n 16 -e '4/4 "%08x"' /dev/urandom 2>/dev/null || echo "")
        fi
        
        if [ -n "$uuid_hex" ] && [ ${#uuid_hex} -ge 32 ]; then
            # Format as UUID and set version (4) and variant bits
            variant_byte=$(od -An -N1 -tu1 /dev/urandom 2>/dev/null | tr -d ' ' || echo "8")
            variant=$((8 + (variant_byte % 4)))
            uuid="${uuid_hex:0:8}-${uuid_hex:8:4}-4${uuid_hex:13:3}-${variant}${uuid_hex:17:3}-${uuid_hex:20:12}"
            echo "$uuid"
        else
            # Last resort: use date-based hash
            generate_uuid_from_hash "$(date +%s.%N)$RANDOM"
        fi
    fi
    exit 0
fi

# Show help if requested
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    cat << EOF
FIO Performance Testing Script

Usage: $0 [options]

Options:
  -h, --help         Show this help message
  -y, --yes          Skip confirmation prompt and start tests automatically
  -u, --uuid         Generate and output a random UUID
  -g, --generate-env Generate a ready-to-use .env configuration file
                     Optional: specify filename (default: .env)
                     Example: $0 --generate-env base.env
  -e, --env-file     Specify a custom .env file path (can be used multiple times)
                     Files are loaded in order, with later files overriding earlier ones.
                     Default: .env if no -e options are specified.

Configuration:
  The script loads configuration from a .env file in the current directory.
  Generate a .env file using: $0 --generate-env [filename]
                     Examples: $0 --generate-env
                              $0 --generate-env base.env
                              $0 -g production.env
  Or copy .env.example to .env and customize the values.
  
  Multiple .env files can be specified:
    $0 -e base.env -e overrides.env
  
  .env files can include other .env files using the INCLUDE directive:
    INCLUDE=/path/to/base.env
    INCLUDE="relative/path/to/shared.env"
  
  Later files and variables override earlier ones.
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
  DESCRIPTION    - Test description (default: "FIO-Performance-Test")
  DRIVE_MODEL    - Drive model (default: unknown)
  DRIVE_TYPE     - Drive type (default: unknown)
  TEST_SIZE      - Size of test file (default: 10M)
  NUM_JOBS       - Number of parallel jobs (default: 4)
  RUNTIME        - Test runtime in seconds (default: 30)
  DIRECT         - Direct I/O mode (default: 1)
  BACKEND_URL    - Backend API URL (default: http://localhost:8000)
  TARGET_DIR     - Directory for test files (default: ./tmp/fio_test)
  USERNAME       - Authentication username (default: admin)
  PASSWORD       - Authentication password (default: admin)
  BLOCK_SIZES    - Comma-separated block sizes (default: 4k,64k,1M)
  TEST_PATTERNS  - Comma-separated test patterns (default: read,write,randread,randwrite)
  NUM_JOBS       - Number of parallel jobs (default: 4)
  DIRECT         - Direct I/O mode (default: 1)
  TEST_SIZE      - Size of test file (default: 10M)
  SYNC           - Sync mode (default: 1)
  IODEPTH        - I/O Depth (default: 1)
  RUNTIME        - Test runtime in seconds (default: 30)

Examples:
  # Generate configuration file (default: .env)
  $0 --generate-env
  # Or generate a named file
  $0 --generate-env base.env
  $0 -g production.env
  # Edit the file with your settings, then:
  $0 -e base.env
  
  # Or use the old method:
  cp .env.example .env
  # Edit .env with your settings, then:
  $0
  
  # Use a custom .env file
  $0 --env-file /path/to/custom.env
  $0 -e ./configs/production.env
  
  # Use multiple .env files (later files override earlier ones)
  $0 -e base.env -e overrides.env
  $0 -e shared.env -e server1.env -e server1-overrides.env
  
  # Use INCLUDE directive in .env file:
  # In your .env file, add:
  # INCLUDE=/path/to/base.env
  # HOSTNAME=server1
  # TEST_SIZE=10G
  
  # Override with environment variables
  HOSTNAME="web01" PROTOCOL="iSCSI" DESCRIPTION="Production test" DRIVE_MODEL="WD1003FZEX" DRIVE_TYPE="HDD" $0
  
  # Large test with custom patterns
  TEST_SIZE="10G" RUNTIME="300" DIRECT="1" NUM_JOBS="8" TEST_PATTERNS="read,write" $0

EOF
    exit 0
fi

# Run main function
main "$@"
