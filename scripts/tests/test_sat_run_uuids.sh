#!/usr/bin/env bash
# Tests for the run_uuid display with several saturation runs in fio-test.sh
# (run: bash scripts/tests/test_sat_run_uuids.sh)
# show_config prints a placeholder instead of an unused run_uuid, and
# run_saturation_runs lists every run's (block size, sync, run_uuid) at the end.

# shellcheck disable=SC2034,SC2329  # config vars and stubs are used by the sourced functions

set -u
SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/fio-test.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

FUNCS="get_max_value sat_cap_active show_config run_saturation_runs"
SED_EXPR=""
for f in $FUNCS; do SED_EXPR+="/^${f}()/,/^}/p;"; done
# shellcheck source=/dev/null
source <(sed -n "$SED_EXPR" "$SCRIPT")
for f in $FUNCS; do
    declare -F "$f" >/dev/null || { echo "function $f not found in $SCRIPT"; exit 1; }
done

print_status() { :; }
storage_summary() { echo "fs=stub"; }
cache_summary() { echo "stub"; }
reset_sat_results() { :; }
build_description() { DESCRIPTION="run_uuid:${RUN_UUID}"; }
saturation_loop() { echo "LOOP $1 $SAT_SYNC $RUN_UUID"; }
print_saturation_summary() { echo "SUMMARY $1 $SAT_SYNC"; }
echo 0 >"$TMP/uuid_n"
uuidgen() {  # runs in a subshell, so count in a file
    local n
    n=$(( $(cat "$TMP/uuid_n") + 1 ))
    echo "$n" >"$TMP/uuid_n"
    echo "uuid-$n-abcdef"
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

# Common config for show_config
HOSTNAME=h PROTOCOL=p DESCRIPTION=d DRIVE_MODEL=m DRIVE_TYPE=t CONFIG_UUID=c
RUN_UUID="header-uuid-1234" TEST_SIZE=4M NUM_JOBS=1 RUNTIME=(1) DIRECT=1 IOENGINE=psync
IODEPTH=1 BACKEND_URL=u TARGET_IS_DEVICE=false TARGET_DIR=/x USERNAME=u FIO_EXTRA_ARGS=""
KEEP_JSON_DIR="" PREFILL=0 FILE_PER_JOB=0 SAT_MAX_TOTAL_SIZE="" SAT_PATTERNS_ARR=(randread)
LATENCY_THRESHOLD_MS=100 INITIAL_IODEPTH=1 INITIAL_NUMJOBS=1 MAX_STEPS=1 MAX_TOTAL_QD=16
BLOCK_SIZES=(4k) TEST_PATTERNS=(read) SAT_TEST_SIZE=4M
PLACEHOLDER="Run UUID:     one per block size × sync mode (listed at the end)"

# --- show_config header -----------------------------------------------------------
SATURATION_MODE=false
show_config >"$TMP/out"
check "standard mode prints run_uuid" 1 "$(grep -cx 'Run UUID:     header-uuid-1234' "$TMP/out")"

SATURATION_MODE=true SAT_BLOCK_SIZES_ARR=(64k) SAT_SYNC_ARR=(1)
show_config >"$TMP/out"
check "single saturation run prints run_uuid" 1 "$(grep -cx 'Run UUID:     header-uuid-1234' "$TMP/out")"
check "single saturation run: no placeholder" 0 "$(grep -cF "$PLACEHOLDER" "$TMP/out")"

SAT_BLOCK_SIZES_ARR=(4k 64k) SAT_SYNC_ARR=(1)
show_config >"$TMP/out"
check "several block sizes: placeholder" 1 "$(grep -cxF "$PLACEHOLDER" "$TMP/out")"
check "several block sizes: header uuid hidden" 0 "$(grep -c 'header-uuid-1234' "$TMP/out")"

SAT_BLOCK_SIZES_ARR=(64k) SAT_SYNC_ARR=(none sync)
show_config >"$TMP/out"
check "several sync modes: placeholder" 1 "$(grep -cxF "$PLACEHOLDER" "$TMP/out")"

check "storage line in header" 1 "$(grep -cx 'Storage:      fs=stub' "$TMP/out")"

# --- run_saturation_runs: list of run UUIDs --------------------------------------
SAT_BLOCK_SIZES_ARR=(4k 64k) SAT_SYNC_ARR=(none sync) RUN_UUID="header-uuid-1234"
run_saturation_runs >"$TMP/out" 2>"$TMP/err"
check "no errors on stderr" "" "$(cat "$TMP/err")"
check "list header printed once" 1 "$(grep -c '^Run UUIDs:' "$TMP/out")"
check "list comes after the last summary" \
    "$(grep -n '^SUMMARY 64k sync' "$TMP/out" | cut -d: -f1)" \
    "$(( $(grep -n '^Run UUIDs:' "$TMP/out" | cut -d: -f1) - 1 ))"
list=$(sed -n '/^Run UUIDs:/,$p' "$TMP/out" | tail -n +2)
check "four list entries" 4 "$(grep -c 'uuid-' <<<"$list")"
check "three new uuids generated" 3 "$(cat "$TMP/uuid_n")"
# The first run uses the RUN_UUID generated at start (shown in the header and first description)
check "entry 1: first run keeps the start RUN_UUID" 1 "$(grep -Ec 'bs=4k +sync=none +header-uuid-1234$' <<<"$list")"
check "entry 4: bs, sync and full uuid" 1 "$(grep -Ec 'bs=64k +sync=sync +uuid-3-abcdef$' <<<"$list")"
check "list uuids match the runs" \
    "$(grep '^LOOP' "$TMP/out" | awk '{print $4}' | tr '\n' ' ')" \
    "$(awk '{print $NF}' <<<"$list" | tr '\n' ' ')"
check "banner unchanged" 1 "$(grep -c '║  Block Size: 64k  Sync: sync  (run_uuid: uuid-3-a…)' "$TMP/out")"

SAT_BLOCK_SIZES_ARR=(4k 64k) SAT_SYNC_ARR=(1)
run_saturation_runs >"$TMP/out" 2>"$TMP/err"
check "several block sizes, one sync: list printed" 1 "$(grep -c '^Run UUIDs:' "$TMP/out")"
check "sync shown in list" 2 "$(grep -Ec 'bs=(4k|64k) +sync=1 ' "$TMP/out")"

SAT_BLOCK_SIZES_ARR=(64k) SAT_SYNC_ARR=(1) RUN_UUID="header-uuid-1234"
run_saturation_runs >"$TMP/out" 2>"$TMP/err"
check "single run: no list" 0 "$(grep -c 'Run UUIDs' "$TMP/out")"
check "single run: uploads use the header RUN_UUID" "LOOP 64k 1 header-uuid-1234" "$(grep '^LOOP' "$TMP/out")"
check "single run: no errors" "" "$(cat "$TMP/err")"

SAT_BLOCK_SIZES_ARR=(4k 64k) SAT_SYNC_ARR=(1) RUN_UUID=""
run_saturation_runs >"$TMP/out" 2>"$TMP/err"
check "no start RUN_UUID: every run gets a distinct one" 2 "$(grep '^LOOP' "$TMP/out" | awk '{print $4}' | sort -u | grep -c 'uuid-')"

if [ "$failures" -gt 0 ]; then
    echo "$failures test(s) failed"
    exit 1
fi
echo "all tests passed"
