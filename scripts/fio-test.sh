#!/usr/bin/env bash

# FIO Performance Testing Script
# This script runs FIO tests with multiple block sizes and uploads results to the backend

# Colors for output
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
CYAN=$'\033[0;36m'
BOLD=$'\033[1m'
NC=$'\033[0m' # No Color

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
                # Remove leading whitespace from value
                value="${value#"${value%%[![:space:]]*}"}"
                # Strip inline comments: remove ' # ...' or '<tab># ...'
                # but only if the value is NOT quoted (preserve # inside quotes)
                if [[ "$value" != \"*\" ]] && [[ "$value" != \'*\' ]]; then
                    # Remove everything from first unquoted ' #' or '<whitespace>#'
                    value="${value%%[[:space:]]#*}"
                fi
                # Remove trailing whitespace from value
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

# Helper: Parse comma-separated string into a bash array
parse_csv_to_array() {
    local var_name="$1" csv_value="$2"
    local -a arr
    IFS=',' read -ra arr <<< "$csv_value"
    eval "${var_name}=(\"\${arr[@]}\")"
}

# Convert a fio size string (4096, 512K, 10M, 8G, 1T, 2P; optional i/B suffix,
# case-insensitive, powers of 1024 like fio's default kb_base) to bytes.
# Prints the byte count; returns 1 for invalid or zero sizes.
fio_size_to_bytes() {
    local size=$1
    local re='^([0-9]+)([kKmMgGtTpP]?)([iI]?[bB])?$'
    if ! [[ "$size" =~ $re ]]; then
        return 1
    fi
    local num=$((10#${BASH_REMATCH[1]})) unit shift_bits=0
    unit=$(printf '%s' "${BASH_REMATCH[2]}" | tr '[:lower:]' '[:upper:]')
    case "$unit" in
        K) shift_bits=10 ;;
        M) shift_bits=20 ;;
        G) shift_bits=30 ;;
        T) shift_bits=40 ;;
        P) shift_bits=50 ;;
    esac
    if [ "$num" -le 0 ]; then
        return 1
    fi
    echo $((num << shift_bits))
}

# Convert bytes to a whole-MiB fio size string ("<N>M"), rounding down
bytes_to_mib_size() {
    echo "$(($1 / 1048576))M"
}

# ============================================================
# Configuration Functions
# ============================================================

# Single source of truth for ALL default values
define_defaults() {
    # Host metadata
    HOSTNAME="${HOSTNAME:-$(hostname -s)}"
    PROTOCOL="${PROTOCOL:-unknown}"
    DRIVE_TYPE="${DRIVE_TYPE:-unknown}"
    DRIVE_MODEL="${DRIVE_MODEL:-unknown}"
    DESCRIPTION="${DESCRIPTION:-}"

    # Test parameters (scalar form, converted to arrays later)
    TEST_SIZE="${TEST_SIZE:-10M}"
    NUM_JOBS="${NUM_JOBS:-4}"
    DIRECT="${DIRECT:-1}"
    RUNTIME="${RUNTIME:-30}"
    SYNC="${SYNC:-1}"
    IODEPTH="${IODEPTH:-1}"
    BLOCK_SIZES="${BLOCK_SIZES:-4k,64k,1M}"
    TEST_PATTERNS="${TEST_PATTERNS:-read,write,randread,randwrite}"

    # Infrastructure
    BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
    TARGET_DIR="${TARGET_DIR:-./fio_tmp/}"
    USERNAME="${USERNAME:-uploader}"
    PASSWORD="${PASSWORD:-uploader}"

    # Saturation test mode defaults
    SATURATION_MODE="${SATURATION_MODE:-false}"
    SAT_BLOCK_SIZES="${SAT_BLOCK_SIZES:-${SAT_BLOCK_SIZE:-64k}}"
    SAT_PATTERNS="${SAT_PATTERNS:-randread,randwrite,randrw}"
    LATENCY_THRESHOLD_MS="${LATENCY_THRESHOLD_MS:-100}"
    INITIAL_IODEPTH="${INITIAL_IODEPTH:-16}"
    INITIAL_NUMJOBS="${INITIAL_NUMJOBS:-4}"
    MAX_STEPS="${MAX_STEPS:-20}"
    MAX_TOTAL_QD="${MAX_TOTAL_QD:-16384}"
    # Sync modes for saturation (comma-separated list, one run per value); empty = SYNC
    SAT_SYNC="${SAT_SYNC:-}"
    # Cap for all per-job files of one saturation step (FILE_PER_JOB=1 only); empty = no cap
    SAT_MAX_TOTAL_SIZE="${SAT_MAX_TOTAL_SIZE:-}"
    SAT_CAP_MIN_WARNED=false
    SAT_PREFILL_BASE=""

    # Advanced fio options (.env only, all off by default)
    FIO_EXTRA_ARGS="${FIO_EXTRA_ARGS:-}"
    KEEP_JSON_DIR="${KEEP_JSON_DIR:-}"
    FILE_PER_JOB="${FILE_PER_JOB:-0}"
    PREFILL="${PREFILL:-0}"
    # Retries for transient EAGAIN errors (io_uring can return EAGAIN at the end of a file)
    FIO_RETRY_MAX="${FIO_RETRY_MAX:-2}"
    FIO_RETRY_COUNT=0
    # Storage detection (filesystem, ZFS, Ceph), uploaded as storage_info; 0 = off
    STORAGE_DETECT="${STORAGE_DETECT:-1}"
    STORAGE_INFO=""
    STORAGE_WARNINGS=0
}

# Apply CLI overrides (CLI flags take highest priority over env/.env/defaults)
apply_cli_overrides() {
    [ -n "${CLI_HOSTNAME+set}" ]             && HOSTNAME="$CLI_HOSTNAME"
    [ -n "${CLI_PROTOCOL+set}" ]             && PROTOCOL="$CLI_PROTOCOL"
    [ -n "${CLI_DRIVE_TYPE+set}" ]           && DRIVE_TYPE="$CLI_DRIVE_TYPE"
    [ -n "${CLI_DRIVE_MODEL+set}" ]          && DRIVE_MODEL="$CLI_DRIVE_MODEL"
    [ -n "${CLI_DESCRIPTION+set}" ]          && DESCRIPTION="$CLI_DESCRIPTION"
    [ -n "${CLI_TEST_SIZE+set}" ]            && TEST_SIZE="$CLI_TEST_SIZE"
    [ -n "${CLI_NUM_JOBS+set}" ]             && NUM_JOBS="$CLI_NUM_JOBS"
    [ -n "${CLI_DIRECT+set}" ]               && DIRECT="$CLI_DIRECT"
    [ -n "${CLI_RUNTIME+set}" ]              && RUNTIME="$CLI_RUNTIME"
    [ -n "${CLI_SYNC+set}" ]                 && SYNC="$CLI_SYNC"
    [ -n "${CLI_IODEPTH+set}" ]              && IODEPTH="$CLI_IODEPTH"
    [ -n "${CLI_BLOCK_SIZES+set}" ]          && BLOCK_SIZES="$CLI_BLOCK_SIZES"
    [ -n "${CLI_TEST_PATTERNS+set}" ]        && TEST_PATTERNS="$CLI_TEST_PATTERNS"
    [ -n "${CLI_BACKEND_URL+set}" ]          && BACKEND_URL="$CLI_BACKEND_URL"
    [ -n "${CLI_TARGET_DIR+set}" ]           && TARGET_DIR="$CLI_TARGET_DIR"
    [ -n "${CLI_USERNAME+set}" ]             && USERNAME="$CLI_USERNAME"
    [ -n "${CLI_PASSWORD+set}" ]             && PASSWORD="$CLI_PASSWORD"
    [ -n "${CLI_CONFIG_UUID+set}" ]          && CONFIG_UUID="$CLI_CONFIG_UUID"
    [ -n "${CLI_IOENGINE+set}" ]             && IOENGINE="$CLI_IOENGINE"
    [ -n "${CLI_SATURATION_MODE+set}" ]      && SATURATION_MODE="$CLI_SATURATION_MODE"
    [ -n "${CLI_SAT_BLOCK_SIZES+set}" ]      && SAT_BLOCK_SIZES="$CLI_SAT_BLOCK_SIZES"
    [ -n "${CLI_SAT_PATTERNS+set}" ]         && SAT_PATTERNS="$CLI_SAT_PATTERNS"
    [ -n "${CLI_LATENCY_THRESHOLD_MS+set}" ] && LATENCY_THRESHOLD_MS="$CLI_LATENCY_THRESHOLD_MS"
    [ -n "${CLI_INITIAL_IODEPTH+set}" ]      && INITIAL_IODEPTH="$CLI_INITIAL_IODEPTH"
    [ -n "${CLI_INITIAL_NUMJOBS+set}" ]      && INITIAL_NUMJOBS="$CLI_INITIAL_NUMJOBS"
    [ -n "${CLI_MAX_STEPS+set}" ]            && MAX_STEPS="$CLI_MAX_STEPS"
    [ -n "${CLI_MAX_TOTAL_QD+set}" ]         && MAX_TOTAL_QD="$CLI_MAX_TOTAL_QD"
}

# Generate UUIDs for tracking
generate_uuids() {
    # config_uuid: Fixed per host-config (from .env or generated from hostname)
    if [ -n "$CONFIG_UUID" ]; then
        print_status "Using CONFIG_UUID: $CONFIG_UUID"
    else
        CONFIG_UUID=$(generate_uuid_from_hash "$HOSTNAME")
        print_status "Generated CONFIG_UUID from hostname: $CONFIG_UUID"
    fi

    # In saturation mode, derive a separate config_uuid
    if [ "$SATURATION_MODE" = true ]; then
        CONFIG_UUID=$(generate_uuid_from_hash "saturation-${CONFIG_UUID}")
        print_status "Derived saturation CONFIG_UUID: $CONFIG_UUID"
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
}

# Build description string (single location, no duplication)
# Uses BASE_DESCRIPTION (the user-supplied text) so repeated calls do not nest.
# Saturation uploads must start with "saturation-test" (backend detection).
build_description() {
    local prefix=""
    if [ "$SATURATION_MODE" = true ]; then
        prefix="saturation-test${BASE_DESCRIPTION:+,${BASE_DESCRIPTION}}"
    elif [ -n "$BASE_DESCRIPTION" ]; then
        prefix="$BASE_DESCRIPTION"
    fi

    local tags=""
    if [ "$PREFILL" = 1 ]; then tags+=",prefill:1"; fi
    if [ "$FILE_PER_JOB" = 1 ]; then tags+=",fileperjob:1"; fi
    if [ "$SATURATION_MODE" = true ] && sat_cap_active; then tags+=",satcap:${SAT_MAX_TOTAL_SIZE}"; fi

    DESCRIPTION="${prefix:+${prefix},}hostname:${HOSTNAME},protocol:${PROTOCOL},drivetype:${DRIVE_TYPE},drivemodel:${DRIVE_MODEL},config_uuid:${CONFIG_UUID},run_uuid:${RUN_UUID},date:$(date -u +%Y-%m-%dT%H:%M:%SZ)${tags}"

    # Sanitize: spaces to underscores, remove special chars
    DESCRIPTION=$(echo "$DESCRIPTION" | sed 's/ /_/g' | sed 's/[^-a-zA-Z0-9_,;:]//g')
}

# Validate saturation-specific configuration
validate_saturation_config() {
    # Parse SAT_BLOCK_SIZES into array
    IFS=',' read -ra SAT_BLOCK_SIZES_ARR <<< "$SAT_BLOCK_SIZES"

    # Parse SAT_PATTERNS into array
    IFS=',' read -ra SAT_PATTERNS_ARR <<< "$SAT_PATTERNS"

    # Validate patterns — only these are supported by FIO
    local valid_patterns="randread randwrite randrw read write rw"
    for p in "${SAT_PATTERNS_ARR[@]}"; do
        if ! echo "$valid_patterns" | grep -qw "$p"; then
            print_error "Invalid saturation pattern: '$p'"
            print_error "Valid patterns: randread, randwrite, randrw, read, write, rw"
            exit 1
        fi
    done

    # Check for duplicate patterns (exact duplicates only)
    local seen_patterns=""
    for p in "${SAT_PATTERNS_ARR[@]}"; do
        if echo "$seen_patterns" | grep -qw "$p"; then
            print_error "Duplicate pattern: '$p' specified more than once"
            exit 1
        fi
        seen_patterns="$seen_patterns $p"
    done

    # Sync modes: SAT_SYNC list, or SYNC when SAT_SYNC is unset (one run per value)
    parse_sat_sync_list "${SAT_SYNC:-$SYNC}" || exit 1
}

# Parse a comma-separated sync list into SAT_SYNC_ARR (spaces trimmed)
# Valid: none, sync, dsync and legacy 0/1 (passed to fio --sync as given)
parse_sat_sync_list() {
    local list=$1 value
    local -a raw
    SAT_SYNC_ARR=()
    IFS=',' read -ra raw <<< "$list"
    if [ ${#raw[@]} -eq 0 ]; then
        print_error "SAT_SYNC is empty (valid: none, sync, dsync, 0, 1)"
        return 1
    fi
    for value in "${raw[@]}"; do
        value="${value//[[:space:]]/}"
        case "$value" in
            none|sync|dsync|0|1) SAT_SYNC_ARR+=("$value") ;;
            *)
                print_error "Invalid saturation sync mode: '$value' (valid: none, sync, dsync, 0, 1)"
                return 1
                ;;
        esac
    done
}

# Run label for saturation headers: "bs=<bs>", plus " sync=<mode>" when several sync modes run
sat_run_label() {
    local label="bs=$1"
    if [ "${#SAT_SYNC_ARR[@]}" -gt 1 ]; then
        label+=" sync=${SAT_SYNC}"
    fi
    echo "$label"
}

# True when the saturation size cap applies (SAT_MAX_TOTAL_SIZE set and FILE_PER_JOB=1)
sat_cap_active() {
    [ -n "$SAT_MAX_TOTAL_SIZE" ] && [ "$FILE_PER_JOB" = 1 ]
}

# Validate SAT_MAX_TOTAL_SIZE (warn and disable when invalid or without FILE_PER_JOB=1)
validate_sat_cap() {
    if [ -z "$SAT_MAX_TOTAL_SIZE" ]; then
        return 0
    fi
    if ! fio_size_to_bytes "$SAT_MAX_TOTAL_SIZE" >/dev/null; then
        print_warning "SAT_MAX_TOTAL_SIZE must be a size like 512M, 8G or 1T (got '$SAT_MAX_TOTAL_SIZE'), disabling"
        SAT_MAX_TOTAL_SIZE=""
    elif [ "$FILE_PER_JOB" != 1 ]; then
        print_warning "SAT_MAX_TOTAL_SIZE only applies with FILE_PER_JOB=1 - ignored"
        SAT_MAX_TOTAL_SIZE=""
    fi
}

# Per-job file size for a saturation step into SAT_STEP_SIZE:
# min(SAT_TEST_SIZE, SAT_MAX_TOTAL_SIZE / numjobs), rounded down to whole MiB, at least 1M.
# SAT_TEST_SIZE is used unchanged when the cap is off or not needed.
sat_step_size() {
    local num_jobs=$1 test_bytes cap_bytes share
    SAT_STEP_SIZE="$SAT_TEST_SIZE"
    if ! sat_cap_active; then
        return 0
    fi
    if ! test_bytes=$(fio_size_to_bytes "$SAT_TEST_SIZE"); then
        return 0
    fi
    cap_bytes=$(fio_size_to_bytes "$SAT_MAX_TOTAL_SIZE") || return 0
    share=$((cap_bytes / num_jobs))
    if [ "$test_bytes" -le "$share" ]; then
        return 0
    fi
    if [ "$share" -lt 1048576 ]; then
        SAT_STEP_SIZE="1M"
        if [ "$SAT_CAP_MIN_WARNED" != true ]; then
            print_warning "SAT_MAX_TOTAL_SIZE=${SAT_MAX_TOTAL_SIZE} / ${num_jobs} jobs is below the 1M minimum per job - using 1M (total exceeds the cap)"
            SAT_CAP_MIN_WARNED=true
        fi
        return 0
    fi
    SAT_STEP_SIZE=$(bytes_to_mib_size "$share")
}

# PREFILL: remove the previous step's data files when the base name (size) changes,
# so files of other sizes do not pile up beyond SAT_MAX_TOTAL_SIZE
sat_drop_stale_prefill() {
    local base=$1
    if [ "$PREFILL" != 1 ] || [ "$TARGET_IS_DEVICE" = true ]; then
        return 0
    fi
    if [ -n "$SAT_PREFILL_BASE" ] && [ "$SAT_PREFILL_BASE" != "$base" ]; then
        rm -f "${TARGET_DIR}/${SAT_PREFILL_BASE}" "${TARGET_DIR}/${SAT_PREFILL_BASE}."* 2>/dev/null || true
    fi
    SAT_PREFILL_BASE="$base"
}

# Convert scalar values to arrays for multi-value iteration
convert_scalars_to_arrays() {
    # Freeze scalar values for saturation mode BEFORE array conversion
    # (SAT_SYNC becomes the current sync mode; SAT_SYNC_ARR holds the list)
    if [ "$SATURATION_MODE" = true ]; then
        SAT_DIRECT="${DIRECT}"
        SAT_SYNC="${SAT_SYNC_ARR[0]}"
        SAT_RUNTIME="${RUNTIME}"
        SAT_TEST_SIZE="${TEST_SIZE}"
    fi

    # Convert all comma-separated scalars to arrays unconditionally
    parse_csv_to_array BLOCK_SIZES   "$BLOCK_SIZES"
    parse_csv_to_array TEST_PATTERNS "$TEST_PATTERNS"
    parse_csv_to_array NUM_JOBS      "$NUM_JOBS"
    parse_csv_to_array DIRECT        "$DIRECT"
    parse_csv_to_array TEST_SIZE     "$TEST_SIZE"
    parse_csv_to_array SYNC          "$SYNC"
    parse_csv_to_array IODEPTH       "$IODEPTH"
    parse_csv_to_array RUNTIME       "$RUNTIME"
}

# Validate FILE_PER_JOB/PREFILL and parse FIO_EXTRA_ARGS into FIO_EXTRA_ARGS_ARR
# FIO_EXTRA_ARGS is split on whitespace (no eval): values containing spaces are not supported.
validate_advanced_options() {
    local opt
    for opt in FILE_PER_JOB PREFILL; do
        case "${!opt}" in
            0|1) ;;
            *)
                print_warning "$opt must be 0 or 1 (got '${!opt}'), disabling"
                printf -v "$opt" '%s' 0
                ;;
        esac
    done

    if { [ "$FILE_PER_JOB" = 1 ] || [ "$PREFILL" = 1 ]; } && is_block_device "$TARGET_DIR"; then
        print_warning "PREFILL/FILE_PER_JOB only apply to directory targets - ignored for block device $TARGET_DIR"
        FILE_PER_JOB=0
        PREFILL=0
    fi
    validate_sat_cap

    if ! [[ "$FIO_RETRY_MAX" =~ ^[0-9]+$ ]] || [ "${#FIO_RETRY_MAX}" -gt 2 ] || [ "$FIO_RETRY_MAX" -gt 10 ]; then
        print_warning "FIO_RETRY_MAX must be a number from 0 to 10 (got '$FIO_RETRY_MAX'), using 2"
        FIO_RETRY_MAX=2
    fi

    FIO_EXTRA_ARGS_ARR=()
    if [ -n "$FIO_EXTRA_ARGS" ]; then
        read -r -a FIO_EXTRA_ARGS_ARR <<< "$FIO_EXTRA_ARGS"
    fi
}

# Master configuration orchestrator
# Precedence: CLI flags > env vars / .env file > hardcoded defaults
init_config() {
    # Step 1: Apply defaults for anything not already set (env/.env values survive)
    define_defaults

    # Step 2: Override with CLI flags (highest priority)
    apply_cli_overrides
    BASE_DESCRIPTION="$DESCRIPTION"
    validate_advanced_options

    # Step 3: Detect I/O engine (before array conversion so psync fallback works)
    detect_ioengine

    # Step 4: Generate UUIDs
    generate_uuids

    # Step 5: Build description string
    build_description

    # Step 6: Validate saturation config if applicable
    if [ "$SATURATION_MODE" = true ]; then
        validate_saturation_config
    fi

    # Step 7: Convert scalar values to arrays (last step)
    convert_scalars_to_arrays
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

# Function to check if jq is installed (required for saturation mode)
check_jq() {
    if ! command -v jq &> /dev/null; then
        print_error "jq is not installed. Required for saturation mode JSON parsing."
        print_error "Install with: brew install jq (macOS) or apt install jq (Linux)"
        exit 1
    fi
}

# Function to test if a specific I/O engine is available
test_ioengine() {
    local engine=$1
    local test_output
    test_output=$(fio --name=test --ioengine="$engine" --rw=read --bs=4k --size=1M --filename=/dev/null --runtime=1 --time_based 2>&1)
    
    if echo "$test_output" | grep -q "engine.*not loadable\|engine.*not available\|unknown ioengine"; then
        return 1  # Engine not available
    else
        return 0  # Engine available
    fi
}

# Function to detect the best available I/O engine
# Detect sync engines where iodepth is always effectively 1 (saturation then escalates numjobs only)
set_sync_engine_flag() {
    case "$IOENGINE" in
        psync|sync|vsync)
            IS_SYNC_ENGINE=true
            ;;
        *)
            IS_SYNC_ENGINE=false
            ;;
    esac
}

detect_ioengine() {
    # If IOENGINE is already set (from env or command line), validate it
    if [ -n "$IOENGINE" ]; then
        print_status "Testing specified I/O engine: $IOENGINE"
        if test_ioengine "$IOENGINE"; then
            print_success "I/O engine '$IOENGINE' is available"
            set_sync_engine_flag
            return 0
        else
            print_error "Specified I/O engine '$IOENGINE' is not available"
            exit 1
        fi
    fi
    
    print_status "Auto-detecting best available I/O engine..."
    
    # Test engines in order of preference: io_uring > libaio > psync
    if test_ioengine "io_uring"; then
        IOENGINE="io_uring"
        print_success "io_uring engine is available - using for best performance"
        print_status "io_uring provides the best performance on modern Linux kernels (5.1+)"
    elif test_ioengine "libaio"; then
        IOENGINE="libaio"
        print_success "libaio engine is available - using for good async I/O"
        print_status "libaio is the standard Linux async I/O engine"
    else
        IOENGINE="psync"
        IODEPTH="1"
        print_warning "No async I/O engines available - falling back to psync"
        print_status "psync uses POSIX pwrite() - synchronous I/O only"
    fi

    set_sync_engine_flag
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
                if [ "$num_jobs" -ge 129 ]; then
                    print_warning "High job count detected: ${num_jobs} jobs"
                    print_warning "  → May exceed system shared memory limits"
                    print_warning "  → Recommended: NUM_JOBS=128 or less for stability"
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

# Function to check if target is a block device
is_block_device() {
    local target="$1"
    [ -b "$target" ]
}

# Function to check if a device is mounted
is_device_mounted() {
    local device="$1"
    # Resolve the device path (handle symlinks like /dev/disk/by-id/*)
    local resolved_device
    resolved_device=$(readlink -f "$device" 2>/dev/null || echo "$device")
    
    # Check if device or any partition is mounted
    if mount | grep -q "^${resolved_device}"; then
        return 0  # Device is mounted
    fi
    
    # Also check /proc/mounts for more reliable detection on Linux
    if [ -f /proc/mounts ] && grep -q "^${resolved_device}" /proc/mounts; then
        return 0
    fi
    
    return 1  # Device is not mounted
}

# Function to setup target (directory or device)
setup_target_dir() {
    if is_block_device "$TARGET_DIR"; then
        print_status "TARGET_DIR is a block device: $TARGET_DIR"
        
        # Check if device is mounted
        if is_device_mounted "$TARGET_DIR"; then
            print_error "Device $TARGET_DIR is mounted!"
            print_error "Cannot run fio directly on a mounted device."
            print_error "Either unmount the device or use a directory path instead."
            exit 1
        fi
        
        # Warn about destructive operation
        echo
        print_warning "⚠️  WARNING: Running fio directly on a block device!"
        print_warning "   Device: $TARGET_DIR"
        print_warning "   This will DESTROY ALL DATA on the device!"
        echo
        
        # Set flag for device mode
        TARGET_IS_DEVICE=true
        
        # Verify device is accessible
        if [ ! -r "$TARGET_DIR" ] || [ ! -w "$TARGET_DIR" ]; then
            print_error "Cannot read/write to device $TARGET_DIR"
            print_error "You may need root privileges to access this device."
            exit 1
        fi
        
        print_success "Device $TARGET_DIR is accessible and not mounted"
    else
        # Regular directory mode
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

# ============================================================
# Storage detection (STORAGE_INFO, uploaded as storage_info)
# ============================================================

# Escape a string for use inside a JSON string literal (without the quotes)
json_escape() {
    local s=$1
    # Quoted replacements behave the same with and without bash 5.2 patsub_replacement
    s=${s//\\/'\\'}
    s=${s//\"/'\"'}
    s=${s//$'\t'/'\t'}
    s=${s//$'\n'/'\n'}
    s=${s//$'\r'/'\r'}
    printf '%s' "$s" | LC_ALL=C tr -d '\001-\010\013\014\016-\037\177'
}

# Build a compact JSON object from key/value pairs; empty values are skipped.
# Key suffixes: "key:n" = integer (skipped if not numeric), "key:o" = raw JSON object.
json_object() {
    local out="" key value
    while [ $# -ge 2 ]; do
        key=$1 value=$2
        shift 2
        if [ -z "$value" ]; then continue; fi
        case "$key" in
            *:n) if [[ "$value" =~ ^(0|[1-9][0-9]*)$ ]]; then out+=",\"${key%:n}\":$value"; fi ;;
            *:o) if [ "$value" != "{}" ]; then out+=",\"${key%:o}\":$value"; fi ;;
            *) out+=",\"$(json_escape "$key")\":\"$(json_escape "$value")\"" ;;
        esac
    done
    printf '{%s}' "${out#,}"
}

# Run a detection command time-limited (timeout/gtimeout 5s when available), stdin
# closed and stderr discarded. Shell functions run directly (test stubs).
si_run() {
    if declare -F "$1" >/dev/null; then
        "$@" 2>/dev/null </dev/null
    elif command -v timeout >/dev/null 2>&1; then
        timeout 5 "$@" 2>/dev/null </dev/null
    elif command -v gtimeout >/dev/null 2>&1; then
        gtimeout 5 "$@" 2>/dev/null </dev/null
    else
        "$@" 2>/dev/null </dev/null
    fi
}

# Filesystem type and mount source of a directory into SI_FS_TYPE / SI_FS_SOURCE
# (findmnt, Linux stat -f, or df + mount on macOS/BSD)
storage_fs_info() {
    local dir=$1 out mp line
    SI_FS_TYPE="" SI_FS_SOURCE=""
    if command -v findmnt >/dev/null 2>&1; then
        out=$(si_run findmnt -n -o FSTYPE,SOURCE -T "$dir" | head -n 1)
        read -r SI_FS_TYPE SI_FS_SOURCE <<< "$out"
    fi
    if [ -z "$SI_FS_TYPE" ] && [ "$(uname -s)" = Linux ]; then
        SI_FS_TYPE=$(si_run stat -f -c %T "$dir")
    fi
    if [ -z "$SI_FS_TYPE" ] && [ "$(uname -s)" != Linux ] \
        && command -v df >/dev/null 2>&1 && command -v mount >/dev/null 2>&1; then
        mp=$(si_run df -P "$dir" | awk 'NR == 2 {print $NF}')
        if [ -n "$mp" ]; then
            line=$(si_run mount | grep -F " on $mp (" | tail -n 1)
            if [ -n "$line" ]; then
                SI_FS_SOURCE=${line%% on *}
                SI_FS_TYPE=${line#* on "$mp" (}
                SI_FS_TYPE=${SI_FS_TYPE%%[,)]*}
            fi
        fi
    fi
    SI_FS_TYPE=${SI_FS_TYPE%%$'\n'*}
}

# ZFS name of the target: dataset for directories, zvol for block devices (empty if none)
# Values from paths or tool output must not be read as options by zfs/ceph/rbd
si_safe_arg() {
    case "$1" in -*) return 1 ;; esac
    return 0
}

storage_zfs_dataset() {
    local target=$1 name resolved zvol_dir=${SI_ZVOL_DIR:-/dev/zvol}
    if [ "$TARGET_IS_DEVICE" != true ]; then
        if command -v zfs >/dev/null 2>&1; then
            si_safe_arg "$target" && name=$(si_run zfs list -H -o name "$target" | head -n 1)
        fi
        echo "${name:-$SI_FS_SOURCE}"
        return 0
    fi
    case "$target" in
        "$zvol_dir"/*) echo "${target#"$zvol_dir"/}"; return 0 ;;
    esac
    command -v zfs >/dev/null 2>&1 || return 0
    resolved=$(readlink -f "$target" 2>/dev/null || echo "$target")
    while IFS= read -r name; do
        if [ -n "$name" ] && [ "$(readlink -f "$zvol_dir/$name" 2>/dev/null)" = "$resolved" ]; then
            echo "$name"
            return 0
        fi
    done < <(si_run zfs list -H -o name -t volume)
}

# Data vdev layout of a ZFS pool from `zpool status -P` as "<layout> <vdevs>":
# mirror, raidz1-3, draid<parity>, stripe (plain disks) or mixed. Only the top-level
# vdevs below the pool line count; logs/cache/spares/special/dedup end the data section.
storage_zpool_layout() {
    local pool=$1 line name indent pool_indent="" kind layout="" count=0 in_config=false
    local re='^([[:space:]]*)([^[:space:]]+)'
    si_safe_arg "$pool" || return 0
    command -v zpool >/dev/null 2>&1 || return 0
    while IFS= read -r line; do
        if [ "$in_config" = false ]; then
            [[ "$line" =~ ^[[:space:]]*config: ]] && in_config=true
            continue
        fi
        if ! [[ "$line" =~ $re ]]; then
            if [ -n "$pool_indent" ]; then break; fi
            continue
        fi
        indent=${#BASH_REMATCH[1]} name=${BASH_REMATCH[2]}
        if [ -z "$pool_indent" ]; then
            if [ "$name" = "$pool" ]; then pool_indent=$indent; fi
            continue
        fi
        if [ "$indent" -le "$pool_indent" ]; then break; fi
        if [ "$indent" -ne $((pool_indent + 2)) ]; then continue; fi
        case "$name" in
            indirect-*) continue ;;
            mirror-*) kind=mirror ;;
            raidz-*|raidz1-*) kind=raidz1 ;;
            raidz2-*) kind=raidz2 ;;
            raidz3-*) kind=raidz3 ;;
            draid*) kind=${name%%[:-]*} ;;
            *) kind=stripe ;;
        esac
        if [ -z "$layout" ]; then layout=$kind; elif [ "$layout" != "$kind" ]; then layout=mixed; fi
        count=$((count + 1))
    done < <(si_run zpool status -P "$pool")
    if [ -n "$layout" ]; then echo "$layout $count"; fi
    return 0
}

# Read ZFS properties of $1 (type filesystem|volume in $2) into SI_ZFS_* and SI_ZFS_JSON
storage_zfs_props() {
    local name=$1 type=$2 prop value compression="" primarycache="" logbias=""
    SI_ZFS_DATASET=$name SI_ZFS_TYPE=$type SI_ZFS_SYNC="" SI_ZFS_RECORDSIZE="" SI_ZFS_VOLBLOCKSIZE=""
    SI_ZFS_POOL="" SI_ZFS_POOL_LAYOUT="" SI_ZFS_POOL_VDEVS=""
    if ! si_safe_arg "$name"; then SI_ZFS_JSON=""; return 0; fi
    if command -v zfs >/dev/null 2>&1; then
        while read -r prop value _; do
            if [ -z "$value" ] || [ "$value" = "-" ]; then continue; fi
            case "$prop" in
                sync) SI_ZFS_SYNC=$value ;;
                recordsize) SI_ZFS_RECORDSIZE=$value ;;
                volblocksize) SI_ZFS_VOLBLOCKSIZE=$value ;;
                compression) compression=$value ;;
                primarycache) primarycache=$value ;;
                logbias) logbias=$value ;;
            esac
        done < <(si_run zfs get -H -o property,value sync,recordsize,volblocksize,compression,primarycache,logbias "$name")
    fi
    SI_ZFS_COMPRESSION=$compression SI_ZFS_PRIMARYCACHE=$primarycache SI_ZFS_LOGBIAS=$logbias
    SI_ZFS_POOL=${name%%/*}
    read -r SI_ZFS_POOL_LAYOUT SI_ZFS_POOL_VDEVS <<< "$(storage_zpool_layout "$SI_ZFS_POOL")"
    SI_ZFS_JSON=$(json_object dataset "$name" type "$type" sync "$SI_ZFS_SYNC" \
        recordsize "$SI_ZFS_RECORDSIZE" volblocksize "$SI_ZFS_VOLBLOCKSIZE" \
        compression "$compression" primarycache "$primarycache" logbias "$logbias" \
        pool "$SI_ZFS_POOL" pool_layout "$SI_ZFS_POOL_LAYOUT" pool_vdevs:n "$SI_ZFS_POOL_VDEVS")
}

# Pool and image of a mapped RBD device as "pool image" (empty if not RBD)
storage_rbd_device() {
    local target=$1 rbd_dir=${SI_RBD_DEV_DIR:-/dev/rbd} sysfs=${SI_RBD_SYSFS:-/sys/bus/rbd/devices}
    local rest resolved base id cols
    case "$target" in
        "$rbd_dir"/*/*)
            rest=${target#"$rbd_dir"/}
            echo "${rest%%/*} ${rest##*/}"
            return 0
            ;;
    esac
    resolved=$(readlink -f "$target" 2>/dev/null || echo "$target")
    base=${resolved##*/}
    [[ "$base" =~ ^rbd([0-9]+)$ ]] || return 0
    id=${BASH_REMATCH[1]}
    if [ -r "$sysfs/$id/pool" ] && [ -r "$sysfs/$id/name" ]; then
        echo "$(cat "$sysfs/$id/pool") $(cat "$sysfs/$id/name")"
        return 0
    fi
    command -v rbd >/dev/null 2>&1 || { echo "? ?"; return 0; }
    # rbd showmapped columns: id pool [namespace] image snap device (namespace may be empty)
    cols=$(si_run rbd showmapped \
        | awk -v dev="$resolved" -v tgt="$target" '$NF == dev || $NF == tgt {print $2, $(NF-2); exit}')
    echo "${cols:-? ?}"
}

# Replication details of a Ceph pool as JSON fields (pool_type, pool_size, min_size)
storage_ceph_pool() {
    local pool=$1 line type="" size="" min_size=""
    si_safe_arg "$pool" || return 0
    command -v ceph >/dev/null 2>&1 || return 0
    line=$(si_run ceph osd pool ls detail | grep -F "'$pool' " | head -n 1)
    if [ -n "$line" ]; then
        [[ "$line" =~ \ (replicated|erasure)\  ]] && type=${BASH_REMATCH[1]}
        [[ "$line" =~ \ size\ ([0-9]+) ]] && size=${BASH_REMATCH[1]}
        [[ "$line" =~ \ min_size\ ([0-9]+) ]] && min_size=${BASH_REMATCH[1]}
    fi
    if [ -z "$size" ]; then
        size=$(si_run ceph osd pool get "$pool" size | awk '/^size:/ {print $2}')
    fi
    if [ -z "$min_size" ]; then
        min_size=$(si_run ceph osd pool get "$pool" min_size | awk '/^min_size:/ {print $2}')
    fi
    printf '%s|%s|%s' "$type" "$size" "$min_size"
}

# Best-effort Ceph details (CephFS or mapped RBD) into SI_CEPH_JSON
storage_ceph_info() {
    local target=$1 kind="" pool="" image="" data_pool="" object_size="" info order
    local pool_type pool_size min_size
    SI_CEPH_JSON="" SI_CEPH_KIND="" SI_CEPH_POOL=""
    if [ "$TARGET_IS_DEVICE" = true ]; then
        read -r pool image <<< "$(storage_rbd_device "$target")"
        [ -n "$pool" ] || return 0
        kind=rbd
        [ "$pool" = "?" ] && pool="" && image=""
        if [ -n "$pool" ] && command -v rbd >/dev/null 2>&1; then
            si_safe_arg "$pool" && info=$(si_run rbd info "$pool/$image")
            order=$(sed -n 's/^[[:space:]]*order \([0-9]*\).*/\1/p' <<< "$info" | head -n 1)
            if [ -n "$order" ] && [ "$order" -lt 63 ]; then object_size=$((1 << order)); fi
            data_pool=$(sed -n 's/^[[:space:]]*data_pool: *//p' <<< "$info" | head -n 1)
        fi
    else
        case "$SI_FS_TYPE" in
            ceph|fuse.ceph-fuse|fuse.ceph) kind=cephfs ;;
            *) return 0 ;;
        esac
        if command -v getfattr >/dev/null 2>&1; then
            pool=$(si_run getfattr -n ceph.dir.layout.pool --only-values "$target" | head -n 1)
        fi
    fi
    # Replication of the pool holding the data (RBD images may use a separate data pool)
    pool_type="" pool_size="" min_size=""
    if [ -n "${data_pool:-$pool}" ]; then
        IFS='|' read -r pool_type pool_size min_size <<< "$(storage_ceph_pool "${data_pool:-$pool}")"
    fi
    SI_CEPH_KIND=$kind SI_CEPH_POOL=$pool SI_CEPH_IMAGE=$image SI_CEPH_OBJECT_SIZE=$object_size
    SI_CEPH_DATA_POOL=$data_pool SI_CEPH_POOL_TYPE=$pool_type SI_CEPH_POOL_SIZE=$pool_size
    SI_CEPH_MIN_SIZE=$min_size
    SI_CEPH_JSON=$(json_object kind "$kind" pool "$pool" image "$image" object_size:n "$object_size" \
        data_pool "$data_pool" pool_type "$pool_type" pool_size:n "$pool_size" min_size:n "$min_size")
}

# First line of a (sysfs) file with surrounding whitespace trimmed; empty if unreadable
si_read_file() {
    local v=""
    if [ -r "$1" ]; then IFS= read -r v < "$1" 2>/dev/null; fi
    v=${v//[[:cntrl:]]/}  # values end up on root's terminal: no escape sequences
    v=${v#"${v%%[![:space:]]*}"}
    printf '%s' "${v%"${v##*[![:space:]]}"}"
}

# Whole disk below a kernel block device name: partitions and single-slave
# device-mapper devices are followed via sysfs (lsblk PKNAME when sysfs has no entry)
# SI_* are test hooks (sysfs roots) and detection results: never take them from .env
clear_storage_overrides() {
    local name
    for name in "${!SI_@}"; do unset "$name"; done
}

storage_parent_disk() {
    local dev=$1 sys=${SI_SYS_ROOT:-}/sys/class/block parent i
    local slaves=()
    for ((i = 0; i < 4; i++)); do
        if [ -e "$sys/$dev/partition" ]; then
            parent=$(readlink -f "$sys/$dev" 2>/dev/null)
            parent=${parent%/*}
            parent=${parent##*/}
        elif [ -d "$sys/$dev/slaves" ]; then
            slaves=("$sys/$dev/slaves"/*)
            if [ ${#slaves[@]} -ne 1 ] || [ ! -e "${slaves[0]}" ]; then break; fi
            parent=${slaves[0]##*/}
        elif [ ! -e "$sys/$dev" ] && si_safe_arg "$dev" && command -v lsblk >/dev/null 2>&1; then
            parent=$(si_run lsblk -no PKNAME "/dev/$dev" | head -n 1)
        else
            break
        fi
        if [ -z "$parent" ] || [ "$parent" = "$dev" ]; then break; fi
        # Only plain device names: never walk the sysfs tree with '..' or '/'
        if ! [[ "$parent" =~ ^[A-Za-z0-9._:+-]+$ ]] || [ "$parent" = . ] || [ "$parent" = .. ]; then break; fi
        dev=$parent
    done
    echo "$dev"
}

# Driver of a disk: the first driver link above /sys/block/<disk>/device that is not
# the generic sd/sr driver (virtio_blk, virtio_scsi, nvme, ahci, mpt3sas, ...)
storage_disk_driver() {
    local disk=$1 sys dir drv fallback="" i
    sys=$(readlink -f "${SI_SYS_ROOT:-}/sys" 2>/dev/null) || return 0
    dir=$(readlink -f "${SI_SYS_ROOT:-}/sys/block/$disk/device" 2>/dev/null) || return 0
    for ((i = 0; i < 8; i++)); do
        [[ "$dir" == "$sys"/devices/* ]] || break
        if [ -L "$dir/driver" ]; then
            drv=$(readlink "$dir/driver")
            drv=${drv##*/}
            case "$drv" in
                sd|sr|"") fallback=${fallback:-$drv} ;;
                *) echo "$drv"; return 0 ;;
            esac
        fi
        dir=${dir%/*}
    done
    if [ -n "$fallback" ]; then echo "$fallback"; fi
    return 0
}

# Model, vendor, serial, transport, rotational and size of /dev/$1 via `lsblk -P`
# into SI_DISK_* (values trimmed; lsblk escapes spaces in some versions as \x20)
storage_disk_lsblk() {
    local disk=$1 out key value re='([A-Z]+)="([^"]*)"(.*)'
    command -v lsblk >/dev/null 2>&1 || return 0
    out=$(si_run lsblk -dn -P -o MODEL,VENDOR,SERIAL,TRAN,ROTA,SIZE "/dev/$disk" | head -n 1)
    while [[ "$out" =~ $re ]]; do
        key=${BASH_REMATCH[1]} value=${BASH_REMATCH[2]//\\x20/ } out=${BASH_REMATCH[3]}
        value=${value#"${value%%[![:space:]]*}"}
        value=${value%"${value##*[![:space:]]}"}
        case "$key" in
            MODEL) SI_DISK_MODEL=$value ;;
            VENDOR) SI_DISK_VENDOR=$value ;;
            SERIAL) SI_DISK_SERIAL=$value ;;
            TRAN) SI_DISK_TRAN=$value ;;
            ROTA) SI_DISK_ROTA=$value ;;
            SIZE) SI_DISK_SIZE=$value ;;
        esac
    done
}

# Disk below the target (Linux; not for ZFS, Ceph or network filesystems) into
# SI_DISK_* and SI_DISK_JSON. Directory targets use the mount source from findmnt.
storage_disk_info() {
    local src dev disk sys=${SI_SYS_ROOT:-}/sys/block
    SI_DISK_JSON="" SI_DISK_NAME="" SI_DISK_MODEL="" SI_DISK_VENDOR="" SI_DISK_SERIAL=""
    SI_DISK_TRAN="" SI_DISK_DRIVER="" SI_DISK_ROTA="" SI_DISK_SIZE=""
    [ "$(uname -s)" = Linux ] || return 0
    if [ -n "${SI_ZFS_DATASET:-}" ] || [ -n "${SI_CEPH_KIND:-}" ]; then return 0; fi
    if [ "$TARGET_IS_DEVICE" = true ]; then
        src=$TARGET_DIR
    else
        src=${SI_FS_SOURCE%%\[*}
        case "$src" in /dev/*) ;; *) return 0 ;; esac
    fi
    dev=$(readlink -f "$src" 2>/dev/null) || dev=$src
    dev=${dev:-$src}
    disk=$(storage_parent_disk "${dev##*/}")
    si_safe_arg "$disk" || return 0
    storage_disk_lsblk "$disk"
    [ -n "$SI_DISK_MODEL" ] || SI_DISK_MODEL=$(si_read_file "$sys/$disk/device/model")
    [ -n "$SI_DISK_VENDOR" ] || SI_DISK_VENDOR=$(si_read_file "$sys/$disk/device/vendor")
    [ -n "$SI_DISK_ROTA" ] || SI_DISK_ROTA=$(si_read_file "$sys/$disk/queue/rotational")
    SI_DISK_DRIVER=$(storage_disk_driver "$disk")
    if [ -z "$SI_DISK_MODEL$SI_DISK_VENDOR$SI_DISK_SERIAL$SI_DISK_TRAN$SI_DISK_ROTA$SI_DISK_SIZE$SI_DISK_DRIVER" ]; then
        return 0
    fi
    SI_DISK_NAME=$disk
    SI_DISK_JSON=$(json_object name "$disk" model "$SI_DISK_MODEL" vendor "$SI_DISK_VENDOR" \
        serial "$SI_DISK_SERIAL" transport "$SI_DISK_TRAN" driver "$SI_DISK_DRIVER" \
        rotational:n "$SI_DISK_ROTA" size "$SI_DISK_SIZE")
}

# Virtualization type (systemd-detect-virt) plus DMI vendor/product into SI_VIRT_* and
# SI_VIRT_JSON; nothing on bare metal. Containers see the host's DMI, so it is skipped.
storage_virt_info() {
    local dmi=${SI_SYS_ROOT:-}/sys/class/dmi/id type
    SI_VIRT_JSON="" SI_VIRT_TYPE="" SI_VIRT_VENDOR="" SI_VIRT_PRODUCT=""
    [ "$(uname -s)" = Linux ] || return 0
    command -v systemd-detect-virt >/dev/null 2>&1 || return 0
    type=$(si_run systemd-detect-virt | head -n 1)
    case "$type" in ""|none) return 0 ;; esac
    SI_VIRT_TYPE=$type
    case "$type" in
        lxc*|systemd-nspawn|docker|podman|rkt|wsl|proot|pouch|openvz) ;;
        *)
            SI_VIRT_VENDOR=$(si_read_file "$dmi/sys_vendor")
            SI_VIRT_PRODUCT=$(si_read_file "$dmi/product_name")
            ;;
    esac
    SI_VIRT_JSON=$(json_object type "$type" vendor "$SI_VIRT_VENDOR" product "$SI_VIRT_PRODUCT")
}

# STORAGE_INFO JSON from the detected SI_* values
storage_info_json() {
    json_object fs_type "${SI_FS_TYPE:-}" kernel "${SI_KERNEL:-}" os "${SI_OS:-}" \
        ioengine "${IOENGINE:-}" fio_version "${SI_FIO_VERSION:-}" zfs:o "${SI_ZFS_JSON:-}" \
        ceph:o "${SI_CEPH_JSON:-}" disk:o "${SI_DISK_JSON:-}" virt:o "${SI_VIRT_JSON:-}"
}

# Detect the storage below TARGET_DIR and build STORAGE_INFO (single-line JSON, < 4 KB).
# Never fails; unknown fields are omitted. STORAGE_DETECT=0 disables detection.
detect_storage() {
    local zfs_name part
    STORAGE_INFO="" SI_FS_TYPE="" SI_FS_SOURCE="" SI_ZFS_JSON="" SI_CEPH_JSON=""
    SI_ZFS_DATASET="" SI_ZFS_TYPE="" SI_ZFS_SYNC="" SI_ZFS_RECORDSIZE="" SI_ZFS_VOLBLOCKSIZE=""
    SI_ZFS_COMPRESSION="" SI_ZFS_PRIMARYCACHE="" SI_ZFS_LOGBIAS="" SI_ZFS_POOL=""
    SI_ZFS_POOL_LAYOUT="" SI_ZFS_POOL_VDEVS="" SI_CEPH_KIND="" SI_CEPH_POOL="" SI_CEPH_IMAGE=""
    SI_CEPH_OBJECT_SIZE="" SI_CEPH_DATA_POOL="" SI_CEPH_POOL_TYPE="" SI_CEPH_POOL_SIZE=""
    SI_CEPH_MIN_SIZE="" SI_DISK_JSON="" SI_DISK_NAME="" SI_VIRT_JSON="" SI_VIRT_TYPE=""
    SI_KERNEL="" SI_OS="" SI_FIO_VERSION=""
    case "${STORAGE_DETECT:-1}" in 0|false|no|off) return 0 ;; esac

    if [ "$TARGET_IS_DEVICE" = true ]; then
        SI_FS_TYPE=block
    else
        storage_fs_info "$TARGET_DIR"
    fi
    if [ "$TARGET_IS_DEVICE" = true ] || [ "$SI_FS_TYPE" = zfs ]; then
        zfs_name=$(storage_zfs_dataset "$TARGET_DIR")
        if [ -n "$zfs_name" ]; then
            if [ "$TARGET_IS_DEVICE" = true ]; then
                storage_zfs_props "$zfs_name" volume
            else
                storage_zfs_props "$zfs_name" filesystem
            fi
        fi
    fi
    if [ -z "$SI_ZFS_JSON" ]; then storage_ceph_info "$TARGET_DIR"; fi
    storage_disk_info
    storage_virt_info
    if command -v fio >/dev/null 2>&1; then
        SI_FIO_VERSION=$(si_run fio --version | head -n 1)
    fi
    SI_KERNEL=$(uname -r 2>/dev/null) SI_OS=$(uname -s 2>/dev/null)

    STORAGE_INFO=$(storage_info_json)
    # Keep the upload small: drop Ceph, disk, virtualization, then ZFS details when over 4 KB
    for part in SI_CEPH_JSON SI_DISK_JSON SI_VIRT_JSON SI_ZFS_JSON; do
        [ "$(LC_ALL=C; echo "${#STORAGE_INFO}")" -ge 4096 ] || break
        printf -v "$part" '%s' ""
        STORAGE_INFO=$(storage_info_json)
    done
    if [ "$(LC_ALL=C; echo "${#STORAGE_INFO}")" -ge 4096 ]; then
        STORAGE_INFO=$(json_object fs_type "$SI_FS_TYPE" os "$SI_OS" ioengine "${IOENGINE:-}")
    fi
}

# True when two sizes (16K, 16k, 16384, 1M ...) are the same number of bytes
storage_size_matches() {
    local a b
    a=$(fio_size_to_bytes "$1") || return 1
    b=$(fio_size_to_bytes "$2") || return 1
    [ "$a" = "$b" ]
}

# Compare DRIVE_MODEL / DRIVE_TYPE naming conventions with the detected storage.
# Warnings only (never aborts); count in STORAGE_WARNINGS.
# DRIVE_TYPE layout (mirror, raidz, raidz1-3, draid, draid1-3, stripe; lower case in $1)
# against the detected pool layout: "raidz"/"draid" alone match any raidz/draid parity
storage_pool_layout_check() {
    local type=$1 want vdevs re='(draid[1-3]?|raidz[1-3]?|mirror|stripe)'
    [ -n "${SI_ZFS_POOL_LAYOUT:-}" ] || return 0
    [[ "$type" =~ $re ]] || return 0
    want=${BASH_REMATCH[1]}
    case "$want:$SI_ZFS_POOL_LAYOUT" in
        raidz:raidz[123]|draid:draid*) return 0 ;;
    esac
    if [ "$want" = "$SI_ZFS_POOL_LAYOUT" ]; then return 0; fi
    vdevs="${SI_ZFS_POOL_VDEVS:-?} vdevs"
    if [ "${SI_ZFS_POOL_VDEVS:-}" = 1 ]; then vdevs="1 vdev"; fi
    print_warning "DRIVE_TYPE '$DRIVE_TYPE' but pool $SI_ZFS_POOL is $SI_ZFS_POOL_LAYOUT ($vdevs)"
    STORAGE_WARNINGS=$((STORAGE_WARNINGS + 1))
}

storage_plausibility_checks() {
    local model type proto want tag detected
    STORAGE_WARNINGS=0
    case "${STORAGE_DETECT:-1}" in 0|false|no|off) return 0 ;; esac
    model=$(printf '%s' "$DRIVE_MODEL" | tr '[:upper:]' '[:lower:]')
    type=$(printf '%s' "$DRIVE_TYPE" | tr '[:upper:]' '[:lower:]')
    proto=$(printf '%s' "$PROTOCOL" | tr '[:upper:]' '[:lower:]')

    # Sync / recordsize / volblocksize tags are only checked when a ZFS dataset was detected
    if [ -n "$SI_ZFS_DATASET" ]; then
        want=""
        case "$model" in
            *syncoff*) want=disabled ;;
            *syncalways*|*syncall*) want=always ;;
            *syncstandard*|*syncstd*) want=standard ;;
        esac
        if [ -n "$want" ] && [ -n "$SI_ZFS_SYNC" ] && [ "$SI_ZFS_SYNC" != "$want" ]; then
            print_warning "DRIVE_MODEL '$DRIVE_MODEL' implies ZFS sync=$want, but $SI_ZFS_DATASET has sync=$SI_ZFS_SYNC"
            STORAGE_WARNINGS=$((STORAGE_WARNINGS + 1))
        fi
        for tag in rs vbs; do
            [[ "$model" =~ (^|[^a-z0-9])${tag}([0-9]+[km])([^a-z0-9]|$) ]] || continue
            want=${BASH_REMATCH[2]}
            if [ "$tag" = rs ]; then detected=$SI_ZFS_RECORDSIZE; else detected=$SI_ZFS_VOLBLOCKSIZE; fi
            if [ -n "$detected" ] && ! storage_size_matches "$want" "$detected"; then
                if [ "$tag" = rs ]; then tag=recordsize; else tag=volblocksize; fi
                print_warning "DRIVE_MODEL '$DRIVE_MODEL' implies ZFS $tag=$want, but $SI_ZFS_DATASET has $tag=$detected"
                STORAGE_WARNINGS=$((STORAGE_WARNINGS + 1))
            fi
        done
        # The pool is visible here, so the layout is compared even for vm- types
        storage_pool_layout_check "$type"
    fi

    # ZFS pool layouts in DRIVE_TYPE on local storage that is not ZFS
    # (skipped for vm- types and network protocols: the client cannot see the server's ZFS)
    case "$type" in *mirror*|*raidz*|*draid*) ;; *) return 0 ;; esac
    case "$type" in vm-*) return 0 ;; esac
    case "$proto" in ""|local|unknown) ;; *) return 0 ;; esac
    if [ "$TARGET_IS_DEVICE" = true ]; then
        if [ "$SI_ZFS_TYPE" != volume ]; then
            print_warning "DRIVE_TYPE '$DRIVE_TYPE' suggests ZFS, but block device $TARGET_DIR is not a zvol"
            STORAGE_WARNINGS=$((STORAGE_WARNINGS + 1))
        fi
        return 0
    fi
    case "$SI_FS_TYPE" in ""|zfs|nfs*|cifs|smb*|ceph|fuse*|9p|virtiofs) return 0 ;; esac
    print_warning "DRIVE_TYPE '$DRIVE_TYPE' suggests ZFS, but $TARGET_DIR is on $SI_FS_TYPE"
    STORAGE_WARNINGS=$((STORAGE_WARNINGS + 1))
}

# Append "key=value" to SI_TOKENS (value quoted when it contains spaces; skipped if empty)
si_token() {
    local value=${2//[[:cntrl:]]/}  # printed to the terminal: strip escape sequences
    if [ -z "$value" ]; then return 0; fi
    case "$value" in
        *" "*) SI_TOKENS+=("$1=\"$value\"") ;;
        *) SI_TOKENS+=("$1=$value") ;;
    esac
}

# Every detected value as summary tokens in SI_TOKENS
storage_summary_tokens() {
    local dmi
    SI_TOKENS=()
    si_token fs "${SI_FS_TYPE:-}"
    if [ -n "${SI_ZFS_DATASET:-}" ]; then
        si_token zfs "$SI_ZFS_DATASET"
        if [ "${SI_ZFS_TYPE:-}" = volume ]; then SI_TOKENS+=("(zvol)"); fi
        si_token sync "${SI_ZFS_SYNC:-}"
        si_token recordsize "${SI_ZFS_RECORDSIZE:-}"
        si_token volblocksize "${SI_ZFS_VOLBLOCKSIZE:-}"
        si_token compression "${SI_ZFS_COMPRESSION:-}"
        si_token primarycache "${SI_ZFS_PRIMARYCACHE:-}"
        si_token logbias "${SI_ZFS_LOGBIAS:-}"
        si_token pool "${SI_ZFS_POOL:-}"
        si_token layout "${SI_ZFS_POOL_LAYOUT:-}"
        si_token vdevs "${SI_ZFS_POOL_VDEVS:-}"
    fi
    if [ -n "${SI_CEPH_KIND:-}" ]; then
        si_token ceph "$SI_CEPH_KIND"
        si_token pool "${SI_CEPH_POOL:-}"
        si_token image "${SI_CEPH_IMAGE:-}"
        si_token object_size "${SI_CEPH_OBJECT_SIZE:-}"
        si_token data_pool "${SI_CEPH_DATA_POOL:-}"
        si_token pool_type "${SI_CEPH_POOL_TYPE:-}"
        si_token pool_size "${SI_CEPH_POOL_SIZE:-}"
        si_token min_size "${SI_CEPH_MIN_SIZE:-}"
    fi
    if [ -n "${SI_DISK_NAME:-}" ]; then
        si_token disk "$SI_DISK_NAME"
        si_token model "${SI_DISK_MODEL:-}"
        si_token vendor "${SI_DISK_VENDOR:-}"
        si_token serial "${SI_DISK_SERIAL:-}"
        si_token tran "${SI_DISK_TRAN:-}"
        si_token driver "${SI_DISK_DRIVER:-}"
        si_token rotational "${SI_DISK_ROTA:-}"
        si_token size "${SI_DISK_SIZE:-}"
    fi
    if [ -n "${SI_VIRT_TYPE:-}" ]; then
        si_token virt "$SI_VIRT_TYPE"
        dmi="${SI_VIRT_VENDOR:-} ${SI_VIRT_PRODUCT:-}"
        dmi=${dmi# }
        si_token dmi "${dmi% }"
    fi
    si_token kernel "${SI_KERNEL:-}"
    si_token ioengine "${IOENGINE:-}"
    si_token fio "${SI_FIO_VERSION#fio-}"
}

# Description of the detected storage for show_config's "Storage:" line, wrapped at
# 110 columns (including the 14-column label) onto lines indented by 14 spaces
storage_summary() {
    local out="" line="" tok pad="              "
    case "${STORAGE_DETECT:-1}" in 0|false|no|off) echo "detection disabled (STORAGE_DETECT=0)"; return 0 ;; esac
    storage_summary_tokens
    for tok in ${SI_TOKENS[@]+"${SI_TOKENS[@]}"}; do
        if [ -z "$line" ]; then
            line=$tok
        elif [ $(( ${#pad} + ${#line} + 1 + ${#tok} )) -gt 110 ]; then
            out+="$line"$'\n'"$pad"
            line=$tok
        else
            line+=" $tok"
        fi
    done
    echo "${out}${line:-unknown}"
}

# Function to run FIO test


# Function to strip non-JSON prefix lines from FIO output
# FIO may write "note:" or other warning lines before the JSON content
sanitize_fio_json() {
    local json_file=$1
    if [ ! -f "$json_file" ]; then return 1; fi

    # Check if the file starts with '{' (valid JSON)
    local first_char
    first_char=$(head -c 1 "$json_file" 2>/dev/null)
    if [ "$first_char" = "{" ]; then return 0; fi

    # Find the first line starting with '{' and strip everything before it
    local json_start
    json_start=$(grep -n '^{' "$json_file" 2>/dev/null | head -1 | cut -d: -f1)
    if [ -z "$json_start" ]; then
        print_warning "No JSON content found in FIO output: $json_file"
        return 1
    fi

    # Keep only from the JSON start line onwards
    local tmp_file="${json_file}.tmp"
    tail -n +"$json_start" "$json_file" > "$tmp_file" && mv "$tmp_file" "$json_file"
    return 0
}

# Data file base name: stable per test size when PREFILL=1 (files are reused), else the per-test name
data_file_base() {
    local default_base=$1 test_size=$2
    if [ "$PREFILL" = 1 ]; then
        echo "fio_data_${test_size}"
    else
        echo "$default_base"
    fi
}

# Build fio file-target arguments into FIO_TARGET_ARGS for a data file base name
build_fio_target_args() {
    local base=$1
    if [ "$TARGET_IS_DEVICE" = true ]; then
        FIO_TARGET_ARGS=(--filename="$TARGET_DIR")
    elif [ "$FILE_PER_JOB" = 1 ]; then
        # Literal $jobnum is expanded by fio: <base>.0 .. <base>.(numjobs-1)
        FIO_TARGET_ARGS=(--directory="$TARGET_DIR" --filename_format="${base}.\$jobnum")
    else
        FIO_TARGET_ARGS=(--filename="${TARGET_DIR}/${base}")
    fi
}

# Remove per-test data files (skipped for devices and PREFILL, which reuses files until cleanup)
remove_test_files() {
    local base=$1
    if [ "$TARGET_IS_DEVICE" = true ] || [ "$PREFILL" = 1 ]; then
        return 0
    fi
    rm -f "${TARGET_DIR}/${base}" 2>/dev/null || true
    if [ "$FILE_PER_JOB" = 1 ]; then
        rm -f "${TARGET_DIR}/${base}."* 2>/dev/null || true
    fi
}

# Write missing test data files once with incompressible data (PREFILL=1 only)
# Avoids reads from unwritten/fallocated extents and ZFS compression of zero data.
prefill_test_files() {
    local base=$1 test_size=$2 num_jobs=$3 direct=$4
    if [ "$PREFILL" != 1 ] || [ "$TARGET_IS_DEVICE" = true ]; then
        return 0
    fi

    # One fio job per missing file, so existing files are not rewritten
    local -a job_args=() files=()
    local j
    if [ "$FILE_PER_JOB" = 1 ]; then
        for ((j=0; j<num_jobs; j++)); do
            if [ ! -f "${TARGET_DIR}/${base}.${j}" ]; then
                files+=("${TARGET_DIR}/${base}.${j}")
                job_args+=(--name="prefill_${j}" --filename="${TARGET_DIR}/${base}.${j}")
            fi
        done
    elif [ ! -f "${TARGET_DIR}/${base}" ]; then
        files+=("${TARGET_DIR}/${base}")
        job_args+=(--name=prefill --filename="${TARGET_DIR}/${base}")
    fi
    if [ ${#files[@]} -eq 0 ]; then
        return 0
    fi

    print_status "Prefilling ${#files[@]} test file(s) ${base} (${test_size} each) with incompressible data..."
    local error_file
    error_file=$(mktemp "${TMPDIR:-/tmp}/fio_prefill_error.XXXXXX")
    if fio --rw=write --bs=1M --size="$test_size" --refill_buffers --randrepeat=0 \
        --end_fsync=1 --ioengine="$IOENGINE" --direct="$direct" --thread --group_reporting \
        "${job_args[@]}" >/dev/null 2>"$error_file"; then
        rm -f "$error_file"
        return 0
    fi

    print_error "Prefill failed for ${base}"
    head -5 "$error_file" 2>/dev/null | while IFS= read -r line; do
        print_error "    $line"
    done
    rm -f "$error_file" "${files[@]}"
    return 1
}

# Copy a fio JSON result into KEEP_JSON_DIR (keeps basename; suffix only on collision)
keep_json_copy() {
    local json_file=$1
    if [ -z "$KEEP_JSON_DIR" ]; then
        return 0
    fi
    if ! mkdir -p "$KEEP_JSON_DIR"; then
        print_warning "Cannot create KEEP_JSON_DIR: $KEEP_JSON_DIR"
        return 0
    fi
    local name dest n=1
    name=$(basename "$json_file")
    dest="${KEEP_JSON_DIR}/${name}"
    while [ -e "$dest" ]; do
        dest="${KEEP_JSON_DIR}/${name%.json}_${n}.json"
        n=$((n + 1))
    done
    cp "$json_file" "$dest" || print_warning "Failed to copy $json_file to $KEEP_JSON_DIR"
}

# First transient fio error line in a stderr file: EAGAIN (e.g. io_uring reads ending at the end of the file)
transient_fio_error_line() {
    grep -m1 -E 'Resource temporarily unavailable|EAGAIN|err=11/' "$1" 2>/dev/null
}

is_transient_fio_error() {
    [ -n "$(transient_fio_error_line "$1")" ]
}

# Run fio with the given arguments; retry up to FIO_RETRY_MAX times on transient EAGAIN errors.
# Usage: run_fio_with_retry <label> <error_file> <fio args...>  (stderr of the last attempt stays in error_file)
run_fio_with_retry() {
    local label=$1 error_file=$2
    shift 2
    local attempt=0 rc
    while :; do
        fio "$@" 2>"$error_file" && return 0
        rc=$?
        if [ "$attempt" -ge "$FIO_RETRY_MAX" ] || ! is_transient_fio_error "$error_file"; then
            return "$rc"
        fi
        attempt=$((attempt + 1))
        FIO_RETRY_COUNT=$((FIO_RETRY_COUNT + 1))
        print_warning "Transient fio error in ${label}, retry ${attempt}/${FIO_RETRY_MAX} in 5s: $(transient_fio_error_line "$error_file" | tr -d '\000-\037\\')"
        sleep 5
    done
}

# Report how many fio runs needed a retry, so the underlying problem stays visible
print_retry_summary() {
    if [ "$FIO_RETRY_COUNT" -gt 0 ]; then
        print_warning "Transient fio errors (EAGAIN) were retried ${FIO_RETRY_COUNT} time(s). Results are from the successful attempt."
        print_warning "  If this keeps happening with io_uring, try IOENGINE=libaio."
    fi
}

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
    local error_file
    error_file=$(mktemp "${TMPDIR:-/tmp}/fio_error.XXXXXX") || return 1
    
    # Determine file target based on target type (device vs directory) and PREFILL/FILE_PER_JOB
    local data_base
    data_base=$(data_file_base "fio_test_${pattern}_${block_size}" "$test_size")
    build_fio_target_args "$data_base"
    if ! prefill_test_files "$data_base" "$test_size" "$num_jobs" "$direct"; then
        rm -f "$error_file"
        return 1
    fi

    run_fio_with_retry "${pattern} ${block_size}" "$error_file" \
        --name="hostname:${HOSTNAME},protocol:${PROTOCOL},drivetype:${DRIVE_TYPE},drivemodel:${DRIVE_MODEL}" \
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
        "${FIO_TARGET_ARGS[@]}" \
        --output-format=json \
        --output="$output_file" \
        --ioengine="$IOENGINE" \
        --norandommap \
        --randrepeat=0 \
        --thread "${FIO_EXTRA_ARGS_ARR[@]}"

    local fio_exit_code=$?

    # Clean up test file (only for directory mode, not device mode; PREFILL keeps files)
    remove_test_files "$data_base"

    if [ $fio_exit_code -eq 0 ]; then
        # Strip any non-JSON prefix lines (e.g., FIO "note:" warnings)
        sanitize_fio_json "$output_file"
        keep_json_copy "$output_file"
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

    # Use jq if available, otherwise fall back to grep (normal mode may not require jq)
    local read_iops write_iops
    if command -v jq &> /dev/null; then
        read_iops=$(jq -r '.jobs[0].read.iops // 0' "$json_file" 2>/dev/null)
        write_iops=$(jq -r '.jobs[0].write.iops // 0' "$json_file" 2>/dev/null)
    else
        read_iops=$(grep -E '"iops"\s*:' "$json_file" 2>/dev/null | head -1 | awk -F: '{print $2}' | tr -d ' ,' || echo "0")
        write_iops=$(grep -E '"iops"\s*:' "$json_file" 2>/dev/null | head -2 | tail -1 | awk -F: '{print $2}' | tr -d ' ,' || echo "0")
    fi

    local total_iops
    total_iops=$(awk "BEGIN {printf \"%.0f\", ${read_iops:-0} + ${write_iops:-0}}" 2>/dev/null || echo "0")

    read_iops=$(printf "%.0f" "${read_iops:-0}" 2>/dev/null || echo "0")
    write_iops=$(printf "%.0f" "${write_iops:-0}" 2>/dev/null || echo "0")

    echo "$read_iops|$write_iops|$total_iops"
}

# Function to display IOPS information
# Function to extract avg completion latency from FIO JSON (ns -> ms)
extract_avg_clat_ms() {
    local json_file=$1
    local section=$2  # "read" or "write"

    if [ ! -f "$json_file" ]; then echo "-"; return; fi

    local clat_mean_ns
    clat_mean_ns=$(jq -r ".jobs[0].${section}.clat_ns.mean // empty" "$json_file" 2>/dev/null)

    if [ -z "$clat_mean_ns" ] || [ "$clat_mean_ns" = "null" ]; then
        echo "-"
        return
    fi

    awk "BEGIN {printf \"%.2f\", $clat_mean_ns / 1000000}" 2>/dev/null || echo "-"
}

# Function to extract P70 completion latency from FIO JSON (ns -> ms)
extract_p70_clat_ms() {
    local json_file=$1
    local pattern=$2

    if [ ! -f "$json_file" ]; then echo "-"; return; fi

    local section
    if [ "$pattern" = "randread" ] || [ "$pattern" = "read" ]; then section="read"; else section="write"; fi

    local p70_ns
    p70_ns=$(jq -r ".jobs[0].${section}.clat_ns.percentile[\"70.000000\"] // empty" "$json_file" 2>/dev/null)

    if [ -z "$p70_ns" ] || [ "$p70_ns" = "null" ]; then
        echo "-"
        return
    fi

    awk "BEGIN {printf \"%.2f\", $p70_ns / 1000000}" 2>/dev/null || echo "-"
}

# Function to extract P99 completion latency from FIO JSON (ns -> ms)
extract_p99_clat_ms() {
    local json_file=$1
    local pattern=$2

    if [ ! -f "$json_file" ]; then echo "-"; return; fi

    local section
    if [ "$pattern" = "randread" ] || [ "$pattern" = "read" ]; then section="read"; else section="write"; fi

    local p99_ns
    p99_ns=$(jq -r ".jobs[0].${section}.clat_ns.percentile[\"99.000000\"] // empty" "$json_file" 2>/dev/null)

    if [ -z "$p99_ns" ] || [ "$p99_ns" = "null" ]; then
        echo "-"
        return
    fi

    awk "BEGIN {printf \"%.2f\", $p99_ns / 1000000}" 2>/dev/null || echo "-"
}

display_iops() {
    local json_file=$1
    local test_name=$2

    local iops_data=$(extract_iops "$json_file")
    if [ -z "$iops_data" ] || [ "$iops_data" = "0|0|0" ]; then
        return 0  # Skip if no IOPS data available
    fi

    IFS='|' read -r read_iops write_iops total_iops <<< "$iops_data"

    # Determine the active pattern section for latency extraction
    local lat_section="read"
    if [ "$read_iops" = "0" ] && [ "$write_iops" != "0" ]; then
        lat_section="write"
    fi

    # Determine the pattern name for percentile extraction
    # The test_name is like "randread_4k" - extract the pattern part
    local pat_name
    pat_name=$(echo "$test_name" | cut -d'_' -f1)

    local avg_lat=$(extract_avg_clat_ms "$json_file" "$lat_section")
    local p70_lat=$(extract_p70_clat_ms "$json_file" "$pat_name")
    local p95_lat=$(extract_p95_clat_ms "$json_file" "$pat_name")
    local p99_lat=$(extract_p99_clat_ms "$json_file" "$pat_name")
    local bw_mbs=$(extract_bw_mbs "$json_file" "$pat_name")

    # Display IOPS + latency + bandwidth
    echo -e "  ${YELLOW}IOPS${NC}: Read=${read_iops}  Write=${write_iops}  Total=${total_iops}"
    echo -e "  ${CYAN}Latency${NC}: avg=${avg_lat}ms  P70=${p70_lat}ms  P95=${p95_lat}ms  P99=${p99_lat}ms"
    echo -e "  ${BLUE}Bandwidth${NC}: ${bw_mbs} MB/s"
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

    # Saturation uploads carry the P95 threshold so the server can summarize saturation points
    # (older servers ignore the extra field)
    local -a extra_fields=()
    if [ "$SATURATION_MODE" = true ]; then
        extra_fields+=(--form-string "latency_threshold_ms=$LATENCY_THRESHOLD_MS")
    fi
    # Detected storage configuration (JSON); --form-string so '@'/'<' are never read as files
    if [ -n "${STORAGE_INFO:-}" ]; then
        extra_fields+=(--form-string "storage_info=$STORAGE_INFO")
    fi

    response=$(curl -s -w "%{http_code}" \
        -X POST \
        -u "$USERNAME:$PASSWORD" \
        -F "file=@$json_file" \
        --form-string "drive_model=$DRIVE_MODEL" \
        --form-string "drive_type=$DRIVE_TYPE" \
        --form-string "hostname=$HOSTNAME" \
        --form-string "protocol=$PROTOCOL" \
        --form-string "description=$DESCRIPTION" \
        --form-string "date=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --form-string "config_uuid=$CONFIG_UUID" \
        --form-string "run_uuid=$RUN_UUID" \
        "${extra_fields[@]}" \
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
    # Only clean up test files if using directory mode
    if [ "$TARGET_IS_DEVICE" != true ]; then
        rm -f "${TARGET_DIR}/fio_test_"*
        rm -f "${TARGET_DIR}/fio_saturation_"* 2>/dev/null || true
        rm -f "${TARGET_DIR}/fio_data_"* 2>/dev/null || true
    fi
    rm -f /tmp/fio_results_*.json
    rm -f /tmp/fio_sat_*.json 2>/dev/null || true
}

# ============================================================
# Saturation Test Functions (used with --saturation flag)
# ============================================================

# Function to run a single FIO saturation step
run_fio_step() {
    local pattern=$1
    local iodepth=$2
    local num_jobs=$3
    local output_file=$4
    local block_size=${5:-$SAT_CURRENT_BS}

    local total_qd=$((iodepth * num_jobs))
    print_step "Running ${pattern} bs=${block_size} | iodepth=${iodepth} numjobs=${num_jobs} (Total QD: ${total_qd})"

    local error_file
    error_file=$(mktemp "${TMPDIR:-/tmp}/fio_sat_error.XXXXXX") || return 1

    # Per-job file size (capped by SAT_MAX_TOTAL_SIZE with FILE_PER_JOB=1)
    sat_step_size "$num_jobs"
    local step_size=$SAT_STEP_SIZE
    if sat_cap_active; then
        print_status "  per-job file size: ${step_size} (cap ${SAT_MAX_TOTAL_SIZE} / ${num_jobs} jobs, test size ${SAT_TEST_SIZE})"
    fi

    local data_base
    data_base=$(data_file_base "fio_saturation_${pattern}_${block_size}_${iodepth}_${num_jobs}" "$step_size")
    sat_drop_stale_prefill "$data_base"
    build_fio_target_args "$data_base"
    if ! prefill_test_files "$data_base" "$step_size" "$num_jobs" "$SAT_DIRECT"; then
        return 1
    fi

    run_fio_with_retry "${pattern} bs=${block_size} QD=${total_qd}" "$error_file" \
        --name="hostname:${HOSTNAME},protocol:${PROTOCOL},drivetype:${DRIVE_TYPE},drivemodel:${DRIVE_MODEL}" \
        --description="${DESCRIPTION}" \
        --rw="$pattern" \
        --bs="$block_size" \
        --size="$step_size" \
        --numjobs="$num_jobs" \
        --runtime="$SAT_RUNTIME" \
        --time_based \
        --group_reporting \
        --iodepth="$iodepth" \
        --direct="$SAT_DIRECT" \
        --sync="$SAT_SYNC" \
        "${FIO_TARGET_ARGS[@]}" \
        --output-format=json \
        --output="$output_file" \
        --ioengine="$IOENGINE" \
        --norandommap \
        --randrepeat=0 \
        --thread "${FIO_EXTRA_ARGS_ARR[@]}"

    local fio_exit_code=$?

    remove_test_files "$data_base"

    if [ $fio_exit_code -eq 0 ]; then
        # Strip any non-JSON prefix lines (e.g., FIO "note:" warnings)
        sanitize_fio_json "$output_file"
        keep_json_copy "$output_file"
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

    if [ ! -f "$json_file" ]; then
        echo "ERR"
        return 1
    fi

    local section
    if [ "$pattern" = "randread" ] || [ "$pattern" = "read" ]; then section="read"; else section="write"; fi

    local p95_ns
    p95_ns=$(jq -r ".jobs[0].${section}.clat_ns.percentile[\"95.000000\"] // empty" "$json_file" 2>/dev/null)

    if [ -z "$p95_ns" ] || [ "$p95_ns" = "null" ]; then
        echo "ERR"
        return 1
    fi

    if [ "$p95_ns" = "0" ]; then
        echo "0"
        return 1
    fi

    awk "BEGIN {printf \"%.2f\", $p95_ns / 1000000}"
    return 0
}

# Function to extract IOPS from FIO JSON for a specific pattern
extract_iops_value() {
    local json_file=$1
    local pattern=$2

    if [ ! -f "$json_file" ]; then
        echo "ERR"
        return 1
    fi

    local section
    if [ "$pattern" = "randread" ] || [ "$pattern" = "read" ]; then section="read"; else section="write"; fi

    local iops
    iops=$(jq -r ".jobs[0].${section}.iops // empty" "$json_file" 2>/dev/null)

    # Validate numeric (integer or float)
    if [ -z "$iops" ] || [ "$iops" = "null" ] || ! [[ "$iops" =~ ^[0-9]+\.?[0-9]*$ ]]; then
        echo "ERR"
        return 1
    fi

    printf "%.0f" "$iops" 2>/dev/null || echo "ERR"
}

# Function to extract bandwidth from FIO JSON (bytes/s -> MB/s)
extract_bw_mbs() {
    local json_file=$1
    local pattern=$2

    if [ ! -f "$json_file" ]; then
        echo "ERR"
        return 1
    fi

    local section
    if [ "$pattern" = "randread" ] || [ "$pattern" = "read" ]; then section="read"; else section="write"; fi

    local bw_bytes
    bw_bytes=$(jq -r ".jobs[0].${section}.bw_bytes // empty" "$json_file" 2>/dev/null)

    # Validate numeric
    if [ -z "$bw_bytes" ] || [ "$bw_bytes" = "null" ] || ! [[ "$bw_bytes" =~ ^[0-9]+$ ]]; then
        echo "ERR"
        return 1
    fi

    awk "BEGIN {printf \"%.2f\", $bw_bytes / 1048576}" 2>/dev/null || echo "ERR"
}

# Saturation result arrays (global) — generic for any number of patterns
declare -a SAT_RESULTS_STEP

# Per-pattern state arrays (indexed by position in SAT_PATTERNS_ARR)
declare -a SAT_P_IODEPTH SAT_P_NUMJOBS SAT_P_ESC_COUNT
declare -a SAT_P_SATURATED SAT_P_STEP SAT_P_FAIL_COUNT
declare -a SAT_P_BEST_IOPS SAT_P_BEST_QD
declare -a SAT_P_SAT_STEP
# Per-pattern result arrays created dynamically via sat_r_init()

# Determine JSON section for extraction: "read" or "write"
# read/randread -> "read" section
# write/randwrite -> "write" section
# rw/randrw -> both sections (caller handles read+write separately)
sat_extract_key() {
    case "$1" in
        read|randread)   echo "read" ;;
        write|randwrite) echo "write" ;;
        *)               echo "$1" ;;
    esac
}

# Check if a pattern is mixed (rw/randrw) — produces both read and write in FIO output
sat_is_mixed() {
    case "$1" in
        rw|randrw) return 0 ;;
        *)         return 1 ;;
    esac
}

# --- Result array helpers (eval-based, safe: pi is always 0-5) ---

# Initialize result arrays for pattern index pi
sat_r_init() {
    local pi=$1
    eval "SAT_R${pi}_QD=()"
    eval "SAT_R${pi}_IOPS=()"
    eval "SAT_R${pi}_P95=()"
    eval "SAT_R${pi}_BW=()"
}

# Append a value to a result array: sat_r_append <pi> <field> <value>
sat_r_append() {
    local pi=$1 field=$2 value=$3
    eval "SAT_R${pi}_${field}+=(\"\$value\")"
}

# Get a value from a result array: sat_r_get <pi> <field> <index>
sat_r_get() {
    local pi=$1 field=$2 idx=$3
    eval "echo \"\${SAT_R${pi}_${field}[\$idx]}\""
}

# Get length of a result array: sat_r_len <pi> <field>
sat_r_len() {
    local pi=$1 field=$2
    eval "echo \${#SAT_R${pi}_${field}[@]}"
}

# Reset saturation result arrays (called between block size runs)
reset_sat_results() {
    SAT_RESULTS_STEP=()
    local n=${#SAT_PATTERNS_ARR[@]}
    for ((pi=0; pi<n; pi++)); do
        sat_r_init "$pi"
        SAT_P_SAT_STEP[$pi]=-1
    done
}

# Main saturation loop — each pattern escalates independently
# Supports any combination of patterns: read, randread, write, randwrite, rw, randrw
saturation_loop() {
    local block_size=${1:-4k}
    SAT_CURRENT_BS="$block_size"
    local step=0
    local n=${#SAT_PATTERNS_ARR[@]}
    local MAX_CONSECUTIVE_FAILURES=3

    # Initialize per-pattern state arrays
    # Escalation strategy: prefer iodepth over numjobs (3:1 ratio)
    # iodepth is cheap (just queue depth per job), numjobs is expensive (processes/shm)
    # Exception: sync engines (psync/sync/vsync) ignore iodepth, so we only escalate numjobs
    if [ "$IS_SYNC_ENGINE" = true ]; then
        INITIAL_IODEPTH=1
        print_warning "Sync engine ($IOENGINE) detected - forcing iodepth=1, escalating numjobs only"
    fi
    for ((pi=0; pi<n; pi++)); do
        SAT_P_IODEPTH[$pi]=$INITIAL_IODEPTH
        SAT_P_NUMJOBS[$pi]=$INITIAL_NUMJOBS
        SAT_P_ESC_COUNT[$pi]=0
        SAT_P_SATURATED[$pi]=false
        SAT_P_STEP[$pi]=0
        SAT_P_FAIL_COUNT[$pi]=0
        SAT_P_BEST_IOPS[$pi]=0
        SAT_P_BEST_QD[$pi]=0
    done

    local active_patterns="${SAT_PATTERNS_ARR[*]}"

    echo
    print_status "Starting saturation test loop [$(sat_run_label "$block_size")]..."
    print_status "Patterns: ${active_patterns// /, } (independent QD escalation)"
    print_status "Threshold: P95 completion latency > ${LATENCY_THRESHOLD_MS}ms"
    print_status "Max steps: $MAX_STEPS | Max QD: $MAX_TOTAL_QD | Runtime per step: ${SAT_RUNTIME}s"
    echo

    while [ $step -lt $MAX_STEPS ]; do
        step=$((step + 1))

        # Check if all patterns are already saturated
        local all_saturated=true
        for ((pi=0; pi<n; pi++)); do
            if [ "${SAT_P_SATURATED[$pi]}" = false ]; then
                all_saturated=false
                break
            fi
        done
        if [ "$all_saturated" = true ]; then
            echo
            print_success "All patterns have reached saturation. Stopping."
            break
        fi

        echo
        echo "========================================="
        print_step "STEP $step [$(sat_run_label "$block_size")]"
        for ((pi=0; pi<n; pi++)); do
            if [ "${SAT_P_SATURATED[$pi]}" = false ]; then
                local total_qd=$((SAT_P_IODEPTH[$pi] * SAT_P_NUMJOBS[$pi]))
                printf "  %-10s iodepth=%s, numjobs=%s (QD: %s)\n" \
                    "${SAT_PATTERNS_ARR[$pi]}:" "${SAT_P_IODEPTH[$pi]}" "${SAT_P_NUMJOBS[$pi]}" "$total_qd"
            fi
        done
        echo "========================================="

        SAT_RESULTS_STEP+=("$step")

        # --- Process each pattern independently ---
        for ((pi=0; pi<n; pi++)); do
            local pattern="${SAT_PATTERNS_ARR[$pi]}"
            local p_iodepth=${SAT_P_IODEPTH[$pi]}
            local p_numjobs=${SAT_P_NUMJOBS[$pi]}
            local p_total_qd=$((p_iodepth * p_numjobs))

            if [ "${SAT_P_SATURATED[$pi]}" = false ]; then
                SAT_P_STEP[$pi]=$((SAT_P_STEP[$pi] + 1))
                local p_step=${SAT_P_STEP[$pi]}
                sat_r_append "$pi" QD "$p_total_qd"

                local output_file="/tmp/fio_sat_${pattern}_step${step}_$$.json"
                if run_fio_step "$pattern" "$p_iodepth" "$p_numjobs" "$output_file"; then
                    # Extract metrics — mixed patterns (rw/randrw) need combined extraction
                    local p_iops p_p95 p_bw
                    local p_r_iops="" p_w_iops=""  # For mixed display

                    if sat_is_mixed "$pattern"; then
                        # Combined extraction for mixed patterns
                        p_r_iops=$(extract_iops_value "$output_file" "read")
                        p_w_iops=$(extract_iops_value "$output_file" "write")
                        p_iops=0
                        if [ "$p_r_iops" != "ERR" ] && [ "$p_w_iops" != "ERR" ]; then
                            p_iops=$((p_r_iops + p_w_iops))
                        elif [ "$p_r_iops" != "ERR" ]; then
                            p_iops=$p_r_iops
                        elif [ "$p_w_iops" != "ERR" ]; then
                            p_iops=$p_w_iops
                        else
                            p_iops="ERR"
                        fi

                        # Use worst P95 of read/write
                        local p_r_p95=$(extract_p95_clat_ms "$output_file" "read")
                        local p_w_p95=$(extract_p95_clat_ms "$output_file" "write")
                        p_p95="ERR"
                        if [ "$p_r_p95" != "ERR" ] && [ "$p_w_p95" != "ERR" ]; then
                            local use_write
                            use_write=$(awk "BEGIN {print ($p_w_p95 > $p_r_p95) ? 1 : 0}" 2>/dev/null)
                            if [ "$use_write" = "1" ]; then p_p95=$p_w_p95; else p_p95=$p_r_p95; fi
                        elif [ "$p_r_p95" != "ERR" ]; then
                            p_p95=$p_r_p95
                        elif [ "$p_w_p95" != "ERR" ]; then
                            p_p95=$p_w_p95
                        fi

                        local p_bw_r=$(extract_bw_mbs "$output_file" "read")
                        local p_bw_w=$(extract_bw_mbs "$output_file" "write")
                        p_bw="ERR"
                        if [ "$p_bw_r" != "ERR" ] && [ "$p_bw_w" != "ERR" ]; then
                            p_bw=$(awk "BEGIN {printf \"%.2f\", $p_bw_r + $p_bw_w}" 2>/dev/null || echo "ERR")
                        fi
                    else
                        # Simple extraction for single-direction patterns
                        p_iops=$(extract_iops_value "$output_file" "$pattern")
                        p_p95=$(extract_p95_clat_ms "$output_file" "$pattern")
                        p_bw=$(extract_bw_mbs "$output_file" "$pattern")
                    fi

                    if [ "$p_p95" = "ERR" ] || [ "$p_iops" = "ERR" ]; then
                        SAT_P_FAIL_COUNT[$pi]=$((SAT_P_FAIL_COUNT[$pi] + 1))
                        print_warning "  ${pattern}: Failed to parse FIO JSON at step $step (${SAT_P_FAIL_COUNT[$pi]}/$MAX_CONSECUTIVE_FAILURES failures)"
                        sat_r_append "$pi" IOPS "-"
                        sat_r_append "$pi" P95 "-"
                        sat_r_append "$pi" BW "-"
                    else
                        SAT_P_FAIL_COUNT[$pi]=0
                        sat_r_append "$pi" IOPS "$p_iops"
                        sat_r_append "$pi" P95 "$p_p95"
                        sat_r_append "$pi" BW "$p_bw"

                        local p_pct
                        p_pct=$(awk "BEGIN {printf \"%.0f\", ($p_p95 / $LATENCY_THRESHOLD_MS) * 100}" 2>/dev/null || echo "?")

                        local p_is_best=""
                        if [ "$p_iops" != "ERR" ] && [ "$p_iops" -gt "${SAT_P_BEST_IOPS[$pi]}" ] 2>/dev/null; then
                            SAT_P_BEST_IOPS[$pi]=$p_iops
                            SAT_P_BEST_QD[$pi]=$p_total_qd
                            p_is_best=" ${GREEN}★ NEW BEST${NC}"
                        fi

                        local p95_color="${GREEN}"
                        if [ "$p_pct" != "?" ] && [ "$p_pct" -ge 100 ] 2>/dev/null; then p95_color="${RED}"
                        elif [ "$p_pct" != "?" ] && [ "$p_pct" -ge 70 ] 2>/dev/null; then p95_color="${YELLOW}"; fi

                        # Display results — mixed patterns show extra detail
                        if sat_is_mixed "$pattern"; then
                            echo -e "  ${GREEN}${pattern}${NC} [QD=${p_total_qd}]: IOPS=${YELLOW}${p_iops}${NC} (r:${p_r_iops} w:${p_w_iops})  BW=${p_bw}MB/s${p_is_best}"
                            local avg_r=$(extract_avg_clat_ms "$output_file" "read")
                            local avg_w=$(extract_avg_clat_ms "$output_file" "write")
                            local p70_r=$(extract_p70_clat_ms "$output_file" "read")
                            local p70_w=$(extract_p70_clat_ms "$output_file" "write")
                            local p99_r=$(extract_p99_clat_ms "$output_file" "read")
                            local p99_w=$(extract_p99_clat_ms "$output_file" "write")
                            echo -e "    Read  lat: avg=${avg_r}ms  P70=${p70_r}ms  P95=${p_r_p95}ms  P99=${p99_r}ms"
                            echo -e "    Write lat: avg=${avg_w}ms  P70=${p70_w}ms  P95=${p_w_p95}ms  P99=${p99_w}ms"
                            echo -e "    >>> ${BOLD}${p95_color}P95(worst)=${p_p95}ms${NC} <<<  [${p_pct}% of ${LATENCY_THRESHOLD_MS}ms threshold]"
                        else
                            echo -e "  ${GREEN}${pattern}${NC} [QD=${p_total_qd}]: IOPS=${YELLOW}${p_iops}${NC}  BW=${p_bw}MB/s${p_is_best}"
                            local p_avg=$(extract_avg_clat_ms "$output_file" "$(sat_extract_key "$pattern")")
                            local p_p70=$(extract_p70_clat_ms "$output_file" "$pattern")
                            local p_p99=$(extract_p99_clat_ms "$output_file" "$pattern")
                            echo -e "    Latency: avg=${p_avg}ms  P70=${p_p70}ms  >>> ${BOLD}${p95_color}P95=${p_p95}ms${NC} <<<  P99=${p_p99}ms  [${p_pct}% of ${LATENCY_THRESHOLD_MS}ms threshold]"
                        fi
                        if [ "${SAT_P_BEST_IOPS[$pi]}" -gt 0 ] 2>/dev/null; then
                            echo -e "    Best so far: ${SAT_P_BEST_IOPS[$pi]} IOPS @ QD=${SAT_P_BEST_QD[$pi]}"
                        fi

                        upload_results "$output_file" "saturation_${pattern}_step${step}_qd${p_total_qd}" || \
                            print_warning "  ${pattern}: Upload failed for step $step (continuing)"

                        local threshold_exceeded
                        threshold_exceeded=$(awk "BEGIN {print ($p_p95 > $LATENCY_THRESHOLD_MS) ? 1 : 0}")
                        if [ "$threshold_exceeded" = "1" ]; then
                            echo -e "  ${RED}▶ ${pattern} SATURATED${NC} at step $step / QD=${p_total_qd} (P95: ${p_p95}ms > ${LATENCY_THRESHOLD_MS}ms)"
                            SAT_P_SATURATED[$pi]=true
                            SAT_P_SAT_STEP[$pi]=$((p_step - 1))
                        fi
                    fi
                else
                    SAT_P_FAIL_COUNT[$pi]=$((SAT_P_FAIL_COUNT[$pi] + 1))
                    sat_r_append "$pi" IOPS "-"
                    sat_r_append "$pi" P95 "-"
                    sat_r_append "$pi" BW "-"
                    print_error "  ${pattern} test failed at step $step (${SAT_P_FAIL_COUNT[$pi]}/$MAX_CONSECUTIVE_FAILURES failures)"
                fi

                if [ ${SAT_P_FAIL_COUNT[$pi]} -ge $MAX_CONSECUTIVE_FAILURES ]; then
                    echo -e "  ${RED}▶ ${pattern} STOPPED${NC} after $MAX_CONSECUTIVE_FAILURES consecutive failures"
                    SAT_P_SATURATED[$pi]=true
                fi
                rm -f "$output_file"

                # Escalate QD if not saturated
                if [ "${SAT_P_SATURATED[$pi]}" = false ]; then
                    if [ "$IS_SYNC_ENGINE" = true ]; then
                        # Sync engines (psync/sync/vsync) ignore iodepth - only numjobs creates real QD
                        SAT_P_NUMJOBS[$pi]=$((SAT_P_NUMJOBS[$pi] * 2))
                    elif [ $((SAT_P_ESC_COUNT[$pi] % 4)) -eq 3 ]; then
                        SAT_P_NUMJOBS[$pi]=$((SAT_P_NUMJOBS[$pi] * 2))
                    else
                        SAT_P_IODEPTH[$pi]=$((SAT_P_IODEPTH[$pi] * 2))
                    fi
                    SAT_P_ESC_COUNT[$pi]=$((SAT_P_ESC_COUNT[$pi] + 1))
                    if [ $((SAT_P_IODEPTH[$pi] * SAT_P_NUMJOBS[$pi])) -gt $MAX_TOTAL_QD ]; then
                        echo -e "  ${YELLOW}${pattern} reached QD cap (${MAX_TOTAL_QD}), marking as saturated${NC}"
                        SAT_P_SATURATED[$pi]=true
                    fi
                fi
            else
                # Pattern already saturated — append placeholders
                sat_r_append "$pi" QD "-"
                sat_r_append "$pi" IOPS "-"
                sat_r_append "$pi" P95 "-"
                sat_r_append "$pi" BW "-"
                echo -e "  ${pattern}: ${YELLOW}done${NC} (saturated at QD=${SAT_P_BEST_QD[$pi]})"
            fi
        done

        # Print progress table after each step
        print_saturation_summary "$block_size"
    done

    if [ $step -ge $MAX_STEPS ]; then
        print_warning "Reached maximum steps ($MAX_STEPS) without full saturation."
    fi

    # Report patterns that never saturated
    for ((pi=0; pi<n; pi++)); do
        local pattern="${SAT_PATTERNS_ARR[$pi]}"
        if [ "${SAT_P_SATURATED[$pi]}" = false ]; then
            print_status "${pattern} did not saturate within $MAX_STEPS steps"
        fi
    done
}

# Function to print saturation summary table (shows columns for all patterns)
# Layout: Step | QD | <pattern> P95 IOPS | ... per pattern (no BW column)
print_saturation_summary() {
    local block_size=${1:-}
    local bs_label=""
    if [ -n "$block_size" ]; then bs_label=" [$(sat_run_label "$block_size")]"; fi

    local n=${#SAT_PATTERNS_ARR[@]}

    # Column widths: Step=5, QD=7, per-pattern: P95=10, IOPS=10 + separators
    local sep_len=$((5 + 3 + 7 + n * (3 + 10 + 1 + 10) + 8))

    # --- Title ---
    echo
    printf '%*s\n' "$sep_len" '' | tr ' ' '='
    printf "%*s\n" $(( (sep_len + ${#bs_label} + 24) / 2 )) "SATURATION TEST RESULTS${bs_label}"
    printf '%*s\n' "$sep_len" '' | tr ' ' '='

    # --- Two-row header: pattern names on top, P95/IOPS on bottom ---
    local top_fmt="%-5s | %-7s"
    local top_args=("" "")
    local bot_fmt="%-5s | %-7s"
    local bot_args=("Step" "QD")

    for ((pi=0; pi<n; pi++)); do
        local tag="${SAT_PATTERNS_ARR[$pi]}"
        local col_width=21  # 10 + 1 + 10
        local pad_left=$(( (col_width - ${#tag}) / 2 ))
        local pad_right=$(( col_width - pad_left ))
        top_fmt+=" | %${pad_left}s%-${pad_right}s"
        top_args+=("" "$tag")
        bot_fmt+=" | %-10s %-10s"
        bot_args+=("P95(ms)" "IOPS")
    done

    printf "${top_fmt}\n" "${top_args[@]}"
    printf "${bot_fmt}\n" "${bot_args[@]}"
    printf '%*s\n' "$sep_len" '' | tr ' ' '-'

    # --- Data rows ---
    local total_steps=${#SAT_RESULTS_STEP[@]}
    for ((si=0; si<total_steps; si++)); do
        local has_sat=false

        for ((pi=0; pi<n; pi++)); do
            if [ "${SAT_P_SAT_STEP[$pi]}" -eq "$si" ] 2>/dev/null; then has_sat=true; fi
        done

        local marker=""
        local row_color=""
        if [ "$has_sat" = true ]; then
            marker="${RED}!SAT!${NC}"
            row_color="${RED}"
        fi

        # Pick QD from first active pattern
        local step_qd="-"
        for ((pi=0; pi<n; pi++)); do
            local qd=$(sat_r_get "$pi" QD "$si")
            if [ "$qd" != "-" ] && [ -n "$qd" ]; then step_qd="$qd"; break; fi
        done

        local row_fmt="${row_color}%-5s | %-7s"
        local row_args=("${SAT_RESULTS_STEP[$si]}" "$step_qd")

        for ((pi=0; pi<n; pi++)); do
            row_fmt+=" | %-10s %-10s"
            row_args+=("$(sat_r_get "$pi" P95 "$si")" "$(sat_r_get "$pi" IOPS "$si")")
        done
        row_fmt+="${NC} %s\n"
        row_args+=("$marker")

        printf "$row_fmt" "${row_args[@]}"
    done

    printf '%*s\n' "$sep_len" '' | tr ' ' '='
    echo
    echo -e "Legend: ${RED}!SAT!${NC} = Saturation Point (P95 > ${LATENCY_THRESHOLD_MS}ms)"
    echo
}

# Run one saturation loop per (block size x sync mode), each with its own RUN_UUID.
# With several runs, every run's block size, sync mode and RUN_UUID is listed at the end.
run_saturation_runs() {
    local sat_bs sat_sync banner entry
    local -a run_uuids=()
    for sat_bs in "${SAT_BLOCK_SIZES_ARR[@]}"; do
        for sat_sync in "${SAT_SYNC_ARR[@]}"; do
            SAT_SYNC="$sat_sync"
            # Generate a fresh RUN_UUID for each run
            if command -v uuidgen &> /dev/null; then
                RUN_UUID=$(uuidgen | tr '[:upper:]' '[:lower:]')
            else
                RUN_UUID=$(generate_uuid_from_hash "${HOSTNAME}_$(date -u +%Y-%m-%dT%H:%M:%S)_${sat_bs}_${sat_sync}")
            fi
            build_description
            run_uuids+=("${sat_bs}|${sat_sync}|${RUN_UUID}")

            if [ ${#SAT_BLOCK_SIZES_ARR[@]} -gt 1 ] || [ ${#SAT_SYNC_ARR[@]} -gt 1 ]; then
                banner="Block Size: $sat_bs"
                if [ ${#SAT_SYNC_ARR[@]} -gt 1 ]; then banner+="  Sync: $sat_sync"; fi
                echo
                echo "╔══════════════════════════════════════════════════╗"
                echo "║  ${banner}  (run_uuid: ${RUN_UUID:0:8}…)"
                echo "╚══════════════════════════════════════════════════╝"
            fi
            reset_sat_results
            saturation_loop "$sat_bs"
            print_saturation_summary "$sat_bs"
        done
    done

    if [ ${#run_uuids[@]} -gt 1 ]; then
        echo "Run UUIDs:"
        for entry in "${run_uuids[@]}"; do
            IFS='|' read -r sat_bs sat_sync banner <<< "$entry"
            printf '  bs=%-8s sync=%-6s %s\n' "$sat_bs" "$sat_sync" "$banner"
        done
    fi
}

# ============================================================
# End of Saturation Test Functions
# ============================================================

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
    # Several saturation runs each generate their own RUN_UUID (listed after the runs)
    if [ "$SATURATION_MODE" = true ] && [ $(( ${#SAT_BLOCK_SIZES_ARR[@]} * ${#SAT_SYNC_ARR[@]} )) -gt 1 ]; then
        echo "Run UUID:     one per block size × sync mode (listed at the end)"
    else
        echo "Run UUID:     $RUN_UUID"
    fi
    echo "Test Size:    $TEST_SIZE"
    echo "Num Jobs:     $NUM_JOBS"
    echo "Runtime:      ${RUNTIME[*]} (max: ${max_runtime}s)"
    echo "Direct:       $DIRECT"
    echo "I/O Engine:   $IOENGINE"
    echo "I/O Depth:    $IODEPTH"
    echo "Backend URL:  $BACKEND_URL"
    if [ "$TARGET_IS_DEVICE" = true ]; then
        echo "Target:       $TARGET_DIR (BLOCK DEVICE - DESTRUCTIVE!)"
    else
        echo "Target Dir:   $TARGET_DIR"
    fi
    echo "Username:     $USERNAME"
    echo "Storage:      $(storage_summary)"
    if [ -n "$FIO_EXTRA_ARGS" ]; then
        echo "FIO Extra:    ${FIO_EXTRA_ARGS_ARR[*]}"
    fi
    if [ -n "$KEEP_JSON_DIR" ]; then
        echo "Keep JSON:    $KEEP_JSON_DIR"
    fi
    if [ "$PREFILL" = 1 ]; then
        echo "Prefill:      enabled (data files written once, reused, removed at end)"
    fi
    if [ "$FILE_PER_JOB" = 1 ]; then
        echo "File per job: enabled"
    fi
    if [ "$SATURATION_MODE" = true ]; then
        echo "-----------------------------------------"
        echo "Mode:         SATURATION TEST"
        echo "Patterns:     ${SAT_PATTERNS_ARR[*]}"
        echo "Block Sizes:  ${SAT_BLOCK_SIZES_ARR[*]}"
        if [ ${#SAT_SYNC_ARR[@]} -gt 1 ]; then
            echo "Sync Modes:   ${SAT_SYNC_ARR[*]} (one run each)"
        fi
        if sat_cap_active; then
            echo "Size Cap:     ${SAT_MAX_TOTAL_SIZE} total per step (per-job size = min(${SAT_TEST_SIZE}, cap / numjobs))"
        fi
        echo "P95 Threshold:${LATENCY_THRESHOLD_MS}ms"
        echo "Init IODepth: $INITIAL_IODEPTH"
        echo "Init NumJobs: $INITIAL_NUMJOBS"
        echo "Init Total QD:$((INITIAL_IODEPTH * INITIAL_NUMJOBS))"
        echo "Max Steps:    $MAX_STEPS"
        echo "Max Total QD: $MAX_TOTAL_QD"
    else
        echo "Block Sizes:  ${BLOCK_SIZES[*]}"
        echo "Patterns:     ${TEST_PATTERNS[*]}"
    fi
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
    echo "EAGAIN retries:   $FIO_RETRY_COUNT"
    
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
            -i|--engine)
                if [ -z "$2" ] || [[ "$2" =~ ^- ]]; then
                    print_error "Option $1 requires an engine name (io_uring, aio, libaio, psync)"
                    exit 1
                fi
                CLI_IOENGINE="$2"
                shift 2
                ;;
            -s|--saturation)
                CLI_SATURATION_MODE=true
                shift
                ;;
            --threshold)
                if [ -z "$2" ] || [[ "$2" =~ ^- ]]; then
                    print_error "Option --threshold requires a positive number (ms)"
                    exit 1
                fi
                if ! [[ "$2" =~ ^[0-9]+\.?[0-9]*$ ]]; then
                    print_error "Option --threshold must be a positive number, got: $2"
                    exit 1
                fi
                CLI_LATENCY_THRESHOLD_MS="$2"
                shift 2
                ;;
            --block-size|--sat-block-sizes)
                if [ -z "$2" ] || [[ "$2" =~ ^- ]]; then
                    print_error "Option $1 requires a size value (comma-separated for multiple)"
                    exit 1
                fi
                CLI_SAT_BLOCK_SIZES="$2"
                shift 2
                ;;
            --sat-patterns)
                if [ -z "$2" ] || [[ "$2" =~ ^- ]]; then
                    print_error "Option --sat-patterns requires comma-separated patterns (randread,randwrite,randrw)"
                    exit 1
                fi
                CLI_SAT_PATTERNS="$2"
                shift 2
                ;;
            --initial-iodepth)
                if [ -z "$2" ] || ! [[ "$2" =~ ^[0-9]+$ ]] || [ "$2" -eq 0 ]; then
                    print_error "Option --initial-iodepth requires a positive integer, got: ${2:-empty}"
                    exit 1
                fi
                CLI_INITIAL_IODEPTH="$2"
                shift 2
                ;;
            --initial-numjobs)
                if [ -z "$2" ] || ! [[ "$2" =~ ^[0-9]+$ ]] || [ "$2" -eq 0 ]; then
                    print_error "Option --initial-numjobs requires a positive integer, got: ${2:-empty}"
                    exit 1
                fi
                CLI_INITIAL_NUMJOBS="$2"
                shift 2
                ;;
            --max-qd)
                if [ -z "$2" ] || ! [[ "$2" =~ ^[0-9]+$ ]] || [ "$2" -eq 0 ]; then
                    print_error "Option --max-qd requires a positive integer, got: ${2:-empty}"
                    exit 1
                fi
                CLI_MAX_TOTAL_QD="$2"
                shift 2
                ;;
            --max-steps)
                if [ -z "$2" ] || ! [[ "$2" =~ ^[0-9]+$ ]] || [ "$2" -eq 0 ]; then
                    print_error "Option --max-steps requires a positive integer, got: ${2:-empty}"
                    exit 1
                fi
                CLI_MAX_STEPS="$2"
                shift 2
                ;;
            # --- Standard test parameters ---
            --hostname)
                [ -z "$2" ] && { print_error "Option --hostname requires a value"; exit 1; }
                CLI_HOSTNAME="$2"; shift 2 ;;
            --protocol)
                [ -z "$2" ] && { print_error "Option --protocol requires a value"; exit 1; }
                CLI_PROTOCOL="$2"; shift 2 ;;
            --drive-type)
                [ -z "$2" ] && { print_error "Option --drive-type requires a value"; exit 1; }
                CLI_DRIVE_TYPE="$2"; shift 2 ;;
            --drive-model)
                [ -z "$2" ] && { print_error "Option --drive-model requires a value"; exit 1; }
                CLI_DRIVE_MODEL="$2"; shift 2 ;;
            --description)
                [ -z "$2" ] && { print_error "Option --description requires a value"; exit 1; }
                CLI_DESCRIPTION="$2"; shift 2 ;;
            --test-size)
                [ -z "$2" ] && { print_error "Option --test-size requires a value"; exit 1; }
                CLI_TEST_SIZE="$2"; shift 2 ;;
            --num-jobs)
                [ -z "$2" ] && { print_error "Option --num-jobs requires a value"; exit 1; }
                CLI_NUM_JOBS="$2"; shift 2 ;;
            --direct)
                [ -z "$2" ] && { print_error "Option --direct requires a value (0 or 1)"; exit 1; }
                CLI_DIRECT="$2"; shift 2 ;;
            --runtime)
                [ -z "$2" ] && { print_error "Option --runtime requires a value"; exit 1; }
                CLI_RUNTIME="$2"; shift 2 ;;
            --sync)
                [ -z "$2" ] && { print_error "Option --sync requires a value (none, sync, dsync; legacy 0 or 1)"; exit 1; }
                CLI_SYNC="$2"; shift 2 ;;
            --iodepth)
                [ -z "$2" ] && { print_error "Option --iodepth requires a value"; exit 1; }
                CLI_IODEPTH="$2"; shift 2 ;;
            --block-sizes)
                [ -z "$2" ] && { print_error "Option --block-sizes requires comma-separated sizes"; exit 1; }
                CLI_BLOCK_SIZES="$2"; shift 2 ;;
            --patterns)
                [ -z "$2" ] && { print_error "Option --patterns requires comma-separated patterns"; exit 1; }
                CLI_TEST_PATTERNS="$2"; shift 2 ;;
            --target-dir)
                [ -z "$2" ] && { print_error "Option --target-dir requires a path"; exit 1; }
                CLI_TARGET_DIR="$2"; shift 2 ;;
            --backend-url)
                [ -z "$2" ] && { print_error "Option --backend-url requires a URL"; exit 1; }
                CLI_BACKEND_URL="$2"; shift 2 ;;
            -U|--username)
                [ -z "$2" ] && { print_error "Option $1 requires a username"; exit 1; }
                CLI_USERNAME="$2"; shift 2 ;;
            -P|--password)
                [ -z "$2" ] && { print_error "Option $1 requires a password"; exit 1; }
                CLI_PASSWORD="$2"; shift 2 ;;
            --config-uuid)
                [ -z "$2" ] && { print_error "Option --config-uuid requires a UUID"; exit 1; }
                CLI_CONFIG_UUID="$2"; shift 2 ;;
            *)
                args+=("$1")
                shift
                ;;
        esac
    done
    
    # Restore remaining arguments for potential future use
    set -- "${args[@]}"
    
    # Load configuration (supports multiple env files and INCLUDE directives)
    # Precedence: CLI flags > env vars / .env file > hardcoded defaults
    load_env_files "${env_files[@]}"
    clear_storage_overrides
    init_config

    # Check prerequisites
    check_fio
    check_curl
    if [ "$SATURATION_MODE" = true ]; then check_jq; fi
    
    # Setup target (detect device vs directory mode)
    setup_target_dir

    # Detect the storage configuration once (uploaded with every result)
    detect_storage

    # Show configuration
    show_config

    # Validate test configuration for potential issues (skip in saturation mode)
    local config_warnings=0
    if [ "$SATURATION_MODE" != true ]; then
        validate_test_config
        config_warnings=$?
    fi

    # DRIVE_MODEL/DRIVE_TYPE vs. detected storage (warnings only)
    storage_plausibility_checks
    config_warnings=$((config_warnings + STORAGE_WARNINGS))
    if [ "$SATURATION_MODE" = true ] && [ "$STORAGE_WARNINGS" -gt 0 ]; then
        print_warning "Configuration warnings detected! Check DRIVE_MODEL/DRIVE_TYPE above."
    fi

    # Validate API connectivity and credentials (skip if --yes flag is used)
    if [ "$skip_confirmation" = false ]; then
        check_api_connectivity
        check_credentials
    else
        print_status "Skipping server connectivity checks due to --yes flag"
    fi

    # Confirm before starting tests (unless --yes flag is used)
    echo
    if [ "$SATURATION_MODE" = true ]; then
        # Saturation mode confirmation
        local initial_qd=$((INITIAL_IODEPTH * INITIAL_NUMJOBS))
        local num_patterns=${#SAT_PATTERNS_ARR[@]}
        local num_block_sizes=${#SAT_BLOCK_SIZES_ARR[@]}
        local num_syncs=${#SAT_SYNC_ARR[@]}
        local est_tests=$((MAX_STEPS * num_patterns * num_block_sizes * num_syncs))
        local est_minutes=$((est_tests * SAT_RUNTIME / 60))
        local sync_note=""
        if [ "$num_syncs" -gt 1 ]; then sync_note=" x $num_syncs sync modes"; fi
        print_status "Starting saturation test:"
        print_status "  Patterns: ${SAT_PATTERNS_ARR[*]} (independent QD escalation)"
        print_status "  Block sizes: ${SAT_BLOCK_SIZES_ARR[*]}"
        if [ "$num_syncs" -gt 1 ]; then
            print_status "  Sync modes: ${SAT_SYNC_ARR[*]} (one run each)"
        fi
        print_status "  Initial QD: $initial_qd (iodepth=$INITIAL_IODEPTH x numjobs=$INITIAL_NUMJOBS)"
        print_status "  P95 threshold: ${LATENCY_THRESHOLD_MS}ms"
        print_status "  Max total QD: ${MAX_TOTAL_QD}"
        print_status "  Runtime per step: ${SAT_RUNTIME}s"
        print_status "  Max estimated time: ~${est_minutes} minutes (if all $MAX_STEPS steps x $num_patterns patterns x $num_block_sizes block sizes${sync_note} run)"
    else
        # Standard mode confirmation
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
    fi

    # Extra warning for device mode
    if [ "$TARGET_IS_DEVICE" = true ]; then
        echo
        print_error "⚠️  DESTRUCTIVE OPERATION WARNING!"
        print_error "   Target device: $TARGET_DIR"
        print_error "   ALL DATA ON THIS DEVICE WILL BE DESTROYED!"
    fi
    echo

    if [ "$skip_confirmation" = false ]; then
        if [ "$TARGET_IS_DEVICE" = true ]; then
            read -p "DESTRUCTIVE: Type 'yes' to confirm testing on device $TARGET_DIR: " -r
            if [ "$REPLY" != "yes" ]; then
                print_warning "Test cancelled by user (must type 'yes' for device mode)"
                exit 0
            fi
        elif [ "$config_warnings" -ne 0 ]; then
            read -p "Configuration warnings detected. Do you still want to proceed? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                print_warning "Test cancelled by user"
                exit 0
            fi
        else
            read -p "Do you want to proceed? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                print_warning "Test cancelled by user"
                exit 0
            fi
        fi
    else
        print_status "Auto-confirmed with --yes flag"
    fi

    # Run tests based on mode
    if [ "$SATURATION_MODE" = true ]; then
        run_saturation_runs
        print_retry_summary
    else
        if run_all_tests; then
            print_retry_summary
            print_success "Performance testing completed successfully!"
        else
            print_error "Performance testing completed with errors."
            exit 1
        fi
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
# IMPORTANT: These values create a hierarchical data structure (Host-Protocol-Type-Model)
# The system organizes and filters data using this 4-level hierarchy:
#   1. Host (hostname)
#   2. Host-Protocol (hostname-protocol)
#   3. Host-Protocol-Type (hostname-protocol-drive_type)
#   4. Host-Protocol-Type-Model (hostname-protocol-drive_type-drive_model)
# Choose values that create meaningful groupings for your infrastructure!

# Hostname (default: current hostname)
# - Use descriptive server identifiers
# - Use "-vm" suffix if it's a virtual machine (e.g., "web01-vm", "db01-vm")
# - Examples: "server01", "web01-vm", "storage-node-01"
HOSTNAME="${hostname_default}"

# Protocol - Storage protocol used
# - Examples: "NFS", "iSCSI", "Local", "CIFS", "SMB", "FC" (Fibre Channel)
# - Use consistent naming across all tests from the same storage setup
# - Examples: "NFS", "iSCSI", "Local", "unknown"
PROTOCOL="local"

# Drive Type - Type of storage drive/array
# - Physical drives: "hdd", "ssd", "nvme"
# - ZFS pools: "mirror", "raidz1", "raidz2", "raidz3", "stripe"
# - For VMs: prefix with "vm-" (e.g., "vm-hdd", "vm-ssd", "vm-raidz1")
# - Examples: "hdd", "ssd", "nvme", "mirror", "raidz1", "vm-ssd", "vm-raidz2"
DRIVE_TYPE="unknown"

# Drive Model - Specific drive/pool identifier
# - Physical drives: model name (e.g., "WD1003FZEX", "Samsung980PRO")
# - ZFS pools: pool name (e.g., "tank", "storage-pool")
# - Special parameters: append with dash (e.g., "poolName-syncoff", "poolName-syncall")
# - For VMs: use the hypervisor's drive model
# - Examples: "WD1003FZEX", "Samsung980PRO", "tank", "storage-pool-syncoff", "poolName-syncall"
DRIVE_MODEL="unknown"
CONFIG_UUID="${config_uuid}"

# Test Configuration
# Block sizes to test (comma-separated)
# 4k is very low ZFS uses a default of 128 KiB blocks
BLOCK_SIZES="4k,64k,128k,1M"

# Test patterns to run (comma-separated: read, write, randread, randwrite, rw, randrw)
TEST_PATTERNS="read,write,randread,randwrite,rw,randrw"


# I/O Depth (comma-separated for multiple values) Depth per job
# !! psync, sync, vsync → iodepth is always 1 !!
IODEPTH="16"

# Number of parallel jobs (comma-separated for multiple values) Parallel jobs
NUM_JOBS="4"

# Queue depth (QD) will be NUM_JOBS * IODEPTH
# So on FreeBSD (TrueNAS Core) use a IODEPTH of 1 and NUM_JOBS of 64

# Direct I/O mode (1 = enabled, 0 = disabled, comma-separated for multiple values)
# it is the opposite of the buffered I/O mode
DIRECT="1"

# Test file size per job (comma-separated for multiple values)
# Examples: 10M, 100M, 1G
TEST_SIZE="10G"

# Sync mode passed to fio --sync (comma-separated for multiple values)
# none = no O_SYNC, sync = O_SYNC, dsync = O_DSYNC (legacy: 0 = none, 1 = sync)
SYNC="1"


# Test runtime in seconds (comma-separated for multiple values)
RUNTIME="60"
# Test directory default is "./fio_tmp/"
# TARGET_DIR=/mnt/pool/tests/
# DESCRIPTION="FIO-Performance-Test"

# ============================================================
# Advanced fio options (all off by default)
# ============================================================
# Extra arguments appended to every fio benchmark run (split on whitespace,
# values containing spaces are not supported), e.g. "--buffer_compress_percentage=50"
# FIO_EXTRA_ARGS=""
# Copy every fio JSON result into this directory (created if missing)
# KEEP_JSON_DIR=""
# 1 = every fio job gets its own file instead of all jobs sharing one (directories only)
# FILE_PER_JOB=0
# 1 = write test files once with incompressible data and reuse them across tests
#     (realistic reads on ext4/xfs fallocated files and ZFS compression; directories only)
# PREFILL=0
# Retries when fio fails with a transient EAGAIN error (io_uring can return it on
# reads at the end of the test file); other errors are never retried. 0 = off
# FIO_RETRY_MAX=2
# Detect the storage below TARGET_DIR (filesystem, ZFS dataset/zvol properties such as
# sync/recordsize/volblocksize and the pool layout, CephFS/RBD pool, the disk with model,
# serial and driver, e.g. QEMU HARDDISK / drive-scsi1 / virtio_scsi, and the hypervisor
# inside VMs) and upload it as storage_info with every result. Warns when DRIVE_MODEL tags
# (syncoff, syncall, syncstd, rs16k, vbs16k) or DRIVE_TYPE (mirror, raidz1/2/3, draid,
# stripe) do not match the detected ZFS settings or pool layout. 0 = off
# STORAGE_DETECT=1

# ============================================================
# Saturation Test Mode (use with --saturation flag)
# ============================================================
# Finds max IOPS while keeping P95 completion latency below threshold.
# Runs randread, randwrite, and randrw patterns with independent QD escalation.
# Each pattern saturates independently — read typically sustains higher QD.
# Usage: ./fio-test.sh --saturation
#
# SAT_BLOCK_SIZES=64k            # Block sizes (comma-separated, e.g. 4k,64k,128k)
# SAT_PATTERNS=randread,randwrite,randrw  # Patterns to test (comma-separated)
# LATENCY_THRESHOLD_MS=100       # P95 completion latency threshold (ms)
# INITIAL_IODEPTH=16             # Starting iodepth
# INITIAL_NUMJOBS=4              # Starting number of jobs
# MAX_STEPS=20                   # Safety limit for maximum steps
# MAX_TOTAL_QD=16384             # Max total QD before auto-stop (prevents shm issues)
# SAT_SYNC=sync,dsync            # Sync modes (comma-separated, none|sync|dsync or legacy 0|1);
#                                # one run (own run_uuid) per block size x sync mode; default: SYNC
# SAT_MAX_TOTAL_SIZE=100G        # FILE_PER_JOB=1 only: cap for all job files of one step;
#                                # per-job size = min(TEST_SIZE, cap / numjobs), whole MiB, min 1M
#                                # (empty = no cap; adds satcap:<size> to the description)


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

General Options:
  -h, --help             Show this help message
  -y, --yes              Skip confirmation prompt and start tests automatically
  -u, --uuid             Generate and output a random UUID
  -g, --generate-env     Generate a ready-to-use .env configuration file
                         Optional: specify filename (default: .env)
  -e, --env-file FILE    Specify a custom .env file path (can be used multiple times)
                         Files are loaded in order; later files override earlier ones.
  -i, --engine ENGINE    I/O engine (io_uring, libaio, psync). Default: auto-detect

Host Metadata Options:
  --hostname NAME        Server hostname (default: current hostname)
  --protocol PROTO       Storage protocol (default: unknown)
  --drive-type TYPE      Drive type (default: unknown)
  --drive-model MODEL    Drive model (default: unknown)
  --description TEXT     Test description prefix (default: empty, auto-built)
  --config-uuid UUID     Fixed UUID per host-config (default: generated from hostname)

Standard Test Options:
  --block-sizes SIZES    Comma-separated block sizes (default: 4k,64k,1M)
  --patterns PATS        Comma-separated test patterns (default: read,write,randread,randwrite)
  --test-size SIZE       Test file size, comma-separated for multiple (default: 10M)
  --num-jobs N           Parallel jobs, comma-separated for multiple (default: 4)
  --runtime SEC          Runtime per test, comma-separated for multiple (default: 30)
  --direct 0|1           Direct I/O mode, comma-separated for multiple (default: 1)
  --sync none|sync|dsync Sync mode, comma-separated for multiple (default: 1)
                         Legacy values 0 (= none) and 1 (= sync) are still accepted
  --iodepth N            I/O depth per job, comma-separated for multiple (default: 1)

Infrastructure Options:
  --target-dir PATH      Test directory or block device (default: ./fio_tmp/)
                         Block device mode is DESTRUCTIVE (destroys all data!)
  --backend-url URL      Backend API URL (default: http://localhost:8000)
  -U, --username USER    Upload username (default: uploader)
  -P, --password PASS    Upload password (default: uploader)

Saturation Test Options (use with -s):
  -s, --saturation       Enable saturation test mode
  --threshold MS         P95 latency threshold in ms (default: 100)
  --block-size SIZES     Saturation block sizes, comma-separated (default: 64k)
  --sat-patterns PATS    Saturation patterns, comma-separated (default: randread,randwrite,randrw)
                         Valid: read, randread, write, randwrite, rw, randrw
  --initial-iodepth N    Starting iodepth for saturation (default: 16)
  --initial-numjobs N    Starting numjobs for saturation (default: 4)
  --max-qd N             Max total QD before auto-stop (default: 16384)
  --max-steps N          Max escalation steps (default: 20)

Advanced Settings (.env / environment only, all off by default):
  FIO_EXTRA_ARGS="..."   Extra fio arguments appended to every benchmark run
                         (split on whitespace; values with spaces not supported)
  KEEP_JSON_DIR=PATH     Copy each fio JSON result into PATH (created if missing)
  FILE_PER_JOB=0|1       Give every fio job its own file (directory targets only)
  PREFILL=0|1            Write test files once with incompressible data and reuse
                         them across tests; removed at the end (directory targets only)
                         PREFILL/FILE_PER_JOB add prefill:1 / fileperjob:1 to the description
  FIO_RETRY_MAX=N        Retry a fio run up to N times when it fails with a transient
                         EAGAIN error (default: 2, 0 = off); other errors are not retried
  SAT_SYNC=LIST          Saturation sync modes, comma-separated (none, sync, dsync, legacy 0/1;
                         default: SYNC). Each block size x sync mode is its own run with its
                         own run_uuid, e.g. SAT_SYNC=sync,dsync
  SAT_MAX_TOTAL_SIZE=SZ  Saturation with FILE_PER_JOB=1: cap the total size of all job files
                         of a step (e.g. 100G). Per-job size = min(TEST_SIZE, SZ / numjobs),
                         rounded down to whole MiB, minimum 1M. Empty = no cap (default).
                         Adds satcap:<SZ> to the description
  STORAGE_DETECT=0|1     Detect the storage below the target (filesystem, kernel, fio version,
                         ZFS dataset/zvol properties and pool layout, CephFS/RBD pool, disk
                         model/serial/driver, hypervisor inside VMs) and upload it as
                         storage_info with every result (default: 1). Also warns when
                         DRIVE_MODEL/DRIVE_TYPE tags (syncoff, syncall, syncstd, rs16k, vbs16k,
                         mirror, raidz1/2/3, draid, stripe) do not match the detected ZFS
                         settings or pool layout

Precedence:
  CLI flags > environment variables > .env file > hardcoded defaults

  All options above can also be set via environment variables or .env files.
  The env variable name matches the long flag name in UPPER_SNAKE_CASE:
    --runtime 60        is equivalent to  RUNTIME=60
    --block-sizes 4k,1M is equivalent to  BLOCK_SIZES=4k,1M
    --drive-type ssd    is equivalent to  DRIVE_TYPE=ssd

Configuration:
  Generate a .env file:   $0 --generate-env [filename]
  Use multiple env files:  $0 -e base.env -e overrides.env
  INCLUDE directive:       Add INCLUDE=/path/to/base.env in your .env file

Examples:
  # Generate and edit configuration
  $0 --generate-env && vim .env && $0

  # Quick test with CLI flags (no .env needed)
  $0 --hostname web01 --protocol iSCSI --drive-type ssd --test-size 1G --runtime 60 -y

  # Override .env values with CLI flags
  $0 -e production.env --runtime 120 --num-jobs 8

  # Block device test (DESTRUCTIVE)
  $0 --target-dir /dev/nvme0n1 --direct 1

  # Saturation test
  $0 --saturation --threshold 50 --block-size 4k,64k,128k

  # Saturation with custom starting point
  $0 -e prod.env --saturation --initial-iodepth 32 --initial-numjobs 8

EOF
    exit 0
fi

# Run main function
main "$@"
