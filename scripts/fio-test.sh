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

    # Server mode (--server): fio --server on this host for a controller
    FIO_SERVER_BIND="${FIO_SERVER_BIND:-}"
    FIO_SERVER_PORT="${FIO_SERVER_PORT:-8765}"
    # Empty = FIO_SERVER_PORT + 1 (8766 by default), also on the controller
    FIO_SERVER_INFO_PORT="${FIO_SERVER_INFO_PORT:-}"
    FIO_SERVER_TIMEOUT="${FIO_SERVER_TIMEOUT:-2h}"
    FIO_SERVER_STATE_DIR="${FIO_SERVER_STATE_DIR:-}"
    # 1 = allow a loopback-bound server as root (every local user could use it)
    FIO_SERVER_ALLOW_ROOT="${FIO_SERVER_ALLOW_ROOT:-0}"
    # Client mode (controller): CLIENTS set = run every test on these fio servers
    CLIENTS="${CLIENTS:-}"
    RAMP_CLIENTS="${RAMP_CLIENTS:-}"
    CLIENT_SSH="${CLIENT_SSH:-0}"
    CLIENT_SSH_USER="${CLIENT_SSH_USER:-}"
    CLIENT_SSH_BASE_PORT="${CLIENT_SSH_BASE_PORT:-18765}"
    # Empty = the best engine every client supports (client_choose_ioengine)
    CLIENT_IOENGINE="${CLIENT_IOENGINE:-}"
    CLIENT_TARGET_IS_DEVICE="${CLIENT_TARGET_IS_DEVICE:-auto}"
    CLIENT_MODE=false
    CLIENT_SSH_PIDS=()
    CLIENT_WORK_DIR=""
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
    [ -n "${CLI_CLIENTS+set}" ]              && CLIENTS="$CLI_CLIENTS"
    [ -n "${CLI_RAMP_CLIENTS+set}" ]         && RAMP_CLIENTS="$CLI_RAMP_CLIENTS"
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
    if [ "$SATURATION_MODE" = true ]; then
        print_status "Generated RUN_UUID for the first saturation run: $RUN_UUID (every further block size / sync mode gets its own)"
    else
        print_status "Generated RUN_UUID for this script run: $RUN_UUID"
    fi
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
    # Client mode: clients of this step, ramp run, step with missing/failed clients
    if [ "${CLIENT_MODE:-false}" = true ]; then
        tags+=",clients:${STEP_CLIENTS:-0}"
        if [ -n "${RAMP_CLIENTS:-}" ]; then tags+=",ramp:1"; fi
        if [ "${STEP_COMPLETE:-1}" = 0 ]; then tags+=",incomplete:1"; fi
    fi

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

    # Client mode: TARGET_DIR is a path on the clients (validate_client_config decides)
    if [ "${CLIENT_MODE:-false}" != true ] && { [ "$FILE_PER_JOB" = 1 ] || [ "$PREFILL" = 1 ]; } \
        && is_block_device "$TARGET_DIR"; then
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
    CLIENT_MODE=false
    if [ -n "$CLIENTS" ]; then CLIENT_MODE=true; fi
    validate_advanced_options

    # Step 3: Detect I/O engine (before array conversion so psync fallback works).
    # Client mode: the clients run the jobs with CLIENT_IOENGINE (--engine wins); when neither
    # is set, client_choose_ioengine picks it from the clients' storage.json after connecting.
    if [ "$CLIENT_MODE" = true ]; then
        if [ -n "${CLI_IOENGINE:-}" ]; then CLIENT_IOENGINE="$CLI_IOENGINE"; fi
        validate_client_config || exit 1
        STEP_CLIENTS=${RAMP_STEPS[${#RAMP_STEPS[@]} - 1]}
        IOENGINE="${CLIENT_IOENGINE:-libaio}"
        set_sync_engine_flag
    else
        detect_ioengine
    fi

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

# curl config with the upload credentials (read via -K <(...), so the password never
# appears in the process list). Inside double quotes curl unescapes \\ and \".
curl_auth_config() {
    local cred="${USERNAME}:${PASSWORD}"
    cred=${cred//[$'\r\n']/}
    # Quoted replacements behave the same with and without bash 5.2 patsub_replacement
    cred=${cred//\\/'\\'}
    cred=${cred//\"/'\"'}
    printf 'user = "%s"\n' "$cred"
}

# Warn (once) when the upload credentials are still the defaults
warn_default_credentials() {
    if [ "${DEFAULT_CRED_WARNED:-false}" = true ]; then return 0; fi
    if [ "$USERNAME" = uploader ] && [ "$PASSWORD" = uploader ]; then
        print_warning "Upload credentials are the defaults uploader/uploader - set USERNAME/PASSWORD in .env"
        DEFAULT_CRED_WARNED=true
    fi
}

# Function to validate credentials
check_credentials() {
    print_status "Validating upload credentials for user '$USERNAME'"

    # Test upload endpoint for upload-only users
    local upload_response
    upload_response=$(curl -s -w "%{http_code}" -K <(curl_auth_config) \
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
            post_response=$(curl -s -w "%{http_code}" -K <(curl_auth_config) \
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
    # Client mode: step and client details instead of the controller's own storage_info.
    # Detected storage configuration (JSON); --form-string so '@'/'<' are never read as files
    if [ "${CLIENT_MODE:-false}" = true ]; then
        extra_fields+=(--form-string "clients=${STEP_CLIENTS}"
            --form-string "ramp_uuid=${RAMP_UUID}"
            --form-string "client_hosts=${STEP_CLIENT_HOSTS}"
            --form-string "client_storage_info=${STEP_CLIENT_STORAGE}"
            --form-string "ramp_step_complete=${STEP_COMPLETE}")
    elif [ -n "${STORAGE_INFO:-}" ]; then
        extra_fields+=(--form-string "storage_info=$STORAGE_INFO")
    fi

    response=$(curl -s -w "%{http_code}" \
        -X POST \
        -K <(curl_auth_config) \
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
    # Printed to the terminal: no escape sequences from the server
    response_body=${response_body//[[:cntrl:]]/}
    
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
    # Client mode: TARGET_DIR is a path on the clients - never touch the local one
    if [ "${CLIENT_MODE:-false}" = true ]; then
        client_close_tunnels
        if [ -n "$CLIENT_WORK_DIR" ] && [ -d "$CLIENT_WORK_DIR" ]; then
            rm -rf "$CLIENT_WORK_DIR"
        fi
        return 0
    fi
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

# Run one saturation loop per (block size x sync mode), each with its own RUN_UUID
# (the first run uses the RUN_UUID generated at start, shown in the header).
# With several runs, every run's block size, sync mode and RUN_UUID is listed at the end.
run_saturation_runs() {
    local sat_bs sat_sync banner entry first=true
    local -a run_uuids=()
    for sat_bs in "${SAT_BLOCK_SIZES_ARR[@]}"; do
        for sat_sync in "${SAT_SYNC_ARR[@]}"; do
            SAT_SYNC="$sat_sync"
            # Fresh RUN_UUID for every further run
            if [ "$first" = true ] && [ -n "${RUN_UUID:-}" ]; then
                :
            elif command -v uuidgen &> /dev/null; then
                RUN_UUID=$(uuidgen | tr '[:upper:]' '[:lower:]')
            else
                RUN_UUID=$(generate_uuid_from_hash "${HOSTNAME}_$(date -u +%Y-%m-%dT%H:%M:%S)_${sat_bs}_${sat_sync}")
            fi
            first=false
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

# Client-mode lines of show_config: target, clients, ramp steps, SSH and per-client storage
show_client_config() {
    local i ssh="off (direct connections)"
    if [ "$TARGET_IS_DEVICE" = true ]; then
        echo "Target:       $TARGET_DIR on every client (BLOCK DEVICE - DESTRUCTIVE!)"
    else
        echo "Target Dir:   $TARGET_DIR on every client"
    fi
    echo "Clients:      ${#CLIENT_ENTRY[@]}: ${CLIENT_ENTRY[*]}"
    if [ -n "$RAMP_CLIENTS" ]; then
        echo "Ramp Steps:   ${RAMP_STEPS[*]} clients (one ramp_uuid per test configuration)"
    else
        echo "Ramp Steps:   none (all ${#CLIENT_ENTRY[@]} clients in every test)"
    fi
    if [ "$CLIENT_SSH" = 1 ]; then
        ssh="on (${CLIENT_SSH_USER:+${CLIENT_SSH_USER}@}<client>, local ports from ${CLIENT_SSH_BASE_PORT})"
    fi
    echo "SSH Tunnels:  $ssh"
    for ((i = 0; i < ${#CLIENT_ENTRY[@]}; i++)); do
        printf 'Storage %-5s %s (%s): %s\n' "[$((i + 1))]" "${CLIENT_NAME[$i]:-?}" "${CLIENT_ENTRY[$i]}" \
            "$(client_storage_summary "${CLIENT_STORAGE[$i]:-}")"
    done
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
    if [ "${CLIENT_MODE:-false}" = true ]; then
        show_client_config
    elif [ "$TARGET_IS_DEVICE" = true ]; then
        echo "Target:       $TARGET_DIR (BLOCK DEVICE - DESTRUCTIVE!)"
    else
        echo "Target Dir:   $TARGET_DIR"
    fi
    echo "Username:     $USERNAME"
    if [ "${CLIENT_MODE:-false}" != true ]; then
        echo "Storage:      $(storage_summary)"
    fi
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

# ============================================================
# Multi-client mode (fio client/server)
# ============================================================
# Server mode (--server): this host runs `fio --server` bound to FIO_SERVER_BIND and
# publishes its storage detection (storage.json, hostname.txt) read-only over HTTP.
# Client mode (CLIENTS set): this host is the controller. Every test runs on the listed
# fio servers at once (`fio --client=... job.fio`), optionally ramped over RAMP_CLIENTS.

# Seconds from a duration like 90, 45s, 10m or 2h (0 = no timeout); returns 1 when invalid
parse_duration_seconds() {
    local re='^([0-9]{1,9})([sSmMhH]?)$' n
    [[ "$1" =~ $re ]] || return 1
    n=$((10#${BASH_REMATCH[1]}))
    case "${BASH_REMATCH[2]}" in
        m|M) n=$((n * 60)) ;;
        h|H) n=$((n * 3600)) ;;
    esac
    echo "$n"
}

# True for loopback addresses (127.0.0.0/8, ::1)
is_loopback_addr() {
    case "$1" in
        127.*|::1|"[::1]") return 0 ;;
    esac
    return 1
}

# True for a TCP port number 1-65535
valid_port() {
    [[ "$1" =~ ^[0-9]{1,5}$ ]] && [ "$((10#$1))" -ge 1 ] && [ "$((10#$1))" -le 65535 ]
}

# Canonical form of a FIO_SERVER_BIND address; returns 1 unless the input is a specific
# address in canonical form: wildcards in every spelling (0::, ::0.0.0.0, ::ffff:0.0.0.0),
# leading zeros (00.0.0.0) and scope ids are refused. Uses python3 ipaddress; without
# python3 only canonical IPv4 addresses and ::1 are accepted.
server_bind_canonical() {
    local addr=$1 octet='(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])'
    if command -v python3 >/dev/null 2>&1; then
        python3 -c '
import ipaddress, sys
s = sys.argv[1]
try:
    a = ipaddress.ip_address(s)
except ValueError:
    sys.exit(1)
mapped = getattr(a, "ipv4_mapped", None)
if "%" in s or a.is_unspecified or (mapped is not None and mapped.is_unspecified) or str(a) != s.lower():
    sys.exit(1)
print(a)' "$addr" 2>/dev/null
        return
    fi
    if [[ "$addr" =~ ^${octet}\.${octet}\.${octet}\.${octet}$ ]] && [ "$addr" != 0.0.0.0 ]; then
        echo "$addr"
        return 0
    fi
    if [ "$addr" = "::1" ]; then
        echo "::1"
        return 0
    fi
    return 1
}

# Validate FIO_SERVER_BIND / FIO_SERVER_PORT / FIO_SERVER_INFO_PORT for --server.
# Refuses a missing, wildcard or non-canonical address (fio's server has no authentication)
# and a loopback bind as root unless FIO_SERVER_ALLOW_ROOT=1.
# Sets SERVER_LOOPBACK=true for 127.0.0.1 / ::1 (reachable through SSH tunnels only).
server_validate_bind() {
    local bind=${FIO_SERVER_BIND:-} canon
    SERVER_LOOPBACK=false
    bind=${bind#[}
    bind=${bind%]}
    if [ -z "$bind" ]; then
        print_error "Server mode needs FIO_SERVER_BIND: the IP address of the interface to listen on,"
        print_error "  e.g. FIO_SERVER_BIND=10.44.44.101 (isolated benchmark network) or 127.0.0.1 (SSH tunnels)"
        return 1
    fi
    if ! canon=$(server_bind_canonical "$bind"); then
        print_error "FIO_SERVER_BIND must be one specific IP address in canonical form (got '$FIO_SERVER_BIND');"
        print_error "  wildcards such as 0.0.0.0 or :: are refused in every spelling (fio's server has no authentication)"
        if ! command -v python3 >/dev/null 2>&1; then
            print_error "  without python3 only IPv4 addresses and ::1 are accepted"
        fi
        return 1
    fi
    bind=$canon
    if ! valid_port "${FIO_SERVER_PORT:-}"; then
        print_error "FIO_SERVER_PORT must be a port number 1-65535 (got '${FIO_SERVER_PORT:-}')"
        return 1
    fi
    FIO_SERVER_PORT=$((10#$FIO_SERVER_PORT))
    if [ -z "${FIO_SERVER_INFO_PORT:-}" ]; then FIO_SERVER_INFO_PORT=$((FIO_SERVER_PORT + 1)); fi
    if ! valid_port "$FIO_SERVER_INFO_PORT" || [ "$((10#$FIO_SERVER_INFO_PORT))" -eq "$FIO_SERVER_PORT" ]; then
        print_error "FIO_SERVER_INFO_PORT must be a port number 1-65535 other than FIO_SERVER_PORT (got '$FIO_SERVER_INFO_PORT')"
        return 1
    fi
    FIO_SERVER_INFO_PORT=$((10#$FIO_SERVER_INFO_PORT))
    FIO_SERVER_BIND=$bind
    if is_loopback_addr "$bind"; then
        SERVER_LOOPBACK=true
        if [ "$(id -u 2>/dev/null)" = 0 ] && [ "${FIO_SERVER_ALLOW_ROOT:-0}" != 1 ]; then
            print_error "Refusing a loopback fio server as root: every local user could run fio jobs and"
            print_error "  exec_prerun commands as root. Run it as an unprivileged user (block device access"
            print_error "  via group permissions), or set FIO_SERVER_ALLOW_ROOT=1 on a single-user host."
            return 1
        fi
        print_status "Listening on loopback ($bind) only: not reachable over the network."
        print_status "  The controller must use CLIENT_SSH=1 (SSH tunnels to this host)."
    fi
    return 0
}

# fio --server / --client address: ip:<IPv4>,<port>, ip6:<IPv6>,<port> or <name>,<port>
fio_server_address() {
    local host=$1 port=$2 ipv4='^[0-9]{1,3}(\.[0-9]{1,3}){3}$'
    if [[ "$host" =~ $ipv4 ]]; then
        echo "ip:${host},${port}"
    elif [[ "$host" == *:* ]]; then
        echo "ip6:${host},${port}"
    else
        echo "${host},${port}"
    fi
}

# State directory of the server (PID files, published info/): FIO_SERVER_STATE_DIR,
# else /run/fio-test when /run is writable, else $XDG_RUNTIME_DIR/fio-test; empty when
# none applies (run_server_mode then creates a mktemp directory).
# SI_RUN_DIR replaces /run only with FIO_TEST_HOOKS=1 (tests).
server_state_dir() {
    local run=/run
    if [ "${FIO_TEST_HOOKS:-0}" = 1 ] && [ -n "${SI_RUN_DIR:-}" ]; then run=$SI_RUN_DIR; fi
    if [ -n "${FIO_SERVER_STATE_DIR:-}" ]; then
        echo "$FIO_SERVER_STATE_DIR"
    elif [ -d "$run" ] && [ -w "$run" ]; then
        echo "$run/fio-test"
    elif [ -n "${XDG_RUNTIME_DIR:-}" ]; then
        echo "$XDG_RUNTIME_DIR/fio-test"
    fi
}

# An existing state directory must be a real directory (no symlink) owned by this user
# without group/other write permission, and its info/ must not be a symlink.
# A missing directory is fine (it is created with mode 700).
server_check_state_dir() {
    local dir=$1
    if [ -L "$dir" ]; then
        print_error "Server state directory $dir is a symlink - refusing"
        return 1
    fi
    [ -e "$dir" ] || return 0
    if [ ! -d "$dir" ] || [ ! -O "$dir" ]; then
        print_error "Server state directory $dir must be a directory owned by $(id -un 2>/dev/null)"
        return 1
    fi
    if [ -n "$(find "$dir" -maxdepth 0 \( -perm -g+w -o -perm -o+w \) 2>/dev/null)" ]; then
        print_error "Server state directory $dir is writable by group/others - refusing (use mode 700)"
        return 1
    fi
    if [ -L "$dir/info" ]; then
        print_error "$dir/info is a symlink - refusing"
        return 1
    fi
    return 0
}

# Write <content> to <dir>/<name> without following a symlink at that name:
# temp file in the same directory, then rename over the name
server_write_file() {
    local dir=$1 name=$2 content=$3 tmp
    if [ -d "$dir/$name" ] && [ ! -L "$dir/$name" ]; then return 1; fi
    tmp=$(mktemp "$dir/.${name}.XXXXXX") || return 1
    if ! printf '%s\n' "$content" >"$tmp" || ! chmod 644 "$tmp"; then
        rm -f "$tmp"
        return 1
    fi
    # mv onto a symlink to a directory would move into that directory: drop the link first
    if [ -L "$dir/$name" ]; then rm -f "$dir/$name"; fi
    mv -f "$tmp" "$dir/$name"
}

# Write the published files into <state dir>/info: storage.json and hostname.txt only.
# Without storage detection (STORAGE_DETECT=0) storage.json still names the I/O engine.
server_write_info() {
    local dir="$1/info" info=${STORAGE_INFO:-} name
    if [ -L "$dir" ]; then return 1; fi
    mkdir -p "$dir" || return 1
    if [ -z "$info" ]; then info=$(json_object ioengine "${IOENGINE:-}"); fi
    name=$(hostname -s 2>/dev/null || hostname 2>/dev/null)
    name=${name//[^A-Za-z0-9._-]/}
    server_write_file "$dir" storage.json "$info" || return 1
    server_write_file "$dir" hostname.txt "${name:-unknown}"
}

# Start time and owner uid of a process ("<lstart> <uid>", single spaces; empty if gone)
server_proc_stamp() {
    ps -o lstart=,uid= -p "$1" 2>/dev/null | head -n 1 | tr -s ' \t' '  ' | sed 's/^ //; s/ $//'
}

# PID file <dir>/<kind>.pid: line 1 the PID, line 2 its start time and uid
server_write_pidfile() {
    local dir=$1 kind=$2 pid=$3
    server_write_file "$dir" "${kind}.pid" "${pid}"$'\n'"$(server_proc_stamp "$pid")"
}

# True when PID runs the process this script recorded as <kind> (server, fio or http),
# so a PID reused by another program is never killed
server_pid_matches() {
    local pid=$1 kind=$2 cmd
    cmd=$(ps -o command= -p "$pid" 2>/dev/null) || return 1
    case "$kind" in
        server) [[ "$cmd" == *" --server"* ]] ;;
        fio) [[ "$cmd" == *fio*" --server="* ]] ;;
        http) [[ "$cmd" == *http.server* ]] ;;
        *) return 1 ;;
    esac
}

# --server-stop: stop the processes recorded in <state dir>/{server,fio,http}.pid and
# remove the PID files. A PID is killed only when its start time and uid still match the
# recorded ones, the uid is ours (root: any recorded uid) and the command matches.
server_stop_pids() {
    local dir=$1 kind pidfile pid rec cur uid me
    me=$(id -u 2>/dev/null)
    if [ ! -d "$dir" ]; then
        print_error "No server state directory $dir (set FIO_SERVER_STATE_DIR to the directory --server printed)"
        return 1
    fi
    for kind in server fio http; do
        pidfile="$dir/$kind.pid"
        [ -f "$pidfile" ] || continue
        pid=$(sed -n 1p "$pidfile" 2>/dev/null)
        rec=$(sed -n 2p "$pidfile" 2>/dev/null)
        cur=""
        if [[ "$pid" =~ ^[1-9][0-9]{0,9}$ ]]; then cur=$(server_proc_stamp "$pid"); fi
        uid=${rec##* }
        if [ -n "$rec" ] && [ "$cur" = "$rec" ] && { [ "$uid" = "$me" ] || [ "$me" = 0 ]; } \
            && server_pid_matches "$pid" "$kind"; then
            kill "$pid" 2>/dev/null && print_status "Stopped $kind process (PID $pid)"
        else
            print_warning "Ignoring $pidfile: '$pid' is not a running $kind process of fio-test.sh"
        fi
        rm -f "$pidfile"
    done
    return 0
}

# Prominent warning: fio's server executes whatever job a client sends
print_server_security_warning() {
    local ports="${FIO_SERVER_PORT},${FIO_SERVER_INFO_PORT}" user
    user=$(id -un 2>/dev/null || echo "this user")
    echo
    print_warning "${BOLD}=================== SECURITY WARNING ===================${NC}"
    print_warning "fio's server mode has NO authentication and NO encryption. Anyone who can"
    print_warning "reach ${FIO_SERVER_BIND}:${FIO_SERVER_PORT} can run arbitrary fio jobs as '${user}':"
    print_warning "  write to any file or block device this user can open (as root: every disk),"
    print_warning "  and run shell commands (fio exec_prerun/exec_postrun)."
    if [ "${SERVER_LOOPBACK:-false}" = true ]; then
        print_warning "Bound to loopback: every local user of this host can still connect."
    else
        print_warning "Use it only on an isolated benchmark network and allow only the controller:"
        print_warning "  nft insert rule inet filter input tcp dport { ${ports} } ip saddr != <CONTROLLER_IP> drop"
        print_warning "  iptables -I INPUT -p tcp -m multiport --dports ${ports} ! -s <CONTROLLER_IP> -j DROP"
    fi
    print_warning "Stop it with Ctrl-C or './fio-test.sh --server-stop'; it stops itself after FIO_SERVER_TIMEOUT."
    print_warning "${BOLD}========================================================${NC}"
    echo
}

# Stop the processes started by run_server_mode and remove the PID files / published info
server_shutdown() {
    local pid
    if [ "${SERVER_SHUTDOWN_DONE:-false}" = true ]; then return 0; fi
    SERVER_SHUTDOWN_DONE=true
    for pid in ${SERVER_HTTP_PID:-} ${SERVER_FIO_PID:-}; do
        if kill -0 "$pid" 2>/dev/null; then
            # fio forks one child per client connection: stop those first
            if command -v pkill >/dev/null 2>&1; then pkill -TERM -P "$pid" 2>/dev/null; fi
            kill "$pid" 2>/dev/null
        fi
    done
    rm -f "$SERVER_STATE_DIR/server.pid" "$SERVER_STATE_DIR/fio.pid" "$SERVER_STATE_DIR/http.pid"
    rm -f "$SERVER_STATE_DIR/info/storage.json" "$SERVER_STATE_DIR/info/hostname.txt" ${SERVER_HTTP_LOG:+"$SERVER_HTTP_LOG"}
    rmdir "$SERVER_STATE_DIR/info" 2>/dev/null
    if [ "${SERVER_STATE_TEMP:-false}" = true ]; then rmdir "$SERVER_STATE_DIR" 2>/dev/null; fi
    print_status "fio server stopped"
}

# Start the read-only info HTTP server (storage.json, hostname.txt) if python3 exists
server_start_info_http() {
    if ! command -v python3 >/dev/null 2>&1; then
        print_warning "python3 not found - no info server; the controller uploads {} as this client's storage info"
        return 0
    fi
    # New log file (mktemp: never an existing name or symlink)
    SERVER_HTTP_LOG=$(mktemp "$SERVER_STATE_DIR/http.XXXXXX") || return 1
    python3 -m http.server --bind "$FIO_SERVER_BIND" "$FIO_SERVER_INFO_PORT" \
        --directory "$SERVER_STATE_DIR/info" </dev/null >"$SERVER_HTTP_LOG" 2>&1 &
    SERVER_HTTP_PID=$!
    server_write_pidfile "$SERVER_STATE_DIR" http "$SERVER_HTTP_PID"
}

# Prepare the server state directory; refuses to start a second server on it
server_prepare_state_dir() {
    local old
    SERVER_STATE_DIR=$(server_state_dir)
    SERVER_STATE_TEMP=false
    if [ -z "$SERVER_STATE_DIR" ]; then
        SERVER_STATE_DIR=$(mktemp -d "${TMPDIR:-/tmp}/fio-test-server.XXXXXX") || return 1
        SERVER_STATE_TEMP=true
    fi
    server_check_state_dir "$SERVER_STATE_DIR" || return 1
    # Only a directory created here gets mode 700; an existing one keeps its mode
    if [ ! -d "$SERVER_STATE_DIR" ] && ! { mkdir -p "$(dirname "$SERVER_STATE_DIR")" \
        && mkdir -m 700 "$SERVER_STATE_DIR"; }; then
        print_error "Cannot create server state directory $SERVER_STATE_DIR"
        return 1
    fi
    old=$(head -n 1 "$SERVER_STATE_DIR/fio.pid" 2>/dev/null)
    if [[ "$old" =~ ^[1-9][0-9]*$ ]] && kill -0 "$old" 2>/dev/null && server_pid_matches "$old" fio; then
        print_error "A fio server (PID $old) already uses $SERVER_STATE_DIR - stop it with --server-stop"
        print_error "  or use another FIO_SERVER_STATE_DIR for a second instance"
        return 1
    fi
}

# --server: run fio --server (plus the info HTTP server) until Ctrl-C, --server-stop,
# FIO_SERVER_TIMEOUT or fio exiting
run_server_mode() {
    local timeout_s start
    SERVER_HTTP_PID="" SERVER_FIO_PID="" SERVER_HTTP_LOG="" SERVER_SHUTDOWN_DONE=false
    server_validate_bind || exit 1
    if ! timeout_s=$(parse_duration_seconds "$FIO_SERVER_TIMEOUT"); then
        print_error "FIO_SERVER_TIMEOUT must be a duration like 7200, 90m or 2h (0 = no timeout), got '$FIO_SERVER_TIMEOUT'"
        exit 1
    fi
    check_fio
    print_server_security_warning
    server_prepare_state_dir || exit 1
    # Own traps (the default one would clean up TARGET_DIR)
    trap 'server_shutdown; exit 0' INT TERM
    trap 'server_shutdown' EXIT
    # TARGET_DIR must be the same path the controller uses (created here if missing)
    if [[ "$TARGET_DIR" != /* ]]; then
        print_warning "TARGET_DIR '$TARGET_DIR' is relative - the controller needs an absolute path (same on every client)"
    fi
    setup_target_dir
    # Published in storage.json: the controller picks the engine every client supports
    detect_ioengine
    detect_storage
    server_write_info "$SERVER_STATE_DIR" || { print_error "Cannot write $SERVER_STATE_DIR/info"; exit 1; }

    server_write_pidfile "$SERVER_STATE_DIR" server "$$"
    server_start_info_http
    fio --server="$(fio_server_address "$FIO_SERVER_BIND" "$FIO_SERVER_PORT")" </dev/null &
    SERVER_FIO_PID=$!
    server_write_pidfile "$SERVER_STATE_DIR" fio "$SERVER_FIO_PID"
    sleep 1
    if ! kill -0 "$SERVER_FIO_PID" 2>/dev/null; then
        print_error "fio --server exited at once (port ${FIO_SERVER_PORT} in use or address not on this host?)"
        exit 1
    fi
    if [ -n "${SERVER_HTTP_PID:-}" ] && ! kill -0 "$SERVER_HTTP_PID" 2>/dev/null; then
        print_warning "Info HTTP server did not start: $(tail -n 1 "$SERVER_HTTP_LOG" 2>/dev/null | tr -d '\000-\037')"
    fi

    print_success "fio server listening on ${FIO_SERVER_BIND}:${FIO_SERVER_PORT} (PID $SERVER_FIO_PID)"
    print_status "Storage info:  http://${FIO_SERVER_BIND}:${FIO_SERVER_INFO_PORT}/storage.json"
    print_status "Storage:       $(storage_summary)"
    print_status "Target:        $TARGET_DIR (the controller's TARGET_DIR must be this path)"
    print_status "State dir:     $SERVER_STATE_DIR"
    if [ "$timeout_s" -gt 0 ]; then
        print_status "Timeout:       stops by itself after ${FIO_SERVER_TIMEOUT}"
    fi
    print_status "Stop:          Ctrl-C or FIO_SERVER_STATE_DIR=$SERVER_STATE_DIR $0 --server-stop"

    start=$SECONDS
    while kill -0 "$SERVER_FIO_PID" 2>/dev/null; do
        if [ "$timeout_s" -gt 0 ] && [ $((SECONDS - start)) -ge "$timeout_s" ]; then
            print_warning "FIO_SERVER_TIMEOUT (${FIO_SERVER_TIMEOUT}) reached - stopping"
            break
        fi
        sleep 1
    done
    server_shutdown
    exit 0
}

# --server-stop: stop the server recorded in the state directory
run_server_stop_mode() {
    local dir
    dir=$(server_state_dir)
    if [ -z "$dir" ]; then
        print_error "No default state directory - set FIO_SERVER_STATE_DIR to the directory --server printed"
        exit 1
    fi
    server_stop_pids "$dir" || exit 1
    exit 0
}

# Parse CLIENTS ("host[:port[:infoport]]", comma-separated; IPv6 as "[addr]:port") into
# CLIENT_ENTRY (as written), CLIENT_ADDR, CLIENT_PORT and CLIENT_INFO_PORT.
# Port default FIO_SERVER_PORT; info port default FIO_SERVER_INFO_PORT, else port + 1.
parse_clients() {
    local list=$1 entry addr port info seen=" "
    local re_v6='^\[([0-9A-Fa-f:.]+)\](:([0-9]+))?(:([0-9]+))?$'
    local re_host='^([A-Za-z0-9][A-Za-z0-9._-]*)(:([0-9]+))?(:([0-9]+))?$'
    local -a raw
    CLIENT_ENTRY=() CLIENT_ADDR=() CLIENT_PORT=() CLIENT_INFO_PORT=()
    if [ -z "${list//[[:space:],]/}" ] || [[ "$list" == *, ]]; then
        print_error "CLIENTS must list fio servers: host[:port[:infoport]],... (got '$list')"
        return 1
    fi
    IFS=',' read -ra raw <<< "$list"
    for entry in "${raw[@]}"; do
        entry="${entry#"${entry%%[![:space:]]*}"}"
        entry="${entry%"${entry##*[![:space:]]}"}"
        if [[ "$entry" =~ $re_v6 ]] || [[ "$entry" =~ $re_host ]]; then
            addr=${BASH_REMATCH[1]} port=${BASH_REMATCH[3]:-${FIO_SERVER_PORT:-8765}}
            info=${BASH_REMATCH[5]:-${FIO_SERVER_INFO_PORT:-}}
        else
            print_error "Invalid CLIENTS entry '$entry' (host[:port[:infoport]], IPv6 as [addr]:port)"
            return 1
        fi
        if ! valid_port "$port"; then print_error "Invalid port in CLIENTS entry '$entry'"; return 1; fi
        port=$((10#$port))
        if [ -z "$info" ]; then info=$((port + 1)); fi
        if ! valid_port "$info" || [ "$((10#$info))" -eq "$port" ]; then
            print_error "Invalid info port in CLIENTS entry '$entry'"
            return 1
        fi
        if [[ "$seen" == *" ${addr}:${port} "* ]]; then
            print_error "Duplicate CLIENTS entry '$entry'"
            return 1
        fi
        seen+="${addr}:${port} "
        CLIENT_ENTRY+=("$entry") CLIENT_ADDR+=("$addr") CLIENT_PORT+=("$port") CLIENT_INFO_PORT+=("$((10#$info))")
    done
}

# Parse RAMP_CLIENTS (ascending client counts, each <= count) into RAMP_STEPS;
# empty = one step with all clients
parse_ramp_clients() {
    local list=$1 count=$2 value prev=0
    local -a raw
    RAMP_STEPS=()
    if [ -z "${list//[[:space:]]/}" ]; then
        RAMP_STEPS=("$count")
        return 0
    fi
    IFS=',' read -ra raw <<< "$list"
    if [ ${#raw[@]} -eq 0 ] || [[ "$list" == *, ]]; then
        print_error "RAMP_CLIENTS must be ascending client counts like 1,2,4 (got '$list')"
        return 1
    fi
    for value in "${raw[@]}"; do
        value=${value//[[:space:]]/}
        if ! [[ "$value" =~ ^[1-9][0-9]{0,3}$ ]] || [ "$value" -le "$prev" ] || [ "$value" -gt "$count" ]; then
            print_error "RAMP_CLIENTS must be ascending client counts from 1 to $count (got '$list')"
            return 1
        fi
        RAMP_STEPS+=("$value")
        prev=$value
    done
}

# Check the client-mode settings; TARGET_IS_DEVICE from CLIENT_TARGET_IS_DEVICE
# (auto = the path starts with /dev/). TARGET_DIR is never looked at locally.
validate_client_config() {
    local var value n
    if [ "$SATURATION_MODE" = true ]; then
        print_error "SATURATION_MODE (--saturation) cannot be combined with CLIENTS (client mode) - run them separately"
        return 1
    fi
    parse_clients "$CLIENTS" || return 1
    n=${#CLIENT_ADDR[@]}
    parse_ramp_clients "${RAMP_CLIENTS:-}" "$n" || return 1
    case "$CLIENT_SSH" in
        0|1) ;;
        *) print_error "CLIENT_SSH must be 0 or 1 (got '$CLIENT_SSH')"; return 1 ;;
    esac
    if [ "$CLIENT_SSH" = 1 ]; then
        if ! valid_port "$CLIENT_SSH_BASE_PORT" || [ $((10#$CLIENT_SSH_BASE_PORT + 2 * n - 1)) -gt 65535 ]; then
            print_error "CLIENT_SSH_BASE_PORT needs 2 free local ports per client below 65536 (got '$CLIENT_SSH_BASE_PORT')"
            return 1
        fi
        CLIENT_SSH_BASE_PORT=$((10#$CLIENT_SSH_BASE_PORT))
        if [ -n "$CLIENT_SSH_USER" ] && ! [[ "$CLIENT_SSH_USER" =~ ^[A-Za-z0-9_][A-Za-z0-9._-]*$ ]]; then
            print_error "Invalid CLIENT_SSH_USER '$CLIENT_SSH_USER'"
            return 1
        fi
    fi
    # Values end up in an ini job file: no control characters (a newline would add options)
    if [[ "$TARGET_DIR" != /* ]] || [[ "$TARGET_DIR" == *[[:cntrl:]]* ]]; then
        print_error "In client mode TARGET_DIR must be an absolute path on the clients (got '$TARGET_DIR')"
        return 1
    fi
    # Empty = chosen from the clients' storage.json (client_choose_ioengine)
    if [ -n "$CLIENT_IOENGINE" ] && { ! [[ "$CLIENT_IOENGINE" =~ ^[A-Za-z0-9_.:-]+$ ]] || [[ "$CLIENT_IOENGINE" == external* ]]; }; then
        print_error "Invalid CLIENT_IOENGINE '$CLIENT_IOENGINE'"
        return 1
    fi
    for var in BLOCK_SIZES TEST_PATTERNS NUM_JOBS DIRECT TEST_SIZE SYNC IODEPTH RUNTIME; do
        value=${!var:-}
        if [[ "$value" == *[[:cntrl:]]* ]]; then print_error "Invalid $var '$value'"; return 1; fi
    done
    case "$CLIENT_TARGET_IS_DEVICE" in
        auto) if [[ "$TARGET_DIR" == /dev/* ]]; then TARGET_IS_DEVICE=true; else TARGET_IS_DEVICE=false; fi ;;
        1) TARGET_IS_DEVICE=true ;;
        0) TARGET_IS_DEVICE=false ;;
        *) print_error "CLIENT_TARGET_IS_DEVICE must be auto, 0 or 1 (got '$CLIENT_TARGET_IS_DEVICE')"; return 1 ;;
    esac
    if [ "$TARGET_IS_DEVICE" = true ] && { [ "$PREFILL" = 1 ] || [ "$FILE_PER_JOB" = 1 ]; }; then
        print_warning "PREFILL/FILE_PER_JOB only apply to directory targets - ignored for block device $TARGET_DIR"
        PREFILL=0
        FILE_PER_JOB=0
    fi
    return 0
}

# SSH tunnel command for client <i> into SSH_CMD: local <lport> -> fio port,
# local <linfo> -> info port, both on the client's 127.0.0.1
client_ssh_command() {
    local i=$1 lport=$2 linfo=$3 target=${CLIENT_ADDR[$1]}
    if [ -n "${CLIENT_SSH_USER:-}" ]; then target="${CLIENT_SSH_USER}@${target}"; fi
    SSH_CMD=(ssh -N -o ExitOnForwardFailure=yes -o BatchMode=yes
        -L "${lport}:127.0.0.1:${CLIENT_PORT[$i]}" -L "${linfo}:127.0.0.1:${CLIENT_INFO_PORT[$i]}" -- "$target")
}

# True when something already listens on local port $1
client_port_in_use() {
    (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

# Wait up to 10s until a local tunnel port accepts connections (fails when ssh exits)
client_wait_port() {
    local host=$1 port=$2 pid=$3 i
    for ((i = 0; i < 50; i++)); do
        kill -0 "$pid" 2>/dev/null || return 1
        if (exec 3<>"/dev/tcp/${host}/${port}") 2>/dev/null; then return 0; fi
        sleep 0.2
    done
    return 1
}

# Connection endpoints per client into CLIENT_CONN_HOST/PORT/INFO_PORT and CLIENT_KEY
# ("host:port" as fio reports it in client_stats). CLIENT_SSH=1 starts one SSH tunnel per
# client in the background (PIDs in CLIENT_SSH_PIDS, closed by client_close_tunnels).
client_setup_connections() {
    local i n=${#CLIENT_ADDR[@]} lport
    CLIENT_CONN_HOST=() CLIENT_CONN_PORT=() CLIENT_CONN_INFO_PORT=() CLIENT_KEY=() CLIENT_SSH_PIDS=()
    if [ "${CLIENT_SSH:-0}" = 1 ]; then
        # Another local user's listener on a tunnel port would receive our fio traffic
        for ((lport = CLIENT_SSH_BASE_PORT; lport < CLIENT_SSH_BASE_PORT + 2 * n; lport++)); do
            if client_port_in_use "$lport"; then
                print_error "Local port $lport is already in use - choose another CLIENT_SSH_BASE_PORT"
                return 1
            fi
        done
    fi
    for ((i = 0; i < n; i++)); do
        if [ "${CLIENT_SSH:-0}" = 1 ]; then
            lport=$((CLIENT_SSH_BASE_PORT + 2 * i))
            client_ssh_command "$i" "$lport" "$((lport + 1))"
            print_status "SSH tunnel to ${CLIENT_ADDR[$i]}: 127.0.0.1:${lport} -> fio ${CLIENT_PORT[$i]}, 127.0.0.1:$((lport + 1)) -> info ${CLIENT_INFO_PORT[$i]}"
            "${SSH_CMD[@]}" </dev/null &
            CLIENT_SSH_PIDS+=("$!")
            CLIENT_CONN_HOST+=(127.0.0.1) CLIENT_CONN_PORT+=("$lport") CLIENT_CONN_INFO_PORT+=("$((lport + 1))")
        else
            CLIENT_CONN_HOST+=("${CLIENT_ADDR[$i]}") CLIENT_CONN_PORT+=("${CLIENT_PORT[$i]}")
            CLIENT_CONN_INFO_PORT+=("${CLIENT_INFO_PORT[$i]}")
        fi
        CLIENT_KEY+=("${CLIENT_CONN_HOST[$i]}:${CLIENT_CONN_PORT[$i]}")
    done
    if [ "${CLIENT_SSH:-0}" = 1 ]; then
        for ((i = 0; i < n; i++)); do
            if ! client_wait_port 127.0.0.1 "${CLIENT_CONN_INFO_PORT[$i]}" "${CLIENT_SSH_PIDS[$i]}"; then
                print_error "SSH tunnel to ${CLIENT_ADDR[$i]} did not come up (key-based login and free local port ${CLIENT_CONN_PORT[$i]} needed)"
                return 1
            fi
        done
        # ExitOnForwardFailure: ssh exits when it could not bind; then someone else answered
        sleep 0.5
        for ((i = 0; i < n; i++)); do
            if ! kill -0 "${CLIENT_SSH_PIDS[$i]}" 2>/dev/null; then
                print_error "SSH tunnel to ${CLIENT_ADDR[$i]} exited - another process answers on its local port"
                return 1
            fi
        done
    fi
    return 0
}

# Client mode without SSH: the controller trusts every client (fio protocol)
print_client_security_warning() {
    if [ "${CLIENT_SSH:-0}" = 1 ]; then return 0; fi
    print_warning "Client mode: fio's client/server protocol has no authentication and no encryption,"
    print_warning "  and the controller trusts every client (a fio server can make the controller read"
    print_warning "  or write files). Use an isolated network or CLIENT_SSH=1, and run the controller as"
    print_warning "  an unprivileged user whose .env is readable only by that user."
}

# Close the SSH tunnels started by client_setup_connections
client_close_tunnels() {
    local pid
    for pid in ${CLIENT_SSH_PIDS[@]+"${CLIENT_SSH_PIDS[@]}"}; do
        kill "$pid" 2>/dev/null
    done
    CLIENT_SSH_PIDS=()
    return 0
}

# fio --client arguments for the first <n> clients into CLIENT_FIO_ARGS
client_fio_args() {
    local i
    CLIENT_FIO_ARGS=()
    for ((i = 0; i < $1; i++)); do
        # Options after a --client= go to that server: JSON there too, so it sends no text status lines
        CLIENT_FIO_ARGS+=("--client=$(fio_server_address "${CLIENT_CONN_HOST[$i]}" "${CLIENT_CONN_PORT[$i]}")" --output-format=json)
    done
}

# Host name as sent by a client: [A-Za-z0-9._-] only, at most 64 characters
client_sanitize_name() {
    local v=${1//[^A-Za-z0-9._-]/}
    printf '%s' "${v:0:64}"
}

# True when $1 is a JSON object
client_valid_json_object() {
    [ -n "$1" ] && jq -e 'type == "object"' >/dev/null 2>&1 <<< "$1"
}

# Fetch hostname.txt and storage.json of every client into CLIENT_NAME / CLIENT_STORAGE
# (address as name and {} when a client publishes nothing)
client_fetch_info() {
    local i n=${#CLIENT_ENTRY[@]} host base name info
    CLIENT_NAME=() CLIENT_STORAGE=()
    for ((i = 0; i < n; i++)); do
        host=${CLIENT_CONN_HOST[$i]}
        if [[ "$host" == *:* ]]; then host="[$host]"; fi
        base="http://${host}:${CLIENT_CONN_INFO_PORT[$i]}"
        name=$(curl -s -f --noproxy '*' --max-time 5 --max-filesize 256 "$base/hostname.txt" 2>/dev/null \
            | head -c 256 | head -n 1)
        name=$(client_sanitize_name "$name")
        info=$(curl -s -f --noproxy '*' --max-time 5 --max-filesize 65536 "$base/storage.json" 2>/dev/null \
            | head -c 65536)
        if ! client_valid_json_object "$info"; then
            print_warning "No storage info from ${CLIENT_ENTRY[$i]} ($base/storage.json) - using {}"
            info='{}'
        fi
        CLIENT_NAME+=("${name:-${CLIENT_ADDR[$i]}}")
        CLIENT_STORAGE+=("$info")
    done
}

# Rank of an engine for client_choose_ioengine (higher = faster); 0 = not one of the three
client_ioengine_rank() {
    case "$1" in
        io_uring) echo 3 ;;
        libaio) echo 2 ;;
        psync) echo 1 ;;
        *) echo 0 ;;
    esac
}

# Set CLIENT_IOENGINE/IOENGINE/IS_SYNC_ENGINE for client mode (after client_fetch_info).
# CLIENT_IOENGINE or --engine set: used as is. Otherwise the best engine that EVERY client
# supports (io_uring > libaio > psync), from the ioengine each client's --server publishes in
# storage.json; libaio (the former default) when a client publishes none or another engine.
client_choose_ioengine() {
    local i n=${#CLIENT_STORAGE[@]} engine rank best=3 unknown=()
    local names=("" psync libaio io_uring)
    if [ -n "$CLIENT_IOENGINE" ]; then
        IOENGINE=$CLIENT_IOENGINE
        set_sync_engine_flag
        print_status "Client I/O engine: $CLIENT_IOENGINE (set by CLIENT_IOENGINE or --engine)"
        return 0
    fi
    for ((i = 0; i < n; i++)); do
        engine=$(jq -r 'if (.ioengine | type) == "string" then .ioengine else "" end' \
            <<< "${CLIENT_STORAGE[$i]:-}" 2>/dev/null)
        engine=${engine//[^A-Za-z0-9_.:-]/}
        rank=$(client_ioengine_rank "$engine")
        if [ "$rank" -eq 0 ]; then
            unknown+=("${CLIENT_ENTRY[$i]}${engine:+ ($engine)}")
        elif [ "$rank" -lt "$best" ]; then
            best=$rank
        fi
    done
    if [ "$n" -eq 0 ] || [ "${#unknown[@]}" -gt 0 ]; then
        CLIENT_IOENGINE=libaio
        print_warning "Client I/O engine: libaio (no usable ioengine in storage.json of: ${unknown[*]:-all clients})"
        print_warning "  Run fio-test.sh --server of this version on the clients or set CLIENT_IOENGINE"
    else
        CLIENT_IOENGINE=${names[$best]}
        print_status "Client I/O engine: $CLIENT_IOENGINE (best engine supported by all ${n} clients)"
    fi
    IOENGINE=$CLIENT_IOENGINE
    set_sync_engine_flag
    if [ "$IS_SYNC_ENGINE" = true ]; then
        IODEPTH=(1)
        print_warning "psync is synchronous - using iodepth=1"
    fi
}

# Comma-separated names of the first <n> clients (client_hosts upload field)
client_hosts_list() {
    local IFS=,
    echo "${CLIENT_NAME[*]:0:$1}"
}

# client_storage_info upload field for the first <n> clients:
# {"<host>:<port>": {<storage.json>..., "client_name": "<CLIENTS entry>"}, ...}
# Kept below 120000 bytes (one command-line argument of curl; Linux allows 128 KiB):
# drops virt, ceph, disk, then zfs details, then keeps only fs_type.
client_storage_info_json() {
    local n=$1 out part
    out=$(printf '%s\n' "${CLIENT_STORAGE[@]:0:$n}" | jq -c -s --args '
        . as $v | ($v | length) as $n
        | reduce range(0; $n) as $i ({}; . + {($ARGS.positional[$i]): ($v[$i] + {client_name: $ARGS.positional[$i + $n]})})' \
        "${CLIENT_KEY[@]:0:$n}" "${CLIENT_ENTRY[@]:0:$n}") || out='{}'
    for part in virt ceph disk zfs; do
        [ "$(LC_ALL=C; echo "${#out}")" -gt 120000 ] || break
        out=$(jq -c --arg p "$part" 'map_values(del(.[$p]))' <<< "$out")
    done
    if [ "$(LC_ALL=C; echo "${#out}")" -gt 120000 ]; then
        out=$(jq -c 'map_values({client_name, fs_type})' <<< "$out")
    fi
    echo "$out"
}

# One-line summary of a client's storage.json for show_config
client_storage_summary() {
    local out
    out=$(jq -r '[("fs=" + (.fs_type // empty)), ("zfs=" + (.zfs.dataset // empty)),
        ("sync=" + (.zfs.sync // empty)), ("recordsize=" + (.zfs.recordsize // empty)),
        ("volblocksize=" + (.zfs.volblocksize // empty)), ("layout=" + (.zfs.pool_layout // empty)),
        ("ceph=" + (.ceph.kind // empty)), ("pool=" + (.ceph.pool // empty)),
        ("disk=" + (.disk.name // empty)), ("model=" + (.disk.model // empty)),
        ("driver=" + (.disk.driver // empty)), ("virt=" + (.virt.type // empty)),
        ("kernel=" + (.kernel // empty))] | join(" ")' <<< "$1" 2>/dev/null)
    out=${out//[[:cntrl:]]/}
    echo "${out:-unknown}"
}

# fio job name: the host metadata, without characters that end an ini section name
client_job_name() {
    local name="hostname:${HOSTNAME},protocol:${PROTOCOL},drivetype:${DRIVE_TYPE},drivemodel:${DRIVE_MODEL}"
    printf '%s' "${name//[^A-Za-z0-9_.,:;+@-]/}"
}

# Target lines of a job file (like build_fio_target_args); ':' is escaped for fio
client_job_target_lines() {
    local base=$1 dir=${TARGET_DIR%/}
    if [ "$TARGET_IS_DEVICE" = true ]; then
        echo "filename=${TARGET_DIR//:/\\:}"
    elif [ "$FILE_PER_JOB" = 1 ]; then
        echo "directory=${dir//:/\\:}"
        echo "filename_format=${base}.\$jobnum"
        # Otherwise fio prefixes the files with the controller address (127.0.0.1 through SSH
        # tunnels) and the tests miss the files written by the prefill job
        echo "unique_filename=0"
    else
        echo "filename=${dir//:/\\:}/${base}"
    fi
}

# FIO_EXTRA_ARGS as job file lines: --key=value -> key=value, --flag -> flag.
# Command-line-only options and anything else are skipped with a warning.
client_extra_args_ini() {
    local arg key
    for arg in ${FIO_EXTRA_ARGS_ARR[@]+"${FIO_EXTRA_ARGS_ARR[@]}"}; do
        key=${arg#--}
        key=${key%%=*}
        if [[ "$arg" != --?* ]] || ! [[ "$key" =~ ^[A-Za-z0-9_]+$ ]]; then
            print_warning "FIO_EXTRA_ARGS: '$arg' cannot be used in a client job file - skipped"
            continue
        fi
        case "$key" in
            exec_*|output*|client|server|daemonize|remote*|section|minimal|append*|terse*|eta*|status*|debug|\
            parse*|showcmd|cmdhelp|enghelp|version|help|trigger*|aux*|bandwidth*|alloc*|max*jobs|readonly)
                print_warning "FIO_EXTRA_ARGS: '$arg' is a fio command-line option or runs commands - skipped"
                continue
                ;;
            ioengine)
                if [[ "${arg#*=}" == external* ]]; then
                    print_warning "FIO_EXTRA_ARGS: '$arg' loads code on the clients - skipped"
                    continue
                fi
                ;;
        esac
        echo "${arg#--}"
    done
}

# Write the benchmark job file for one client-mode test
# Usage: client_write_job_file <file> <pattern> <bs> <numjobs> <direct> <size> <sync> <iodepth> <runtime> <data base>
client_write_job_file() {
    local file=$1 pattern=$2 block_size=$3 num_jobs=$4 direct=$5 test_size=$6 sync=$7 iodepth=$8 runtime=$9
    local base=${10}
    {
        echo "[global]"
        echo "ioengine=${CLIENT_IOENGINE}"
        echo "direct=${direct}"
        echo "sync=${sync}"
        echo "bs=${block_size}"
        echo "rw=${pattern}"
        echo "iodepth=${iodepth}"
        echo "size=${test_size}"
        echo "runtime=${runtime}"
        echo "time_based"
        echo "group_reporting"
        echo "norandommap"
        echo "randrepeat=0"
        echo "thread"
        echo "numjobs=${num_jobs}"
        client_job_target_lines "$base"
        # Without PREFILL every test removes its data files on the clients
        if [ "$TARGET_IS_DEVICE" != true ] && [ "$PREFILL" != 1 ]; then echo "unlink=1"; fi
        client_extra_args_ini
        echo
        echo "[$(client_job_name)]"
        echo "description=${DESCRIPTION}"
    } >"$file"
}

# Job file that writes the PREFILL data files (incompressible) on every client
# Usage: client_write_prefill_job <file> <data base> <size> <files per job> <direct>
client_write_prefill_job() {
    local file=$1 base=$2 test_size=$3 num_jobs=$4 direct=$5 dir=${TARGET_DIR%/} j
    dir=${dir//:/\\:}
    {
        printf '%s\n' "[global]" "rw=write" "bs=1M" "size=${test_size}" "refill_buffers" "randrepeat=0" \
            "end_fsync=1" "ioengine=${CLIENT_IOENGINE}" "direct=${direct}" "thread"
        if [ "$FILE_PER_JOB" = 1 ]; then
            for ((j = 0; j < num_jobs; j++)); do
                printf '\n%s\n%s\n' "[prefill_${j}]" "filename=${dir}/${base}.${j}"
            done
        else
            printf '\n%s\n%s\n' "[prefill]" "filename=${dir}/${base}"
        fi
    } >"$file"
}

# Job file that removes the PREFILL data files on the clients (reads 4k, then unlink)
# Usage: client_write_cleanup_job <file> <data base> <size> <files per job>
client_write_cleanup_job() {
    local file=$1 base=$2 test_size=$3 num_jobs=$4 dir=${TARGET_DIR%/} j
    dir=${dir//:/\\:}
    {
        printf '%s\n' "[global]" "ioengine=psync" "rw=read" "bs=4k" "io_size=4k" "size=${test_size}" "unlink=1"
        if [ "$FILE_PER_JOB" = 1 ]; then
            for ((j = 0; j < num_jobs; j++)); do
                printf '\n%s\n%s\n' "[cleanup_${j}]" "filename=${dir}/${base}.${j}"
            done
        else
            printf '\n%s\n%s\n' "[cleanup]" "filename=${dir}/${base}"
        fi
    } >"$file"
}

# True when the step's JSON has a client_stats entry without error for each of the
# first <n> clients (matched on CLIENT_KEY "host:port") and no entry reports an error
client_step_complete() {
    local json=$1 n=$2 i keys
    [ -s "$json" ] || return 1
    jq -e '(.client_stats | type == "array") and ([.client_stats[] | (.error // 0)] | all(. == 0))' \
        "$json" >/dev/null 2>&1 || return 1
    # No control characters in any hostname; exactly one entry per expected client
    jq -e 'all(.client_stats[]; (.hostname // "" | tostring | test("[[:cntrl:]]") | not))' \
        "$json" >/dev/null 2>&1 || return 1
    keys=$(jq -r '.client_stats[] | select(.jobname != "All clients") | "\(.hostname):\(.port)"' "$json" 2>/dev/null)
    for ((i = 0; i < n; i++)); do
        [ "$(grep -cxF -- "${CLIENT_KEY[$i]}" <<< "$keys")" = 1 ] || return 1
    done
    return 0
}

# Total IOPS (read + write) of a step: the "All clients" entry, or the only client
client_step_iops() {
    jq -r '((.client_stats | map(select(.jobname == "All clients")) | .[0]) // .client_stats[0])
        | ((.read.iops // 0) + (.write.iops // 0)) + 0.5 | floor' "$1" 2>/dev/null
}

# Print IOPS, bandwidth and P95 latency of a step
display_client_step() {
    local line iops bw p95
    line=$(jq -r '((.client_stats | map(select(.jobname == "All clients")) | .[0]) // .client_stats[0])
        | [((.read.iops // 0) + (.write.iops // 0) + 0.5 | floor),
           (((.read.bw_bytes // 0) + (.write.bw_bytes // 0)) / 1048576 * 100 | floor / 100),
           ([.read, .write] | map(select((.iops // 0) > 0) | .clat_ns.percentile["95.000000"] // 0) | max // 0
            | . / 10000 | floor / 100)] | @tsv' "$1" 2>/dev/null) || return 0
    IFS=$'\t' read -r iops bw p95 <<< "$line"
    echo -e "  ${YELLOW}IOPS${NC}: ${iops}  ${BLUE}Bandwidth${NC}: ${bw} MB/s  ${CYAN}P95${NC}: ${p95}ms (all clients)"
}

# New ramp_uuid for one test configuration (shared by all its client-count steps)
new_ramp_uuid() {
    if command -v uuidgen >/dev/null 2>&1; then
        uuidgen | tr '[:upper:]' '[:lower:]'
    else
        generate_uuid_from_hash "${RUN_UUID}_$1_$(date +%s)_${RANDOM}${RANDOM}"
    fi
}

# Every test configuration as "bs|numjobs|pattern|direct|size|sync|iodepth|runtime"
# (same order as run_all_tests)
client_config_list() {
    local dim combo value
    local -a combos=("") next values
    for dim in BLOCK_SIZES NUM_JOBS TEST_PATTERNS DIRECT TEST_SIZE SYNC IODEPTH RUNTIME; do
        eval "values=(\"\${${dim}[@]}\")"
        next=()
        for combo in "${combos[@]}"; do
            for value in "${values[@]}"; do next+=("${combo:+${combo}|}${value}"); done
        done
        combos=("${next[@]}")
    done
    printf '%s\n' "${combos[@]}"
}

# Server messages ("<host> error: ...") that fio writes before the JSON, joined with "; "
client_output_messages() {
    grep -m 3 '^<[^>]*> ' "$1" 2>/dev/null | LC_ALL=C tr -d '\000-\037\177' | paste -sd ';' - | sed 's/;/; /g'
}

# Run a job file on the first <n> clients: fio --output=<json> --client=... <job file>.
# The output options come first: fio forwards options that follow a --client= to that
# server, which then tries to open the controller's output path.
# A server can refuse a job with a message and no results (e.g. "failed to setup shm
# segment" right after the previous job): retried up to FIO_RETRY_MAX times.
client_run_step() {
    local n=$1 job_file=$2 output=$3 label=$4 error_file rc attempt=0 notes old_pwd=$PWD
    error_file="${CLIENT_WORK_DIR}/${label}.err"
    client_fio_args "$n"
    # fio honours file requests from servers relative to the cwd: run in the private work dir
    cd "$CLIENT_WORK_DIR" || return 1
    while :; do
        rc=0
        rm -f "$output"
        run_fio_with_retry "$label" "$error_file" --output-format=json --output="$output" \
            "${CLIENT_FIO_ARGS[@]}" "$job_file" || rc=$?
        notes=$(client_output_messages "$output")
        if [ -s "$output" ]; then sanitize_fio_json "$output" >/dev/null 2>&1; fi
        if [ "$rc" -ne 0 ] || [ -z "$notes" ] || [ "$attempt" -ge "$FIO_RETRY_MAX" ] \
            || client_step_complete "$output" "$n"; then
            break
        fi
        attempt=$((attempt + 1))
        CLIENT_SERVER_RETRIES=$((${CLIENT_SERVER_RETRIES:-0} + 1))
        print_warning "fio server refused ${label}, retry ${attempt}/${FIO_RETRY_MAX} in 2s: ${notes}"
        sleep 2
    done
    if [ -n "$notes" ]; then print_warning "fio server message(s) for ${label}: ${notes}"; fi
    if [ "$rc" -ne 0 ]; then
        print_error "fio failed for ${label} (exit ${rc})"
        head -5 "$error_file" 2>/dev/null | while IFS= read -r line; do
            print_error "    ${line//[[:cntrl:]]/}"
        done
    fi
    rm -f "$error_file"
    cd "$old_pwd" || true
    return "$rc"
}

# File name label of a ramp step (only [A-Za-z0-9_.+-])
# Usage: client_step_label <n> <pattern> <bs> <numjobs> <direct> <size> <sync> <iodepth> <runtime>
client_step_label() {
    local label="${2}_${3}_${4}_${5}_${6}_${7}_${8}_${9}_clients${1}"
    printf '%s' "${label//[^A-Za-z0-9_.+-]/}"
}

# One ramp step: run a test configuration on the first <n> clients and upload the result
# Usage: client_run_ramp_step <n> <pattern> <bs> <numjobs> <direct> <size> <sync> <iodepth> <runtime>
client_run_ramp_step() {
    local n=$1 pattern=$2 block_size=$3 num_jobs=$4 direct=$5 test_size=$6 sync=$7 iodepth=$8 runtime=$9
    local label job_file output base rc=0
    label=$(client_step_label "$@")
    job_file="${CLIENT_WORK_DIR}/${label}.fio" output="${CLIENT_WORK_DIR}/${label}.json"
    base=$(data_file_base "fio_test_${pattern}_${block_size}" "$test_size")
    STEP_CLIENTS=$n STEP_COMPLETE=1
    build_description
    client_write_job_file "$job_file" "$pattern" "$block_size" "$num_jobs" "$direct" "$test_size" \
        "$sync" "$iodepth" "$runtime" "$base"
    print_step "${pattern} bs=${block_size} jobs=${num_jobs} iodepth=${iodepth} on ${n} client(s): $(client_hosts_list "$n")"
    client_run_step "$n" "$job_file" "$output" "$label" || rc=$?
    if [ "$rc" -ne 0 ] || ! client_step_complete "$output" "$n"; then STEP_COMPLETE=0; fi
    if ! jq -e '.client_stats | type == "array"' "$output" >/dev/null 2>&1; then
        print_error "No fio client results for ${label} - not uploaded"
        CLIENT_STEPS_FAILED=$((CLIENT_STEPS_FAILED + 1))
        rm -f "$job_file" "$output"
        return 1
    fi
    if [ "$STEP_COMPLETE" = 0 ]; then
        print_warning "Step incomplete (fio error or a client missing in client_stats) - uploading with ramp_step_complete=0"
        CLIENT_STEPS_INCOMPLETE=$((CLIENT_STEPS_INCOMPLETE + 1))
        build_description
    fi
    keep_json_copy "$output"
    display_client_step "$output"
    STEP_CLIENT_HOSTS=$(client_hosts_list "$n")
    STEP_CLIENT_STORAGE=$(client_storage_info_json "$n")
    if upload_results "$output" "$label"; then
        CLIENT_UPLOADS_OK=$((CLIENT_UPLOADS_OK + 1))
    else
        CLIENT_UPLOADS_FAILED=$((CLIENT_UPLOADS_FAILED + 1))
    fi
    rm -f "$job_file" "$output"
    [ "$STEP_COMPLETE" = 1 ]
}

# One test configuration over all ramp steps, with its own ramp_uuid
client_run_config() {
    local n
    RAMP_UUID=$(new_ramp_uuid "$*")
    print_status "ramp_uuid: ${RAMP_UUID} (client counts: ${RAMP_STEPS[*]})"
    for n in "${RAMP_STEPS[@]}"; do
        client_run_ramp_step "$n" "$@"
    done
}

# PREFILL=1: write the data files once on ALL clients before the first test
client_prefill_all() {
    local test_size base max_jobs job_file rc=0 n=${#CLIENT_KEY[@]}
    max_jobs=$(get_max_value "${NUM_JOBS[@]}")
    for test_size in "${TEST_SIZE[@]}"; do
        base=$(data_file_base "" "$test_size")
        job_file="${CLIENT_WORK_DIR}/prefill_${test_size}.fio"
        client_write_prefill_job "$job_file" "$base" "$test_size" "$max_jobs" "${DIRECT[0]}"
        print_status "Prefilling ${base} (${test_size}) on all ${n} client(s) - once for the whole run..."
        if ! client_run_step "$n" "$job_file" "${CLIENT_WORK_DIR}/prefill_${test_size}.json" "prefill_${test_size}"; then
            rc=1
        fi
    done
    return "$rc"
}

# PREFILL=1: remove the data files on all clients after the last test
client_cleanup_all() {
    local test_size base max_jobs job_file n=${#CLIENT_KEY[@]}
    if [ "$PREFILL" != 1 ] || [ "$TARGET_IS_DEVICE" = true ]; then return 0; fi
    max_jobs=$(get_max_value "${NUM_JOBS[@]}")
    for test_size in "${TEST_SIZE[@]}"; do
        base=$(data_file_base "" "$test_size")
        job_file="${CLIENT_WORK_DIR}/cleanup_${test_size}.fio"
        client_write_cleanup_job "$job_file" "$base" "$test_size" "$max_jobs"
        print_status "Removing ${base} data files on all ${n} client(s)..."
        client_run_step "$n" "$job_file" "${CLIENT_WORK_DIR}/cleanup_${test_size}.json" "cleanup_${test_size}" \
            || print_warning "Could not remove ${base} on every client - remove it manually from ${TARGET_DIR}"
    done
}

# Client mode: every test configuration once per ramp step on the clients
run_client_tests() {
    local config pattern block_size num_jobs direct test_size sync iodepth runtime current=0
    local -a configs=()
    CLIENT_UPLOADS_OK=0 CLIENT_UPLOADS_FAILED=0 CLIENT_STEPS_FAILED=0 CLIENT_STEPS_INCOMPLETE=0
    while IFS= read -r config; do configs+=("$config"); done < <(client_config_list)
    print_status "Starting ${#configs[@]} test configuration(s) x ${#RAMP_STEPS[@]} ramp step(s) on ${#CLIENT_KEY[@]} client(s)..."
    if [ "$PREFILL" = 1 ] && ! client_prefill_all; then
        print_error "Prefill failed on the clients - stopping"
        return 1
    fi
    for config in "${configs[@]}"; do
        current=$((current + 1))
        IFS='|' read -r block_size num_jobs pattern direct test_size sync iodepth runtime <<< "$config"
        print_status "Test ${current}/${#configs[@]}: ${pattern} ${block_size} jobs=${num_jobs} direct=${direct} size=${test_size} sync=${sync} iodepth=${iodepth} runtime=${runtime}"
        client_run_config "$pattern" "$block_size" "$num_jobs" "$direct" "$test_size" "$sync" "$iodepth" "$runtime"
        echo
    done
    client_cleanup_all

    echo "========================================="
    echo "Client Test Summary"
    echo "========================================="
    echo "Configurations:   ${#configs[@]} x ramp steps ${RAMP_STEPS[*]}"
    echo "Uploaded:         $CLIENT_UPLOADS_OK"
    echo "Upload failures:  $CLIENT_UPLOADS_FAILED"
    echo "Incomplete steps: $CLIENT_STEPS_INCOMPLETE"
    echo "Failed steps:     $CLIENT_STEPS_FAILED (no results)"
    echo "EAGAIN retries:   $FIO_RETRY_COUNT"
    echo "Server retries:   ${CLIENT_SERVER_RETRIES:-0} (job refused by a fio server)"
    echo "========================================="
    [ $((CLIENT_UPLOADS_FAILED + CLIENT_STEPS_FAILED + CLIENT_STEPS_INCOMPLETE)) -eq 0 ]
}

# Main function
main() {
    echo "FIO Performance Testing Script"
    echo "============================="
    echo
    
    # Parse command-line arguments
    local skip_confirmation=false
    local server_action=""
    local env_files=()
    local args=()

    while [[ $# -gt 0 ]]; do
        case $1 in
            -y|--yes)
                skip_confirmation=true
                shift
                ;;
            --server)
                server_action=start
                shift
                ;;
            --server-stop)
                server_action=stop
                shift
                ;;
            --clients)
                if [ -z "$2" ] || [[ "$2" =~ ^- ]]; then
                    print_error "Option --clients requires a comma-separated list of fio servers"
                    exit 1
                fi
                CLI_CLIENTS="$2"
                shift 2
                ;;
            --ramp-clients)
                if [ -z "$2" ] || [[ "$2" =~ ^- ]]; then
                    print_error "Option --ramp-clients requires ascending client counts, e.g. 1,2,4"
                    exit 1
                fi
                CLI_RAMP_CLIENTS="$2"
                shift 2
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

    # Server mode: this host serves fio jobs for a controller (no tests, no uploads)
    if [ -n "$server_action" ]; then
        define_defaults
        apply_cli_overrides
        if [ "$server_action" = stop ]; then run_server_stop_mode; fi
        run_server_mode
    fi

    init_config
    warn_default_credentials

    # Check prerequisites
    check_fio
    check_curl
    if [ "$SATURATION_MODE" = true ] || [ "$CLIENT_MODE" = true ]; then check_jq; fi

    if [ "$CLIENT_MODE" = true ]; then
        # Controller: TARGET_DIR lives on the clients; their storage comes from their info servers
        CLIENT_WORK_DIR=$(mktemp -d "${TMPDIR:-/tmp}/fio-clients.XXXXXX") || exit 1
        # Tunnels and the job/result work dir go away however the script ends
        trap 'client_close_tunnels; if [ -n "$CLIENT_WORK_DIR" ]; then rm -rf "$CLIENT_WORK_DIR"; fi' EXIT
        print_client_security_warning
        client_setup_connections || exit 1
        client_fetch_info
        # Before show_config and before any job file is written
        client_choose_ioengine
    else
        # Setup target (detect device vs directory mode)
        setup_target_dir

        # Detect the storage configuration once (uploaded with every result)
        detect_storage
    fi

    # Show configuration
    show_config

    # Validate test configuration for potential issues (skip in saturation mode)
    local config_warnings=0
    if [ "$SATURATION_MODE" != true ]; then
        validate_test_config
        config_warnings=$?
    fi

    # DRIVE_MODEL/DRIVE_TYPE vs. detected storage (warnings only; not in client mode)
    if [ "$CLIENT_MODE" = true ]; then STORAGE_WARNINGS=0; else storage_plausibility_checks; fi
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
        if [ "$CLIENT_MODE" = true ]; then
            print_status "  Clients: ${#CLIENT_ENTRY[@]}, ramp steps: ${RAMP_STEPS[*]}"
            total_tests=$((total_tests * ${#RAMP_STEPS[@]}))
        fi
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
        if [ "$CLIENT_MODE" = true ]; then
            print_error "   on EVERY client: ${CLIENT_ENTRY[*]}"
        fi
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
    if [ "$CLIENT_MODE" = true ]; then
        if run_client_tests; then
            print_retry_summary
            print_success "Client testing completed successfully!"
        else
            print_retry_summary
            print_error "Client testing completed with errors or incomplete steps."
            cleanup
            exit 1
        fi
    elif [ "$SATURATION_MODE" = true ]; then
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


# ============================================================
# Multi-client mode (fio client/server)
# ============================================================
# Load many hosts (e.g. all VMs of a hypervisor or all Ceph clients) at the same time
# and upload the combined result. Each client runs './fio-test.sh --server'; the
# controller sets CLIENTS and runs './fio-test.sh' as usual.
#
# --- On every client (server mode: ./fio-test.sh --server) ---
# SECURITY: fio's server has NO authentication. Anyone who can reach the port can run
# any fio job as that user: write files and block devices (as root: every disk) and run
# commands (exec_prerun). Use only an isolated benchmark network and allow only the
# controller, e.g. (8765 = FIO_SERVER_PORT, 8766 = FIO_SERVER_INFO_PORT):
#   nft insert rule inet filter input tcp dport { 8765, 8766 } ip saddr != <CONTROLLER_IP> drop
#   iptables -I INPUT -p tcp -m multiport --dports 8765,8766 ! -s <CONTROLLER_IP> -j DROP
# FIO_SERVER_BIND=10.44.44.101   # Required: IP to listen on (0.0.0.0 / :: are refused).
#                                # 127.0.0.1 = no network exposure; the controller then
#                                # uses SSH tunnels (CLIENT_SSH=1)
# FIO_SERVER_PORT=8765           # fio server port
# FIO_SERVER_INFO_PORT=8766      # Read-only HTTP (python3) with storage.json + hostname.txt;
#                                # default FIO_SERVER_PORT + 1
# FIO_SERVER_TIMEOUT=2h          # Stop by itself after this (seconds or s/m/h, 0 = never)
# FIO_SERVER_ALLOW_ROOT=0        # 1 = allow a 127.0.0.1/::1 server as root (every local
#                                # user could then run jobs and commands as root)
# FIO_SERVER_STATE_DIR=/run/fio-test  # PID files + published info (default: /run/fio-test,
#                                # else \$XDG_RUNTIME_DIR/fio-test, else a temp dir);
#                                # stop with ./fio-test.sh --server-stop (same dir)
# TARGET_DIR on the client is the directory/device the controller's TARGET_DIR names
# (created by --server when missing; its storage detection is what gets published).
#
# --- On the controller (client mode: CLIENTS set) ---
# SECURITY: the controller trusts every client. fio's client/server protocol has no
# authentication and no encryption, and a fio server can make the controller read or
# write files. Use an isolated network or CLIENT_SSH=1, run the controller as an
# unprivileged user on a single-user host, and keep this .env readable only by that
# user (chmod 600 .env).
# CLIENTS=10.44.44.101,10.44.44.102,10.44.44.103   # host[:port[:infoport]], [IPv6]:port
# RAMP_CLIENTS=1,2,4,6,8,10      # Optional: each test runs with the first N clients per step
#                                # (ascending); all steps of a test share one ramp_uuid
# CLIENT_SSH=0                   # 1 = SSH tunnel per client (ssh -N -L, key login, BatchMode):
#                                # for servers bound to 127.0.0.1, nothing open on the network
# CLIENT_SSH_USER=root           # SSH user for the tunnels (default: ssh config / current user)
# CLIENT_SSH_BASE_PORT=18765     # Local tunnel ports from here (2 per client)
# CLIENT_IOENGINE=libaio         # I/O engine on the clients. Unset = the best engine ALL
#                                # clients support (io_uring > libaio > psync, published by
#                                # their --server), libaio if a client publishes none
#                                # (--engine on the controller also sets it)
# CLIENT_TARGET_IS_DEVICE=auto   # TARGET_DIR is a path ON THE CLIENTS (absolute, same on all);
#                                # auto = block device when it starts with /dev/, 0/1 = force.
#                                # e.g. TARGET_DIR=/dev/disk/by-id/scsi-0QEMU_QEMU_HARDDISK_drive-scsi1
#                                # (DESTRUCTIVE: the whole device on every client is overwritten)
# HOSTNAME/PROTOCOL/DRIVE_TYPE/DRIVE_MODEL describe the group, e.g. HOSTNAME=px1-vms.
# Uploads add clients, ramp_uuid, client_hosts, client_storage_info and ramp_step_complete;
# the description gets clients:N, ramp:1 and incomplete:1 (a client missing or failed).
# Not combinable with SATURATION_MODE / --saturation.


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
                         (client mode: engine of the clients, overrides CLIENT_IOENGINE)

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
  -P, --password PASS    Upload password (default: uploader). Visible in the process
                         list (ps) - prefer PASSWORD in a .env readable only by you

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

Server Mode (this host runs fio jobs for a controller):
  --server               Start 'fio --server' on FIO_SERVER_BIND:FIO_SERVER_PORT and publish
                         this host's storage detection for TARGET_DIR and I/O engine
                         (IOENGINE / --engine, else auto-detected) as storage.json, plus
                         hostname.txt, read-only on FIO_SERVER_BIND:FIO_SERVER_INFO_PORT
                         (python3 -m http.server; skipped with a warning without python3).
                         Runs in the foreground until Ctrl-C, --server-stop or FIO_SERVER_TIMEOUT.
  --server-stop          Stop the server recorded in the state directory (only its own PIDs)
  SECURITY: fio's server has NO authentication. Anyone who can reach the port can run any
  fio job as this user: write files and block devices (as root: every disk) and run commands
  (exec_prerun). Use it only on an isolated network and allow only the controller, e.g.
    nft insert rule inet filter input tcp dport { 8765, 8766 } ip saddr != <CONTROLLER_IP> drop
    iptables -I INPUT -p tcp -m multiport --dports 8765,8766 ! -s <CONTROLLER_IP> -j DROP
  FIO_SERVER_BIND=IP     Address to listen on (required; 0.0.0.0 / :: are refused).
                         127.0.0.1 or ::1 = no network exposure: the controller then reaches
                         the server through SSH tunnels (CLIENT_SSH=1)
  FIO_SERVER_PORT=N      fio server port (default: 8765)
  FIO_SERVER_INFO_PORT=N Info HTTP port (default: FIO_SERVER_PORT + 1 = 8766)
  FIO_SERVER_TIMEOUT=T   Stop after T (seconds or s/m/h suffix, 0 = never; default: 2h)
  FIO_SERVER_ALLOW_ROOT=1
                         Allow a loopback (127.0.0.1/::1) server as root; refused by default
                         because every local user could then run jobs and commands as root
  FIO_SERVER_STATE_DIR=D PID files and published info (default: /run/fio-test when writable,
                         else \$XDG_RUNTIME_DIR/fio-test, else a new temp dir; --server-stop
                         needs the same directory; use one per instance on the same host)

Client Mode (this host is the controller; active when CLIENTS is set):
  --clients LIST         = CLIENTS: fio servers, comma-separated host[:port[:infoport]]
                         (IPv6 as [addr]:port; port default FIO_SERVER_PORT, info port default
                         FIO_SERVER_INFO_PORT or port + 1). Every test runs on the clients at
                         once with 'fio --client=... job.fio'; the combined JSON (client_stats
                         with one entry per client plus "All clients") is uploaded per step.
  --ramp-clients LIST    = RAMP_CLIENTS: ascending client counts, e.g. 1,2,4,8: each test runs
                         with the first N clients per step. All steps of a test configuration
                         share one ramp_uuid (run_uuid stays one per script run).
  SECURITY: the controller trusts every client. fio's protocol has no authentication and no
  encryption, and a fio server can make the controller read or write files. Use an isolated
  network or CLIENT_SSH=1, run the controller as an unprivileged user on a single-user host
  (tunnel ports on 127.0.0.1 are reachable by every local user) and keep its .env readable
  only by that user (chmod 600).
  CLIENT_SSH=0|1         1 = one SSH tunnel per client (ssh -N -L, key-based login, BatchMode);
                         fio and the info server are then reached on 127.0.0.1 ports from
                         CLIENT_SSH_BASE_PORT (default: 18765, 2 ports per client). Use it
                         with servers bound to 127.0.0.1 (no open port on the network)
  CLIENT_SSH_USER=USER   SSH user for the tunnels (default: current user / ssh config)
  CLIENT_IOENGINE=ENG    I/O engine used on the clients (-i/--engine also sets it). Unset: the
                         best engine supported by ALL clients (io_uring > libaio > psync, as
                         detected and published by their --server); libaio when a client
                         publishes none (older --server)
  CLIENT_TARGET_IS_DEVICE=auto|0|1
                         TARGET_DIR is a path ON THE CLIENTS (same everywhere, absolute; not
                         created or checked locally). auto = block device when it starts
                         with /dev/ (e.g. /dev/disk/by-id/...drive-scsi1: DESTRUCTIVE!)
  HOSTNAME/PROTOCOL/DRIVE_TYPE/DRIVE_MODEL describe the group, e.g. HOSTNAME=px1-vms.
  Uploads add clients, ramp_uuid, client_hosts, client_storage_info (each client's
  storage.json) and ramp_step_complete; description tags clients:N, ramp:1, incomplete:1.
  A step is incomplete (still uploaded) when fio fails or a client is missing or reports
  an error. PREFILL writes the data files once on all clients before the first test.
  Not combinable with --saturation.

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

  # Multi-client: on every VM (isolated network), then on the controller
  FIO_SERVER_BIND=10.44.44.101 TARGET_DIR=/mnt/fio $0 --server
  $0 --clients 10.44.44.101,10.44.44.102 --ramp-clients 1,2 --target-dir /mnt/fio -y

  # Multi-client over SSH tunnels (servers bound to 127.0.0.1)
  FIO_SERVER_BIND=127.0.0.1 $0 --server                  # on each client
  CLIENT_SSH=1 CLIENT_SSH_USER=root $0 --clients vm1,vm2   # on the controller

EOF
    exit 0
fi

# Run main function
main "$@"
