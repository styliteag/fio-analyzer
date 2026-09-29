#!/usr/bin/env bash
# Tests for the SAT_SYNC list in saturation mode of fio-test.sh
# (run: bash scripts/tests/test_sat_sync.sh)
# Loads only the needed functions from the script and stubs the saturation loop.

# shellcheck disable=SC2034,SC2329  # config vars and stubs are used by the sourced functions

set -u
SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/fio-test.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

FUNCS="parse_sat_sync_list sat_run_label run_saturation_runs"
SED_EXPR=""
for f in $FUNCS; do SED_EXPR+="/^${f}()/,/^}/p;"; done
# shellcheck source=/dev/null
source <(sed -n "$SED_EXPR" "$SCRIPT")
for f in $FUNCS; do
    declare -F "$f" >/dev/null || { echo "function $f not found in $SCRIPT"; exit 1; }
done

print_error() { echo "ERR: $*" >>"$TMP/errors"; }
print_status() { :; }
print_retry_summary() { :; }

failures=0
check() {  # check <description> <expected> <actual>
    if [ "$2" = "$3" ]; then
        echo "ok   - $1"
    else
        echo "FAIL - $1 (expected '$2', got '$3')"
        failures=$((failures + 1))
    fi
}

# --- parse_sat_sync_list -----------------------------------------------------------
parse_sat_sync_list "sync,dsync"; rc=$?
check "list parses" 0 "$rc"
check "list values" "sync dsync" "${SAT_SYNC_ARR[*]}"
parse_sat_sync_list "1"
check "single legacy value" "1" "${SAT_SYNC_ARR[*]}"
parse_sat_sync_list "none, sync ,dsync,0,1"
check "spaces trimmed, legacy values pass through" "none sync dsync 0 1" "${SAT_SYNC_ARR[*]}"
: >"$TMP/errors"
parse_sat_sync_list "sync,fsync"; rc=$?
check "invalid value is rejected" 1 "$rc"
check "invalid value is reported" 1 "$(grep -c fsync "$TMP/errors")"
parse_sat_sync_list ""; rc=$?
check "empty list is rejected" 1 "$rc"
parse_sat_sync_list "sync,,dsync"; rc=$?
check "empty entry is rejected" 1 "$rc"

# --- sat_run_label -------------------------------------------------------------------
SAT_SYNC_ARR=(1) SAT_SYNC=1
check "single sync: label unchanged" "bs=64k" "$(sat_run_label 64k)"
SAT_SYNC_ARR=(none sync) SAT_SYNC=sync
check "multiple syncs: label shows sync" "bs=64k sync=sync" "$(sat_run_label 64k)"

# --- run_saturation_runs ---------------------------------------------------------------
reset_sat_results() { :; }
build_description() { DESCRIPTION="run_uuid:${RUN_UUID}"; }
saturation_loop() { echo "$1|$SAT_SYNC|$RUN_UUID|$DESCRIPTION" >>"$TMP/runs"; }
print_saturation_summary() { echo "$1|$SAT_SYNC" >>"$TMP/summaries"; }
echo 0 >"$TMP/uuid_n"
uuidgen() {  # runs in a subshell, so count in a file
    local n
    n=$(( $(cat "$TMP/uuid_n") + 1 ))
    echo "$n" >"$TMP/uuid_n"
    echo "UUID-$n"
}

SAT_BLOCK_SIZES_ARR=(4k 64k) SAT_SYNC_ARR=(none dsync)
: >"$TMP/runs"; : >"$TMP/summaries"
run_saturation_runs >"$TMP/out"
check "2 block sizes x 2 syncs = 4 runs" 4 "$(wc -l <"$TMP/runs" | tr -d ' ')"
check "run order and sync values" "4k|none 4k|dsync 64k|none 64k|dsync" \
    "$(cut -d'|' -f1,2 "$TMP/runs" | tr '\n' ' ' | sed 's/ $//')"
check "description is rebuilt per run" 4 "$(awk -F'|' '$4 == "run_uuid:" $3' "$TMP/runs" | wc -l | tr -d ' ')"
check "summary per run" 4 "$(wc -l <"$TMP/summaries" | tr -d ' ')"

# Single block size and single sync: no banner (as before)
SAT_BLOCK_SIZES_ARR=(64k) SAT_SYNC_ARR=(1)
: >"$TMP/runs"
run_saturation_runs >"$TMP/out"
check "single run has no banner" 0 "$(grep -c 'Block Size' "$TMP/out")"

# Multiple block sizes, single sync: banner as before (no sync shown)
SAT_BLOCK_SIZES_ARR=(4k 64k) SAT_SYNC_ARR=(1)
run_saturation_runs >"$TMP/out"
check "single-sync banner unchanged" 1 "$(grep -c '║  Block Size: 64k  (run_uuid: ' "$TMP/out")"

# Hash fallback without uuidgen: runs with the same block size still differ by sync
unset -f uuidgen
generate_uuid_from_hash() { echo "hash:$1"; }
command() { if [ "$*" = "-v uuidgen" ]; then return 1; fi; builtin command "$@"; }
date() { echo "2025-06-31T20:00:00"; }  # fixed time: only the sync value can differ
SAT_BLOCK_SIZES_ARR=(4k) SAT_SYNC_ARR=(none sync) HOSTNAME=h
: >"$TMP/runs"
run_saturation_runs >"$TMP/out"
unset -f command date
check "fallback RUN_UUIDs differ by sync" 2 "$(cut -d'|' -f3 "$TMP/runs" | sort -u | wc -l | tr -d ' ')"

if [ "$failures" -gt 0 ]; then
    echo "$failures test(s) failed"
    exit 1
fi
echo "all tests passed"
