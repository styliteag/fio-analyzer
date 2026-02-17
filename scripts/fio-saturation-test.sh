#!/usr/bin/env bash

# FIO Saturation Test Script
# Finds maximum IOPS while keeping P95 completion latency < threshold (default: 100ms)
# Tests randread and randwrite separately with increasing queue depth
# Uploads results to FIO Analyzer backend for visualization as saturation curves

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

print_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

# Function to load .env file with support for INCLUDE directive
load_env() {
    local env_file="${1:-.env}"
    local processed_files="${2:-}"
    local base_dir

    if [ -f "$env_file" ]; then
        base_dir=$(dirname "$(readlink -f "$env_file" 2>/dev/null || echo "$env_file")")
    else
        base_dir="$(pwd)"
    fi

    local abs_path
    if [ -f "$env_file" ]; then
        abs_path=$(readlink -f "$env_file" 2>/dev/null || realpath "$env_file" 2>/dev/null || echo "$env_file")
    else
        abs_path="$env_file"
    fi

    if echo "$processed_files" | grep -q ":$abs_path:"; then
        print_error "Circular include detected: $env_file"
        return 1
    fi

    processed_files="${processed_files}:${abs_path}:"

    if [ -f "$env_file" ]; then
        print_status "Loading configuration from $env_file"

        set -a
        # Process INCLUDE directives first
        while IFS= read -r line || [ -n "$line" ]; do
            if [[ "$line" =~ ^[[:space:]]*# ]] || [[ -z "${line// }" ]]; then
                continue
            fi
            if [[ "$line" =~ ^[[:space:]]*[Ii][Nn][Cc][Ll][Uu][Dd][Ee][[:space:]]*=[[:space:]]*(.+)$ ]]; then
                local include_file="${BASH_REMATCH[1]}"
                include_file="${include_file#\"}"
                include_file="${include_file#\'}"
                include_file="${include_file%\"}"
                include_file="${include_file%\'}"
                include_file="${include_file#"${include_file%%[![:space:]]*}"}"
                include_file="${include_file%"${include_file##*[![:space:]]}"}"
                if [[ "$include_file" != /* ]]; then
                    include_file="$base_dir/$include_file"
                fi
                if [ -f "$include_file" ]; then
                    load_env "$include_file" "$processed_files"
                else
                    print_warning "INCLUDE file not found: $include_file (referenced from $env_file)"
                fi
            fi
        done < "$env_file"

        # Process regular variables (second pass)
        while IFS= read -r line || [ -n "$line" ]; do
            if [[ "$line" =~ ^[[:space:]]*# ]] || [[ -z "${line// }" ]] || [[ "$line" =~ ^[[:space:]]*[Ii][Nn][Cc][Ll][Uu][Dd][Ee][[:space:]]*= ]]; then
                continue
            fi
            if [[ "$line" =~ ^[[:space:]]*([^=]+)=(.*)$ ]]; then
                local key="${BASH_REMATCH[1]}"
                local value="${BASH_REMATCH[2]}"
                key="${key#"${key%%[![:space:]]*}"}"
                key="${key%"${key##*[![:space:]]}"}"
                value="${value#"${value%%[![:space:]]*}"}"
                value="${value%"${value##*[![:space:]]}"}"
                value="${value#\"}"
                value="${value#\'}"
                value="${value%\"}"
                value="${value%\'}"
                export "$key=$value"
            fi
        done < "$env_file"
        set +a
    else
        print_status "No .env file found at $env_file, using defaults and environment variables"
    fi
}

# Function to load multiple .env files
load_env_files() {
    local env_files=("$@")
    if [ ${#env_files[@]} -eq 0 ]; then
        load_env ".env"
    else
        for env_file in "${env_files[@]}"; do
            load_env "$env_file"
        done
    fi
}

# Function to generate UUID from hash
generate_uuid_from_hash() {
    local input_string="$1"
    local hash=$(echo -n "$input_string" | sha256sum | awk '{print $1}')
    local uuid="${hash:0:8}-${hash:8:4}-5${hash:13:3}-${hash:16:1}${hash:17:3}-${hash:20:12}"
    echo "$uuid"
}

# Configuration Variables with defaults
set_defaults() {
    HOSTNAME="${HOSTNAME:-$(hostname -s)}"
    PROTOCOL="${PROTOCOL:-unknown}"
    DRIVE_TYPE="${DRIVE_TYPE:-unknown}"
    DRIVE_MODEL="${DRIVE_MODEL:-unknown}"
    BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
    TARGET_DIR="${TARGET_DIR:-./fio_tmp/}"
    USERNAME="${USERNAME:-uploader}"
    PASSWORD="${PASSWORD:-uploader}"

    # Saturation test specific defaults
    BLOCK_SIZE="${BLOCK_SIZE:-4k}"
    DIRECT="${DIRECT:-1}"
    RUNTIME="${RUNTIME:-60}"
    TEST_SIZE="${TEST_SIZE:-20G}"
    LATENCY_THRESHOLD_MS="${LATENCY_THRESHOLD_MS:-100}"
    INITIAL_IODEPTH="${INITIAL_IODEPTH:-16}"
    INITIAL_NUMJOBS="${INITIAL_NUMJOBS:-4}"
    MAX_STEPS="${MAX_STEPS:-20}"
    SYNC="${SYNC:-1}"

    # UUID Generation
    if [ -n "$CONFIG_UUID" ]; then
        print_status "Using CONFIG_UUID from .env: $CONFIG_UUID"
    else
        CONFIG_UUID=$(generate_uuid_from_hash "$HOSTNAME")
        print_status "Generated CONFIG_UUID from hostname: $CONFIG_UUID"
    fi

    # run_uuid: Unique per script run
    if command -v uuidgen &> /dev/null; then
        RUN_UUID=$(uuidgen | tr '[:upper:]' '[:lower:]')
    else
        current_date=$(date -u +%Y-%m-%d)
        RUN_UUID=$(generate_uuid_from_hash "${HOSTNAME}_saturation_${current_date}")
    fi
    print_status "Generated RUN_UUID for this saturation run: $RUN_UUID"

    # Description with saturation-test prefix for frontend detection
    DESCRIPTION="saturation-test,hostname:${HOSTNAME},protocol:${PROTOCOL},drivetype:${DRIVE_TYPE},drivemodel:${DRIVE_MODEL},config_uuid:${CONFIG_UUID},run_uuid:${RUN_UUID},date:$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    DESCRIPTION=$(echo "$DESCRIPTION" | sed 's/ /_/g' | sed 's/[^-a-zA-Z0-9_,;:]//g')
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

# Function to check if jq is installed
check_jq() {
    if ! command -v jq &> /dev/null; then
        print_error "jq is not installed. Please install jq first."
        print_error "jq is required for extracting P95 latency from FIO JSON output."
        exit 1
    fi
}

# Function to test if a specific I/O engine is available
test_ioengine() {
    local engine=$1
    local test_output
    test_output=$(fio --name=test --ioengine="$engine" --rw=read --bs=4k --size=1M --filename=/dev/null --runtime=1 --time_based 2>&1)
    if echo "$test_output" | grep -q "engine.*not loadable\|engine.*not available\|unknown ioengine"; then
        return 1
    else
        return 0
    fi
}

# Function to detect the best available I/O engine
detect_ioengine() {
    if [ -n "$IOENGINE" ]; then
        print_status "Testing specified I/O engine: $IOENGINE"
        if test_ioengine "$IOENGINE"; then
            print_success "I/O engine '$IOENGINE' is available"
            return 0
        else
            print_error "Specified I/O engine '$IOENGINE' is not available"
            exit 1
        fi
    fi

    print_status "Auto-detecting best available I/O engine..."
    if test_ioengine "io_uring"; then
        IOENGINE="io_uring"
        print_success "io_uring engine is available - using for best performance"
    elif test_ioengine "libaio"; then
        IOENGINE="libaio"
        print_success "libaio engine is available - using for good async I/O"
    else
        IOENGINE="psync"
        print_warning "No async I/O engines available - falling back to psync"
        print_warning "psync limits iodepth to 1 - saturation test results may be limited"
    fi
}

# Function to check API connectivity
check_api_connectivity() {
    print_status "Checking API connectivity to $BACKEND_URL"
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 30 "$BACKEND_URL/api/test-runs" 2>/dev/null)
    local curl_exit_code=$?
    if [ $curl_exit_code -ne 0 ]; then
        print_error "Cannot connect to API server at $BACKEND_URL"
        exit 1
    fi
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
    local upload_response
    upload_response=$(curl -s -w "%{http_code}" -u "$USERNAME:$PASSWORD" \
        --connect-timeout 10 --max-time 30 \
        -X GET "$BACKEND_URL/api/import" 2>/dev/null)
    local upload_http_code="${upload_response: -3}"

    case "$upload_http_code" in
        405|200)
            print_success "Credentials validated successfully"
            ;;
        404)
            local post_response
            post_response=$(curl -s -w "%{http_code}" -u "$USERNAME:$PASSWORD" \
                --connect-timeout 10 --max-time 30 \
                -X POST "$BACKEND_URL/api/import" 2>/dev/null)
            local post_http_code="${post_response: -3}"
            case "$post_http_code" in
                400) print_success "Credentials validated successfully" ;;
                401) print_error "Authentication failed: Invalid username or password"; exit 1 ;;
                403) print_error "Access denied: User '$USERNAME' does not have upload permissions"; exit 1 ;;
                *) print_error "Cannot validate upload permissions (HTTP $post_http_code)"; exit 1 ;;
            esac
            ;;
        401) print_error "Authentication failed: Invalid username or password"; exit 1 ;;
        403) print_error "Access denied: User '$USERNAME' does not have upload permissions"; exit 1 ;;
        *) print_error "Cannot validate upload permissions (HTTP $upload_http_code)"; exit 1 ;;
    esac
}

# Function to check if target is a block device
is_block_device() {
    [ -b "$1" ]
}

# Function to check if a device is mounted
is_device_mounted() {
    local device="$1"
    local resolved_device
    resolved_device=$(readlink -f "$device" 2>/dev/null || echo "$device")
    if mount | grep -q "^${resolved_device}"; then
        return 0
    fi
    if [ -f /proc/mounts ] && grep -q "^${resolved_device}" /proc/mounts; then
        return 0
    fi
    return 1
}

# Function to setup target (directory or device)
setup_target_dir() {
    if is_block_device "$TARGET_DIR"; then
        print_status "TARGET_DIR is a block device: $TARGET_DIR"
        if is_device_mounted "$TARGET_DIR"; then
            print_error "Device $TARGET_DIR is mounted! Cannot run fio on a mounted device."
            exit 1
        fi
        echo
        print_warning "WARNING: Running fio directly on a block device!"
        print_warning "   Device: $TARGET_DIR"
        print_warning "   This will DESTROY ALL DATA on the device!"
        echo
        TARGET_IS_DEVICE=true
        if [ ! -r "$TARGET_DIR" ] || [ ! -w "$TARGET_DIR" ]; then
            print_error "Cannot read/write to device $TARGET_DIR (need root?)"
            exit 1
        fi
        print_success "Device $TARGET_DIR is accessible and not mounted"
    else
        TARGET_IS_DEVICE=false
        if [ ! -d "$TARGET_DIR" ]; then
            print_status "Creating target directory: $TARGET_DIR"
            mkdir -p "$TARGET_DIR" || {
                print_error "Failed to create target directory: $TARGET_DIR"
                exit 1
            }
        fi
    fi
}

# Function to run a single FIO test step
run_fio_step() {
    local pattern=$1
    local iodepth=$2
    local num_jobs=$3
    local output_file=$4

    local total_qd=$((iodepth * num_jobs))
    print_step "Running ${pattern} | iodepth=${iodepth} numjobs=${num_jobs} (Total QD: ${total_qd})"

    local error_file="/tmp/fio_sat_error_$$_$(date +%s).txt"

    local fio_filename
    if [ "$TARGET_IS_DEVICE" = true ]; then
        fio_filename="$TARGET_DIR"
    else
        fio_filename="${TARGET_DIR}/fio_saturation_${pattern}_${iodepth}_${num_jobs}"
    fi

    fio --name="hostname:${HOSTNAME},protocol:${PROTOCOL},drivetype:${DRIVE_TYPE},drivemodel:${DRIVE_MODEL}" \
        --description="${DESCRIPTION}" \
        --rw="$pattern" \
        --bs="$BLOCK_SIZE" \
        --size="$TEST_SIZE" \
        --numjobs="$num_jobs" \
        --runtime="$RUNTIME" \
        --time_based \
        --group_reporting \
        --iodepth="$iodepth" \
        --direct="$DIRECT" \
        --sync="$SYNC" \
        --filename="$fio_filename" \
        --output-format=json \
        --output="$output_file" \
        --ioengine="$IOENGINE" \
        --norandommap \
        --randrepeat=0 \
        --thread 2>"$error_file"

    local fio_exit_code=$?

    # Clean up test file (only for directory mode)
    if [ "$TARGET_IS_DEVICE" != true ]; then
        rm -f "${TARGET_DIR}/fio_saturation_${pattern}_${iodepth}_${num_jobs}" 2>/dev/null || true
    fi

    if [ $fio_exit_code -eq 0 ]; then
        rm -f "$error_file"
        return 0
    else
        print_error "FIO test failed for ${pattern} iodepth=${iodepth} numjobs=${num_jobs}"
        if [ -f "$error_file" ]; then
            head -5 "$error_file" | while IFS= read -r line; do
                print_error "    $line"
            done
            rm -f "$error_file"
        fi
        return 1
    fi
}

# Function to extract P95 completion latency from FIO JSON (ns -> ms)
extract_p95_clat_ms() {
    local json_file=$1
    local pattern=$2

    local p95_ns
    if [ "$pattern" = "randread" ] || [ "$pattern" = "read" ]; then
        p95_ns=$(jq -r '.jobs[0].read.clat_ns.percentile["95.000000"] // 0' "$json_file" 2>/dev/null)
    else
        p95_ns=$(jq -r '.jobs[0].write.clat_ns.percentile["95.000000"] // 0' "$json_file" 2>/dev/null)
    fi

    if [ -z "$p95_ns" ] || [ "$p95_ns" = "null" ] || [ "$p95_ns" = "0" ]; then
        echo "0"
        return 1
    fi

    # Convert nanoseconds to milliseconds (with 2 decimal places)
    local p95_ms
    p95_ms=$(awk "BEGIN {printf \"%.2f\", $p95_ns / 1000000}")
    echo "$p95_ms"
    return 0
}

# Function to extract IOPS from FIO JSON
extract_iops_value() {
    local json_file=$1
    local pattern=$2

    local iops
    if [ "$pattern" = "randread" ] || [ "$pattern" = "read" ]; then
        iops=$(jq -r '.jobs[0].read.iops // 0' "$json_file" 2>/dev/null)
    else
        iops=$(jq -r '.jobs[0].write.iops // 0' "$json_file" 2>/dev/null)
    fi

    printf "%.0f" "$iops" 2>/dev/null || echo "0"
}

# Function to extract bandwidth from FIO JSON (KB/s -> MB/s)
extract_bw_mbs() {
    local json_file=$1
    local pattern=$2

    local bw_bytes
    if [ "$pattern" = "randread" ] || [ "$pattern" = "read" ]; then
        bw_bytes=$(jq -r '.jobs[0].read.bw_bytes // 0' "$json_file" 2>/dev/null)
    else
        bw_bytes=$(jq -r '.jobs[0].write.bw_bytes // 0' "$json_file" 2>/dev/null)
    fi

    awk "BEGIN {printf \"%.2f\", $bw_bytes / 1048576}" 2>/dev/null || echo "0"
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
        -F "config_uuid=$CONFIG_UUID" \
        -F "run_uuid=$RUN_UUID" \
        "$BACKEND_URL/api/import")

    http_code="${response: -3}"
    response_body="${response%???}"

    if [ "$http_code" -eq 200 ]; then
        print_success "Upload successful: $test_name"
        return 0
    else
        print_error "Upload failed: $test_name (HTTP $http_code)"
        echo "Response: $response_body"
        return 1
    fi
}

# Function to display configuration
show_config() {
    echo "========================================="
    echo "FIO Saturation Test Configuration"
    echo "========================================="
    echo "Hostname:          $HOSTNAME"
    echo "Protocol:          $PROTOCOL"
    echo "Drive Model:       $DRIVE_MODEL"
    echo "Drive Type:        $DRIVE_TYPE"
    echo "Config UUID:       $CONFIG_UUID"
    echo "Run UUID:          $RUN_UUID"
    echo "I/O Engine:        $IOENGINE"
    echo "-----------------------------------------"
    echo "Block Size:        $BLOCK_SIZE"
    echo "Direct I/O:        $DIRECT"
    echo "Sync:              $SYNC"
    echo "Test Size:         $TEST_SIZE"
    echo "Runtime/Step:      ${RUNTIME}s"
    echo "-----------------------------------------"
    echo "Initial IO Depth:  $INITIAL_IODEPTH"
    echo "Initial Num Jobs:  $INITIAL_NUMJOBS"
    echo "Initial Total QD:  $((INITIAL_IODEPTH * INITIAL_NUMJOBS))"
    echo "Max Steps:         $MAX_STEPS"
    echo "P95 Threshold:     ${LATENCY_THRESHOLD_MS}ms"
    echo "-----------------------------------------"
    echo "Backend URL:       $BACKEND_URL"
    echo "Username:          $USERNAME"
    if [ "$TARGET_IS_DEVICE" = true ]; then
        echo "Target:            $TARGET_DIR (BLOCK DEVICE)"
    else
        echo "Target Dir:        $TARGET_DIR"
    fi
    echo "========================================="
    echo
}

# Arrays to store results for summary table
declare -a RESULTS_STEP
declare -a RESULTS_IODEPTH
declare -a RESULTS_NUMJOBS
declare -a RESULTS_TOTALQD
declare -a RESULTS_RANDREAD_IOPS
declare -a RESULTS_RANDREAD_P95
declare -a RESULTS_RANDREAD_BW
declare -a RESULTS_RANDWRITE_IOPS
declare -a RESULTS_RANDWRITE_P95
declare -a RESULTS_RANDWRITE_BW

# Sweet spot tracking
RANDREAD_SWEET_SPOT_STEP=-1
RANDWRITE_SWEET_SPOT_STEP=-1
RANDREAD_SATURATION_STEP=-1
RANDWRITE_SATURATION_STEP=-1

# Main saturation loop
saturation_loop() {
    local iodepth=$INITIAL_IODEPTH
    local num_jobs=$INITIAL_NUMJOBS
    local step=0
    local double_target="iodepth"  # Start by doubling iodepth

    local randread_saturated=false
    local randwrite_saturated=false

    # Previous step values for sweet spot tracking
    local prev_randread_iops=0
    local prev_randwrite_iops=0

    echo
    print_status "Starting saturation test loop..."
    print_status "Patterns: randread, randwrite"
    print_status "Will stop each pattern when P95 clat > ${LATENCY_THRESHOLD_MS}ms"
    echo

    while [ $step -lt $MAX_STEPS ]; do
        local total_qd=$((iodepth * num_jobs))
        step=$((step + 1))

        echo
        echo "========================================="
        print_step "STEP $step: iodepth=$iodepth, numjobs=$num_jobs (Total QD: $total_qd)"
        echo "========================================="

        # Store step parameters
        RESULTS_STEP+=("$step")
        RESULTS_IODEPTH+=("$iodepth")
        RESULTS_NUMJOBS+=("$num_jobs")
        RESULTS_TOTALQD+=("$total_qd")

        # --- randread ---
        if [ "$randread_saturated" = false ]; then
            local output_file="/tmp/fio_sat_randread_step${step}_$$.json"
            if run_fio_step "randread" "$iodepth" "$num_jobs" "$output_file"; then
                local rr_iops=$(extract_iops_value "$output_file" "randread")
                local rr_p95=$(extract_p95_clat_ms "$output_file" "randread")
                local rr_bw=$(extract_bw_mbs "$output_file" "randread")

                RESULTS_RANDREAD_IOPS+=("$rr_iops")
                RESULTS_RANDREAD_P95+=("$rr_p95")
                RESULTS_RANDREAD_BW+=("$rr_bw")

                print_success "  randread: IOPS=${rr_iops}, P95=${rr_p95}ms, BW=${rr_bw}MB/s"

                # Upload results
                upload_results "$output_file" "saturation_randread_step${step}_qd${total_qd}"

                # Check if saturated
                local threshold_exceeded
                threshold_exceeded=$(awk "BEGIN {print ($rr_p95 > $LATENCY_THRESHOLD_MS) ? 1 : 0}")
                if [ "$threshold_exceeded" = "1" ]; then
                    print_warning "  randread SATURATED at step $step (P95: ${rr_p95}ms > ${LATENCY_THRESHOLD_MS}ms)"
                    randread_saturated=true
                    RANDREAD_SATURATION_STEP=$((step - 1))  # 0-indexed in arrays
                    if [ $step -gt 1 ]; then
                        RANDREAD_SWEET_SPOT_STEP=$((step - 2))  # Previous step (0-indexed)
                    else
                        RANDREAD_SWEET_SPOT_STEP=0
                    fi
                else
                    prev_randread_iops=$rr_iops
                fi
            else
                RESULTS_RANDREAD_IOPS+=("-")
                RESULTS_RANDREAD_P95+=("-")
                RESULTS_RANDREAD_BW+=("-")
                print_error "  randread test failed at step $step"
            fi
            rm -f "$output_file"
        else
            RESULTS_RANDREAD_IOPS+=("-")
            RESULTS_RANDREAD_P95+=("-")
            RESULTS_RANDREAD_BW+=("-")
            print_status "  randread: skipped (already saturated)"
        fi

        # --- randwrite ---
        if [ "$randwrite_saturated" = false ]; then
            local output_file="/tmp/fio_sat_randwrite_step${step}_$$.json"
            if run_fio_step "randwrite" "$iodepth" "$num_jobs" "$output_file"; then
                local rw_iops=$(extract_iops_value "$output_file" "randwrite")
                local rw_p95=$(extract_p95_clat_ms "$output_file" "randwrite")
                local rw_bw=$(extract_bw_mbs "$output_file" "randwrite")

                RESULTS_RANDWRITE_IOPS+=("$rw_iops")
                RESULTS_RANDWRITE_P95+=("$rw_p95")
                RESULTS_RANDWRITE_BW+=("$rw_bw")

                print_success "  randwrite: IOPS=${rw_iops}, P95=${rw_p95}ms, BW=${rw_bw}MB/s"

                # Upload results
                upload_results "$output_file" "saturation_randwrite_step${step}_qd${total_qd}"

                # Check if saturated
                local threshold_exceeded
                threshold_exceeded=$(awk "BEGIN {print ($rw_p95 > $LATENCY_THRESHOLD_MS) ? 1 : 0}")
                if [ "$threshold_exceeded" = "1" ]; then
                    print_warning "  randwrite SATURATED at step $step (P95: ${rw_p95}ms > ${LATENCY_THRESHOLD_MS}ms)"
                    randwrite_saturated=true
                    RANDWRITE_SATURATION_STEP=$((step - 1))  # 0-indexed
                    if [ $step -gt 1 ]; then
                        RANDWRITE_SWEET_SPOT_STEP=$((step - 2))  # Previous step (0-indexed)
                    else
                        RANDWRITE_SWEET_SPOT_STEP=0
                    fi
                else
                    prev_randwrite_iops=$rw_iops
                fi
            else
                RESULTS_RANDWRITE_IOPS+=("-")
                RESULTS_RANDWRITE_P95+=("-")
                RESULTS_RANDWRITE_BW+=("-")
                print_error "  randwrite test failed at step $step"
            fi
            rm -f "$output_file"
        else
            RESULTS_RANDWRITE_IOPS+=("-")
            RESULTS_RANDWRITE_P95+=("-")
            RESULTS_RANDWRITE_BW+=("-")
            print_status "  randwrite: skipped (already saturated)"
        fi

        # Check if both patterns are saturated
        if [ "$randread_saturated" = true ] && [ "$randwrite_saturated" = true ]; then
            echo
            print_success "Both patterns have reached saturation. Stopping."
            break
        fi

        # Alternate doubling: iodepth -> numjobs -> iodepth -> numjobs ...
        if [ "$double_target" = "iodepth" ]; then
            iodepth=$((iodepth * 2))
            double_target="numjobs"
        else
            num_jobs=$((num_jobs * 2))
            double_target="iodepth"
        fi
    done

    if [ $step -ge $MAX_STEPS ]; then
        print_warning "Reached maximum steps ($MAX_STEPS) without full saturation."
    fi

    # If a pattern never saturated, mark the last step as its sweet spot
    if [ "$randread_saturated" = false ] && [ ${#RESULTS_RANDREAD_IOPS[@]} -gt 0 ]; then
        RANDREAD_SWEET_SPOT_STEP=$((${#RESULTS_STEP[@]} - 1))
        print_status "randread did not saturate - last step is the best observed"
    fi
    if [ "$randwrite_saturated" = false ] && [ ${#RESULTS_RANDWRITE_IOPS[@]} -gt 0 ]; then
        RANDWRITE_SWEET_SPOT_STEP=$((${#RESULTS_STEP[@]} - 1))
        print_status "randwrite did not saturate - last step is the best observed"
    fi
}

# Function to print summary table
print_summary_table() {
    echo
    echo "========================================================================================================================="
    echo "                                         SATURATION TEST RESULTS"
    echo "========================================================================================================================="
    printf "%-6s | %-8s | %-8s | %-8s | %-12s %-10s %-10s | %-12s %-10s %-10s\n" \
        "Step" "IODepth" "NumJobs" "TotalQD" "RR IOPS" "RR P95ms" "RR BW" "RW IOPS" "RW P95ms" "RW BW"
    echo "-------------------------------------------------------------------------------------------------------------------------"

    local total_steps=${#RESULTS_STEP[@]}
    for ((i=0; i<total_steps; i++)); do
        local marker=""

        # Check for sweet spot / saturation markers
        local is_rr_sweet=false
        local is_rw_sweet=false
        local is_rr_sat=false
        local is_rw_sat=false

        if [ "$RANDREAD_SWEET_SPOT_STEP" -eq "$i" ] 2>/dev/null; then
            is_rr_sweet=true
        fi
        if [ "$RANDWRITE_SWEET_SPOT_STEP" -eq "$i" ] 2>/dev/null; then
            is_rw_sweet=true
        fi
        if [ "$RANDREAD_SATURATION_STEP" -eq "$i" ] 2>/dev/null; then
            is_rr_sat=true
        fi
        if [ "$RANDWRITE_SATURATION_STEP" -eq "$i" ] 2>/dev/null; then
            is_rw_sat=true
        fi

        # Build marker string
        if [ "$is_rr_sweet" = true ] || [ "$is_rw_sweet" = true ]; then
            marker="${GREEN}*SWEET*${NC}"
        fi
        if [ "$is_rr_sat" = true ] || [ "$is_rw_sat" = true ]; then
            marker="${RED}!SAT!${NC}"
        fi

        # Color the row
        local row_color=""
        if [ "$is_rr_sweet" = true ] || [ "$is_rw_sweet" = true ]; then
            row_color="${GREEN}"
        elif [ "$is_rr_sat" = true ] || [ "$is_rw_sat" = true ]; then
            row_color="${RED}"
        fi

        printf "${row_color}%-6s | %-8s | %-8s | %-8s | %-12s %-10s %-10s | %-12s %-10s %-10s${NC} %s\n" \
            "${RESULTS_STEP[$i]}" \
            "${RESULTS_IODEPTH[$i]}" \
            "${RESULTS_NUMJOBS[$i]}" \
            "${RESULTS_TOTALQD[$i]}" \
            "${RESULTS_RANDREAD_IOPS[$i]}" \
            "${RESULTS_RANDREAD_P95[$i]}" \
            "${RESULTS_RANDREAD_BW[$i]}" \
            "${RESULTS_RANDWRITE_IOPS[$i]}" \
            "${RESULTS_RANDWRITE_P95[$i]}" \
            "${RESULTS_RANDWRITE_BW[$i]}" \
            "$marker"
    done

    echo "========================================================================================================================="
    echo
    echo "Legend: ${GREEN}*SWEET*${NC} = Sweet Spot (best performance within SLA)  ${RED}!SAT!${NC} = Saturation Point (P95 > ${LATENCY_THRESHOLD_MS}ms)"
    echo

    # Print sweet spot summary
    echo "--- Sweet Spot Summary ---"
    if [ "$RANDREAD_SWEET_SPOT_STEP" -ge 0 ] 2>/dev/null; then
        local idx=$RANDREAD_SWEET_SPOT_STEP
        echo -e "${GREEN}randread:  Step ${RESULTS_STEP[$idx]} | QD=${RESULTS_TOTALQD[$idx]} (iodepth=${RESULTS_IODEPTH[$idx]} x numjobs=${RESULTS_NUMJOBS[$idx]}) | IOPS=${RESULTS_RANDREAD_IOPS[$idx]} | P95=${RESULTS_RANDREAD_P95[$idx]}ms${NC}"
    else
        echo "randread:  No sweet spot found"
    fi
    if [ "$RANDWRITE_SWEET_SPOT_STEP" -ge 0 ] 2>/dev/null; then
        local idx=$RANDWRITE_SWEET_SPOT_STEP
        echo -e "${GREEN}randwrite: Step ${RESULTS_STEP[$idx]} | QD=${RESULTS_TOTALQD[$idx]} (iodepth=${RESULTS_IODEPTH[$idx]} x numjobs=${RESULTS_NUMJOBS[$idx]}) | IOPS=${RESULTS_RANDWRITE_IOPS[$idx]} | P95=${RESULTS_RANDWRITE_P95[$idx]}ms${NC}"
    else
        echo "randwrite: No sweet spot found"
    fi
    echo
}

# Function to cleanup
cleanup() {
    print_status "Cleaning up..."
    if [ "$TARGET_IS_DEVICE" != true ]; then
        rm -f "${TARGET_DIR}/fio_saturation_"* 2>/dev/null || true
    fi
    rm -f /tmp/fio_sat_*.json 2>/dev/null || true
}

# Generate .env file
generate_env_file() {
    local env_file="${1:-.env}"
    local hostname_default
    hostname_default=$(hostname -s 2>/dev/null || echo "localhost")

    local config_uuid
    if command -v uuidgen &> /dev/null; then
        config_uuid=$(uuidgen | tr '[:upper:]' '[:lower:]')
    else
        config_uuid=$(generate_uuid_from_hash "$hostname_default")
    fi

    if [ -f "$env_file" ]; then
        print_warning ".env file already exists at $env_file"
        echo
        read -p "Do you want to overwrite it? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_warning "Generation cancelled. Existing .env file preserved."
            exit 0
        fi
    fi

    cat > "$env_file" << EOF
# FIO Saturation Test Configuration
# Generated on $(date -u +"%Y-%m-%d %H:%M:%S UTC")
#
# This script finds the maximum IOPS while keeping P95 completion latency
# below a configurable threshold (default: 100ms).
# It systematically increases iodepth and numjobs until saturation is reached.

# INCLUDE directive to include other .env files
# INCLUDE=/path/to/base.env

# Host Configuration (hierarchical: Host-Protocol-Type-Model)
HOSTNAME="${hostname_default}"
PROTOCOL="local"
DRIVE_TYPE="unknown"
DRIVE_MODEL="unknown"
CONFIG_UUID="${config_uuid}"

# Fixed Test Parameters
BLOCK_SIZE=4k                  # Block size for saturation test
DIRECT=1                       # Always direct I/O (1=direct, 0=buffered)
SYNC=1                         # Sync mode
RUNTIME=60                     # Seconds per test step
TEST_SIZE=20G                  # Must be larger than cache

# Saturation Parameters
LATENCY_THRESHOLD_MS=100       # P95 completion latency threshold (ms)
INITIAL_IODEPTH=16             # Starting iodepth
INITIAL_NUMJOBS=4              # Starting number of jobs
MAX_STEPS=20                   # Safety limit for maximum steps

# I/O Engine (leave empty for auto-detection: io_uring > libaio > psync)
# IOENGINE=

# Target directory or block device
# TARGET_DIR=/mnt/pool/tests/
# TARGET_DIR=/dev/sdb           # DESTRUCTIVE: tests directly on block device

# Backend Configuration
BACKEND_URL=https://fio-analyzer.stylite-live.net
USERNAME=xxxxxxx
PASSWORD=xxxxxxx
EOF

    if [ $? -eq 0 ]; then
        print_success ".env file generated successfully at $env_file"
        print_status "Edit the file to customize your configuration before running the test."
    else
        print_error "Failed to generate .env file"
        exit 1
    fi
}

# Show help
show_help() {
    cat << EOF
FIO Saturation Test Script

Finds the maximum IOPS of a storage system while keeping P95 completion
latency below a configurable threshold. Tests randread and randwrite
separately with progressively increasing queue depth.

Algorithm:
  Start with iodepth=16, numjobs=4 (Total QD: 64)
  Alternately double iodepth and numjobs each step:
    Step 1: iodepth=16,  numjobs=4   (QD: 64)
    Step 2: iodepth=32,  numjobs=4   (QD: 128)
    Step 3: iodepth=32,  numjobs=8   (QD: 256)
    Step 4: iodepth=64,  numjobs=8   (QD: 512)
    ...until P95 clat > threshold

Usage: $0 [options]

Options:
  -h, --help              Show this help message
  -y, --yes               Skip confirmation prompt
  -g, --generate-env      Generate a .env configuration file
  -e, --env-file FILE     Specify custom .env file (can be used multiple times)
  -i, --engine ENGINE     Specify I/O engine (io_uring, libaio, psync)
  --threshold MS          P95 latency threshold in ms (default: 100)
  --block-size SIZE       Block size (default: 4k)
  --initial-iodepth N     Initial iodepth (default: 16)
  --initial-numjobs N     Initial numjobs (default: 4)

Configuration:
  Generate a .env file:  $0 --generate-env
  Edit the .env file with your settings, then run:  $0

Examples:
  # Generate and edit configuration
  $0 --generate-env
  vi .env
  $0

  # Quick test with lower threshold
  $0 --threshold 50 --yes

  # Start with higher queue depth
  $0 --initial-iodepth 32 --initial-numjobs 8

  # Use specific I/O engine
  $0 --engine libaio

  # Use custom .env file
  $0 -e /path/to/custom.env

EOF
}

# --- Main ---

main() {
    echo "FIO Saturation Test Script"
    echo "=========================="
    echo

    local skip_confirmation=false
    local env_files=()

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
            -i|--engine)
                if [ -z "$2" ] || [[ "$2" =~ ^- ]]; then
                    print_error "Option $1 requires an engine name"
                    exit 1
                fi
                IOENGINE="$2"
                shift 2
                ;;
            --threshold)
                if [ -z "$2" ] || [[ "$2" =~ ^- ]]; then
                    print_error "Option --threshold requires a value in ms"
                    exit 1
                fi
                LATENCY_THRESHOLD_MS="$2"
                shift 2
                ;;
            --block-size)
                if [ -z "$2" ] || [[ "$2" =~ ^- ]]; then
                    print_error "Option --block-size requires a size value"
                    exit 1
                fi
                BLOCK_SIZE="$2"
                shift 2
                ;;
            --initial-iodepth)
                if [ -z "$2" ] || [[ "$2" =~ ^- ]]; then
                    print_error "Option --initial-iodepth requires a number"
                    exit 1
                fi
                INITIAL_IODEPTH="$2"
                shift 2
                ;;
            --initial-numjobs)
                if [ -z "$2" ] || [[ "$2" =~ ^- ]]; then
                    print_error "Option --initial-numjobs requires a number"
                    exit 1
                fi
                INITIAL_NUMJOBS="$2"
                shift 2
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information."
                exit 1
                ;;
        esac
    done

    # Load configuration
    load_env_files "${env_files[@]}"
    set_defaults

    # Check prerequisites
    check_fio
    check_curl
    check_jq
    detect_ioengine

    # Setup target
    setup_target_dir

    # Show configuration
    show_config

    # Pre-flight checks
    if [ "$skip_confirmation" = false ]; then
        check_api_connectivity
        check_credentials
    else
        print_status "Skipping server connectivity checks due to --yes flag"
    fi

    # Estimate test duration
    local initial_qd=$((INITIAL_IODEPTH * INITIAL_NUMJOBS))
    local est_tests=$((MAX_STEPS * 2))  # 2 patterns per step (max)
    local est_minutes=$((est_tests * RUNTIME / 60))
    echo
    print_status "Starting saturation test:"
    print_status "  Block size: $BLOCK_SIZE"
    print_status "  Initial QD: $initial_qd (iodepth=$INITIAL_IODEPTH x numjobs=$INITIAL_NUMJOBS)"
    print_status "  P95 threshold: ${LATENCY_THRESHOLD_MS}ms"
    print_status "  Runtime per step: ${RUNTIME}s"
    print_status "  Max estimated time: ~${est_minutes} minutes (if all $MAX_STEPS steps run)"
    echo

    # Confirmation
    if [ "$TARGET_IS_DEVICE" = true ]; then
        echo
        print_error "DESTRUCTIVE OPERATION: Target device: $TARGET_DIR"
        echo
    fi

    if [ "$skip_confirmation" = false ]; then
        if [ "$TARGET_IS_DEVICE" = true ]; then
            read -p "DESTRUCTIVE: Type 'yes' to confirm testing on device $TARGET_DIR: " -r
            if [ "$REPLY" != "yes" ]; then
                print_warning "Test cancelled."
                exit 0
            fi
        else
            read -p "Start saturation test? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                print_warning "Test cancelled."
                exit 0
            fi
        fi
    else
        print_status "Auto-confirmed with --yes flag"
    fi

    # Run saturation loop
    saturation_loop

    # Print summary
    print_summary_table

    # Cleanup
    cleanup

    print_success "Saturation test complete!"
    print_status "View results in FIO Analyzer: $BACKEND_URL"
}

# Handle interruption
trap 'print_warning "Script interrupted. Cleaning up..."; cleanup; exit 1' INT TERM

# Handle --generate-env and --help before main
if [ "$1" = "-g" ] || [ "$1" = "--generate-env" ]; then
    env_filename=".env"
    if [ -n "$2" ] && [[ ! "$2" =~ ^- ]]; then
        env_filename="$2"
    fi
    generate_env_file "$env_filename"
    exit 0
fi

if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_help
    exit 0
fi

# Run main
main "$@"
