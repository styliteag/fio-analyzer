#!/usr/bin/env bash
# Tests for the saturation size cap (SAT_MAX_TOTAL_SIZE) in fio-test.sh
# (run: bash scripts/tests/test_sat_size_cap.sh)
# Loads only the needed functions from the script and replaces fio with a stub.

# shellcheck disable=SC2034,SC2329  # config vars and stubs are used by the sourced functions

set -u
SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/fio-test.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

FUNCS="fio_size_to_bytes bytes_to_mib_size sat_cap_active validate_sat_cap sat_step_size
sat_drop_stale_prefill build_description data_file_base build_fio_target_args
prefill_test_files remove_test_files run_fio_step apply_cachefit_tag cache_fit_apply
cache_fit_check test_working_set_bytes host_cache_bytes cache_mul si_byte_count human_bytes
cache_fit_text cache_size_bytes"
SED_EXPR=""
for f in $FUNCS; do SED_EXPR+="/^${f}()/,/^}/p;"; done
# shellcheck source=/dev/null
source <(sed -n "$SED_EXPR" "$SCRIPT")
for f in $FUNCS; do
    declare -F "$f" >/dev/null || { echo "function $f not found in $SCRIPT"; exit 1; }
done

print_status() { echo "STATUS: $*" >>"$TMP/status"; }
print_step() { :; }
print_error() { echo "ERR: $*" >>"$TMP/errors"; }
print_warning() { echo "WARN: $*" >>"$TMP/warnings"; }
sanitize_fio_json() { return 0; }
keep_json_copy() { return 0; }
# Records the benchmark arguments instead of running fio
run_fio_with_retry() { shift 2; printf '%s\n' "$@" >"$TMP/args"; return 0; }
# Prefill stub: create every --filename=<path> target
fio() {
    local a
    for a in "$@"; do
        case "$a" in --filename=*) : >"${a#--filename=}" ;; esac
    done
    return 0
}

failures=0
check() {  # check <description> <expected> <actual>
    if [ "$2" = "$3" ]; then
        echo "ok   - $1"
    else
        echo "FAIL - $1 (expected '$2', got '$3')"
        failures=$((failures + 1))
    fi
}
arg() { grep "^--$1=" "$TMP/args" | head -1 | cut -d= -f2-; }
warn_count() { grep -c "$1" "$TMP/warnings" 2>/dev/null || true; }

# --- fio_size_to_bytes ---------------------------------------------------------
check "plain bytes" 4096 "$(fio_size_to_bytes 4096)"
check "512K" 524288 "$(fio_size_to_bytes 512K)"
check "lowercase k" 524288 "$(fio_size_to_bytes 512k)"
check "10M" 10485760 "$(fio_size_to_bytes 10M)"
check "8G" 8589934592 "$(fio_size_to_bytes 8G)"
check "1T" 1099511627776 "$(fio_size_to_bytes 1T)"
check "lowercase g" 8589934592 "$(fio_size_to_bytes 8g)"
check "GiB suffix" 8589934592 "$(fio_size_to_bytes 8GiB)"
check "GB suffix (fio kb_base 1024)" 8589934592 "$(fio_size_to_bytes 8gb)"
fio_size_to_bytes abc >/dev/null; check "garbage is rejected" 1 "$?"
fio_size_to_bytes "" >/dev/null; check "empty is rejected" 1 "$?"
fio_size_to_bytes 1.5G >/dev/null; check "fraction is rejected" 1 "$?"
fio_size_to_bytes 10X >/dev/null; check "unknown unit is rejected" 1 "$?"
fio_size_to_bytes 0 >/dev/null; check "zero is rejected" 1 "$?"

# --- bytes_to_mib_size ---------------------------------------------------------
check "1 MiB" 1M "$(bytes_to_mib_size 1048576)"
check "rounds down" 2M "$(bytes_to_mib_size 3145727)"
check "8G in MiB" 8192M "$(bytes_to_mib_size 8589934592)"
check "below 1 MiB gives 0M" 0M "$(bytes_to_mib_size 1000)"

# --- validate_sat_cap ------------------------------------------------------------
: >"$TMP/warnings"
FILE_PER_JOB=1 SAT_MAX_TOTAL_SIZE="8G"
validate_sat_cap
check "valid cap is kept" 8G "$SAT_MAX_TOTAL_SIZE"
SAT_MAX_TOTAL_SIZE="lots"
validate_sat_cap
check "invalid cap is disabled" "" "$SAT_MAX_TOTAL_SIZE"
check "invalid cap warns" 1 "$(warn_count SAT_MAX_TOTAL_SIZE)"
: >"$TMP/warnings"
FILE_PER_JOB=0 SAT_MAX_TOTAL_SIZE="8G"
validate_sat_cap
check "cap without FILE_PER_JOB is disabled" "" "$SAT_MAX_TOTAL_SIZE"
check "cap without FILE_PER_JOB warns" 1 "$(warn_count FILE_PER_JOB)"
: >"$TMP/warnings"
FILE_PER_JOB=0 SAT_MAX_TOTAL_SIZE=""
validate_sat_cap
check "empty cap: no warning" 0 "$(warn_count .)"

# --- sat_step_size ---------------------------------------------------------------
: >"$TMP/warnings"
SAT_CAP_MIN_WARNED=false
FILE_PER_JOB=1 SAT_TEST_SIZE=10G SAT_MAX_TOTAL_SIZE=""
sat_step_size 64
check "no cap: test size unchanged" 10G "$SAT_STEP_SIZE"
FILE_PER_JOB=0 SAT_MAX_TOTAL_SIZE=8G
sat_step_size 64
check "no FILE_PER_JOB: test size unchanged" 10G "$SAT_STEP_SIZE"
FILE_PER_JOB=1 SAT_TEST_SIZE=10G SAT_MAX_TOTAL_SIZE=8G
sat_step_size 4
check "cap/numjobs smaller: capped (8G/4)" 2048M "$SAT_STEP_SIZE"
sat_step_size 3
check "capped size rounds down to MiB (8G/3)" 2730M "$SAT_STEP_SIZE"
SAT_TEST_SIZE=1G
sat_step_size 4
check "test size smaller than cap share: unchanged" 1G "$SAT_STEP_SIZE"
SAT_TEST_SIZE=512K SAT_MAX_TOTAL_SIZE=100G
sat_step_size 4
check "small test size is not rounded" 512K "$SAT_STEP_SIZE"
check "no minimum warning so far" 0 "$(warn_count minimum)"
SAT_TEST_SIZE=10G SAT_MAX_TOTAL_SIZE=8M
sat_step_size 16
check "minimum 1M applies" 1M "$SAT_STEP_SIZE"
sat_step_size 32
check "minimum 1M applies again" 1M "$SAT_STEP_SIZE"
check "minimum warning is printed once" 1 "$(warn_count minimum)"
SAT_TEST_SIZE=bogus SAT_MAX_TOTAL_SIZE=8M
sat_step_size 4
check "unparseable test size falls back unchanged" bogus "$SAT_STEP_SIZE"

# --- build_description tag -------------------------------------------------------
SATURATION_MODE=true BASE_DESCRIPTION="" PREFILL=1 FILE_PER_JOB=1 SAT_MAX_TOTAL_SIZE=8G
HOSTNAME=h PROTOCOL=p DRIVE_TYPE=t DRIVE_MODEL=m CONFIG_UUID=c RUN_UUID=r
build_description
check "satcap tag in description" 1 "$(grep -c ',satcap:8G' <<<"$DESCRIPTION")"
SAT_MAX_TOTAL_SIZE=""
build_description
check "no satcap tag without cap" 0 "$(grep -c 'satcap' <<<"$DESCRIPTION")"

# --- run_fio_step wiring -----------------------------------------------------------
TARGET_DIR="$TMP/target"
mkdir -p "$TARGET_DIR"
TARGET_IS_DEVICE=false IOENGINE=psync SAT_DIRECT=0 SAT_SYNC=none SAT_RUNTIME=1
FIO_EXTRA_ARGS_ARR=() SAT_CURRENT_BS=4k SAT_PREFILL_BASE="" SAT_CAP_MIN_WARNED=false
PREFILL=1 FILE_PER_JOB=1 SAT_TEST_SIZE=4M SAT_MAX_TOTAL_SIZE=8M
: >"$TMP/status"

run_fio_step randread 1 4 "$TMP/out.json"
check "step 1 --size is capped (8M/4)" 2M "$(arg size)"
# shellcheck disable=SC2016  # literal $jobnum is expected
check "step 1 filename_format uses capped size" 'fio_data_2M.$jobnum' "$(arg filename_format)"
check "step 1 prefilled 4 files" 4 "$(find "$TARGET_DIR" -name 'fio_data_2M.*' | wc -l | tr -d ' ')"
check "per-job size is printed" 1 "$(grep -c 'per-job' "$TMP/status")"

run_fio_step randread 1 8 "$TMP/out.json"
check "step 2 --size is capped (8M/8)" 1M "$(arg size)"
check "step 2 old prefill files removed" 0 "$(find "$TARGET_DIR" -name 'fio_data_2M*' | wc -l | tr -d ' ')"
check "step 2 prefilled 8 files" 8 "$(find "$TARGET_DIR" -name 'fio_data_1M.*' | wc -l | tr -d ' ')"

# Without a cap the test size and files are used as before
SAT_MAX_TOTAL_SIZE="" SAT_PREFILL_BASE=""
rm -f "$TARGET_DIR"/*
: >"$TMP/status"
run_fio_step randread 1 4 "$TMP/out.json"
check "uncapped --size is the test size" 4M "$(arg size)"
check "uncapped prefill files" 4 "$(find "$TARGET_DIR" -name 'fio_data_4M.*' | wc -l | tr -d ' ')"
check "uncapped: no per-job size line" 0 "$(grep -c 'per-job' "$TMP/status")"
run_fio_step randread 1 8 "$TMP/out.json"
check "uncapped: same-size files are reused" 8 "$(find "$TARGET_DIR" -name 'fio_data_4M.*' | wc -l | tr -d ' ')"

if [ "$failures" -gt 0 ]; then
    echo "$failures test(s) failed"
    exit 1
fi
echo "all tests passed"
