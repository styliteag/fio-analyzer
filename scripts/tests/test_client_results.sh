#!/usr/bin/env bash
# Tests for client-mode results in fio-test.sh (run: bash scripts/tests/test_client_results.sh)
# Step completeness from real fio client JSON (fixtures/ were produced by fio 3.43 with two
# fio servers on 127.0.0.1:18801/18802), client info fetching, client_storage_info,
# description tags, upload fields and ramp_uuid handling across ramp steps.

# shellcheck disable=SC2034,SC2329  # config vars and stubs are used by the sourced functions

set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$DIR/../fio-test.sh"
FIX="$DIR/fixtures"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

FUNCS="generate_uuid_from_hash json_escape build_description sat_cap_active client_step_complete
client_step_iops client_sanitize_name client_valid_json_object client_fetch_info client_hosts_list
client_storage_info_json new_ramp_uuid client_config_list client_run_ramp_step client_run_config
run_client_tests upload_results data_file_base client_step_label upload_description client_kernels print_retry_log
retry_clean_text apply_cachefit_tag client_cache_fit_check test_working_set_bytes host_cache_bytes cache_mul
si_byte_count fio_size_to_bytes cache_fit_text human_bytes cache_size_bytes"
SED_EXPR=""
for f in $FUNCS; do SED_EXPR+="/^${f}()/,/^}/p;"; done
# shellcheck source=/dev/null
source <(sed -n "$SED_EXPR" "$SCRIPT")
for f in $FUNCS; do
    declare -F "$f" >/dev/null || { echo "function $f not found in $SCRIPT"; exit 1; }
done

print_status() { :; }
print_success() { :; }
print_step() { :; }
print_error() { :; }
print_warning() { echo "WARN: $*" >>"$TMP/warnings"; }

failures=0
check() {  # check <description> <expected> <actual>
    if [ "$2" = "$3" ]; then
        echo "ok   - $1"
    else
        echo "FAIL - $1 (expected '$2', got '$3')"
        failures=$((failures + 1))
    fi
}
pyget() {  # pyget <json> <python expression on o>
    python3 -c "import json,sys; o=json.loads(sys.argv[1]); print($2)" "$1" 2>/dev/null || echo "<error>"
}

# --- step completeness -----------------------------------------------------------------------
TWO="$FIX/fio_client_2clients.json" ONE="$FIX/fio_client_1client.json"
CLIENT_KEY=(127.0.0.1:18801 127.0.0.1:18802)
client_step_complete "$TWO" 2; check "2 clients, both reported, no error: complete" 0 "$?"
client_step_complete "$TWO" 1; check "first client of two reported: complete" 0 "$?"
CLIENT_KEY=(127.0.0.1:18801 127.0.0.1:18803)
client_step_complete "$TWO" 2; check "active client missing in client_stats: incomplete" 1 "$?"
CLIENT_KEY=(127.0.0.1:18801 127.0.0.1:18802)
jq '(.client_stats[] | select(.port == 18802 and .jobname != "All clients") | .error) = 5' "$TWO" >"$TMP/err.json"
client_step_complete "$TMP/err.json" 2; check "client entry with error != 0: incomplete" 1 "$?"
client_step_complete "$ONE" 1; check "single client (no 'All clients' entry): complete" 0 "$?"
client_step_complete "$TMP/missing.json" 1; check "missing JSON: incomplete" 1 "$?"
echo 'fio: connect: Connection refused' >"$TMP/bad.json"
client_step_complete "$TMP/bad.json" 1; check "non-JSON output: incomplete" 1 "$?"
jq 'del(.client_stats)' "$TWO" >"$TMP/nocs.json"
client_step_complete "$TMP/nocs.json" 2; check "no client_stats: incomplete" 1 "$?"

check "total IOPS from 'All clients'" 2224520 "$(client_step_iops "$TWO")"
check "total IOPS of a single client" "$(jq -r '.client_stats[0].read.iops | round' "$ONE")" "$(client_step_iops "$ONE")"

# --- client info (hostname.txt / storage.json over HTTP) ---------------------------------------
# shellcheck disable=SC2016  # hostile hostname.txt with a literal $(id)
curl() {  # stub: URL is the last argument
    local url=${*: -1}
    echo "$*" >>"$TMP/curl_calls"
    case "$url" in
        http://10.0.0.1:8766/storage.json) echo '{"fs_type":"zfs","zfs":{"dataset":"tank/fio","sync":"disabled"}}' ;;
        http://10.0.0.1:8766/hostname.txt) printf 'node-a\n' ;;
        http://10.0.0.2:8766/storage.json) echo 'not json <html>' ;;
        http://10.0.0.2:8766/hostname.txt) printf 'node b;$(id)\n' ;;
        *) return 7 ;;
    esac
}
CLIENT_ENTRY=(10.0.0.1 10.0.0.2 10.0.0.3:9000)
CLIENT_ADDR=(10.0.0.1 10.0.0.2 10.0.0.3)
CLIENT_CONN_HOST=(10.0.0.1 10.0.0.2 10.0.0.3)
CLIENT_CONN_PORT=(8765 8765 9000)
CLIENT_CONN_INFO_PORT=(8766 8766 9001)
CLIENT_KEY=(10.0.0.1:8765 10.0.0.2:8765 10.0.0.3:9000)
: >"$TMP/warnings" && : >"$TMP/curl_calls"
client_fetch_info
check "curl uses --max-time 5" 6 "$(grep -c -- '--max-time 5' "$TMP/curl_calls")"
check "name from hostname.txt" node-a "${CLIENT_NAME[0]}"
check "hostile hostname.txt sanitized" "nodebid" "${CLIENT_NAME[1]}"
check "unreachable client: address as name" 10.0.0.3 "${CLIENT_NAME[2]}"
check "leading dashes stripped (no jq option)" "rawfile" "$(client_sanitize_name '--rawfile')"
check "only dashes -> empty" "" "$(client_sanitize_name '---')"
check "storage.json kept" '{"fs_type":"zfs","zfs":{"dataset":"tank/fio","sync":"disabled"}}' "${CLIENT_STORAGE[0]}"
check "invalid storage.json -> {}" "{}" "${CLIENT_STORAGE[1]}"
check "missing storage.json -> {}" "{}" "${CLIENT_STORAGE[2]}"
check "missing info is warned about" 1 "$(grep -c '10.0.0.3' "$TMP/warnings")"

check "client_hosts for 2 clients" "node-a,nodebid" "$(client_hosts_list 2)"
check "client_hosts for 3 clients" "node-a,nodebid,10.0.0.3" "$(client_hosts_list 3)"

csi=$(client_storage_info_json 3)
check "client_storage_info is valid JSON" dict "$(pyget "$csi" 'type(o).__name__')"
check "keys are host:port as passed to fio" "10.0.0.1:8765,10.0.0.2:8765,10.0.0.3:9000" "$(pyget "$csi" '",".join(o)')"
check "client_name matches client_hosts" node-a "$(pyget "$csi" 'o["10.0.0.1:8765"]["client_name"]')"
check "client_name falls back to the address" 10.0.0.3 "$(pyget "$csi" 'o["10.0.0.3:9000"]["client_name"]')"
check "client_entry holds the CLIENTS entry" "10.0.0.3:9000" "$(pyget "$csi" 'o["10.0.0.3:9000"]["client_entry"]')"
check "storage info kept per client" disabled "$(pyget "$csi" 'o["10.0.0.1:8765"]["zfs"]["sync"]')"
check "only active clients" 1 "$(pyget "$(client_storage_info_json 1)" 'len(o)')"

# oversized storage info: big sub-objects are dropped to stay below 256 KiB
big=$(python3 -c 'import json; print(json.dumps({"fs_type":"xfs","disk":{"model":"x"*200000},"virt":{"type":"kvm"}}))')
CLIENT_STORAGE=("$big" "$big" "{}")
csi=$(client_storage_info_json 3)
check "oversized: still valid JSON" dict "$(pyget "$csi" 'type(o).__name__')"
check "oversized: at most 256 KiB" 1 "$(pyget "$csi" 'int(len(json.dumps(o)) <= 262144)')"
check "oversized: fs_type kept" xfs "$(pyget "$csi" 'o["10.0.0.1:8765"]["fs_type"]')"
check "oversized: client_name kept" node-a "$(pyget "$csi" 'o["10.0.0.1:8765"]["client_name"]')"
check "oversized: client_entry kept" 10.0.0.1 "$(pyget "$csi" 'o["10.0.0.1:8765"]["client_entry"]')"

# --- description tags ----------------------------------------------------------------------------
HOSTNAME=px1-vms PROTOCOL=local DRIVE_TYPE=vm-ssd DRIVE_MODEL=m CONFIG_UUID=c RUN_UUID=r
BASE_DESCRIPTION="" SATURATION_MODE=false PREFILL=0 FILE_PER_JOB=0 SAT_MAX_TOTAL_SIZE=""
CLIENT_MODE=false RAMP_CLIENTS="" STEP_CLIENTS=0 STEP_COMPLETE=1
build_description
check "single-host mode: no client tags" 0 "$(grep -c 'clients:\|ramp:\|incomplete:' <<< "$DESCRIPTION")"
CLIENT_MODE=true STEP_CLIENTS=4
build_description
check "clients tag" 1 "$(grep -c ',clients:4' <<< "$DESCRIPTION")"
check "no ramp tag without RAMP_CLIENTS" 0 "$(grep -c 'ramp:1' <<< "$DESCRIPTION")"
RAMP_CLIENTS="1,4" STEP_COMPLETE=0
build_description
check "ramp tag" 1 "$(grep -c ',ramp:1' <<< "$DESCRIPTION")"
check "incomplete tag" 1 "$(grep -c ',incomplete:1' <<< "$DESCRIPTION")"

# --- upload fields -------------------------------------------------------------------------------
curl() { printf '%s\n' "$@" >"$TMP/args"; printf '{"message":"ok"}200'; }
field_flag() {  # flag in front of "<field>=..." (empty when the field is missing)
    local line
    line=$(grep -n -- "^$1=" "$TMP/args" | head -n 1 | cut -d: -f1)
    if [ -n "$line" ]; then sed -n "$((line - 1))p" "$TMP/args"; fi
}
USERNAME=u PASSWORD=p BACKEND_URL=http://x STORAGE_INFO='{"fs_type":"apfs"}' LATENCY_THRESHOLD_MS=100
CLIENT_STORAGE=('{"fs_type":"zfs"}' '{}' '{}')
CLIENT_MODE=true STEP_CLIENTS=2 RAMP_UUID=ramp-1 STEP_COMPLETE=0
STEP_CLIENT_HOSTS='@/etc/passwd,node-b' STEP_CLIENT_STORAGE=$(client_storage_info_json 2)
upload_results "$TMP/result.json" t >/dev/null 2>&1
for field in clients ramp_uuid client_hosts client_storage_info ramp_step_complete; do
    check "client mode: $field sent with --form-string" "--form-string" "$(field_flag "$field")"
done
check "clients value" 1 "$(grep -cx -- 'clients=2' "$TMP/args")"
check "ramp_uuid value" 1 "$(grep -cx -- 'ramp_uuid=ramp-1' "$TMP/args")"
check "ramp_step_complete value" 1 "$(grep -cx -- 'ramp_step_complete=0' "$TMP/args")"
check "client_hosts sent literally" 1 "$(grep -cx -- 'client_hosts=@/etc/passwd,node-b' "$TMP/args")"
sent=$(grep -- '^client_storage_info=' "$TMP/args" | cut -d= -f2-)
check "client_storage_info upload is valid JSON" dict "$(pyget "$sent" 'type(o).__name__')"
check "client mode: no storage_info" "" "$(field_flag storage_info)"
check "file is the only -F field" 1 "$(grep -cx -- '-F' "$TMP/args")"

CLIENT_MODE=false
upload_results "$TMP/result.json" t >/dev/null 2>&1
for field in clients ramp_uuid client_hosts client_storage_info ramp_step_complete; do
    check "single-host mode: no $field" "" "$(field_flag "$field")"
done
check "single-host mode: storage_info still sent" "--form-string" "$(field_flag storage_info)"

# --- ramp_uuid per test configuration, shared by its ramp steps --------------------------------
echo 0 >"$TMP/uuid_n"
uuidgen() {  # runs in a subshell, so count in a file
    local n
    n=$(( $(cat "$TMP/uuid_n") + 1 ))
    echo "$n" >"$TMP/uuid_n"
    echo "RAMP-$n"
}
client_write_job_file() { echo "job $*" >"$1"; }
client_fio_args() { CLIENT_FIO_ARGS=(); }
display_client_step() { :; }
keep_json_copy() { :; }
client_prefill_all() { echo prefill >>"$TMP/prefills"; }
client_cleanup_all() { :; }
# fio stand-in: the 2-client step of the 64k config fails without output, all others succeed
client_run_step() {  # client_run_step <n> <job file> <output> <label>
    if [ "$1" = 2 ] && [[ "$4" == *64k* ]]; then return 1; fi
    if [ "$1" = 2 ]; then cp "$TWO" "$3"; else cp "$ONE" "$3"; fi
}
upload_results() { echo "$STEP_CLIENTS|$RAMP_UUID|$RUN_UUID|$STEP_COMPLETE|$DESCRIPTION|$STEP_CLIENT_HOSTS" >>"$TMP/uploads"; }
CLIENT_KEY=(127.0.0.1:18801 127.0.0.1:18802)
CLIENT_NAME=(node-a node-b) CLIENT_ENTRY=(a b) CLIENT_STORAGE=('{}' '{}')
BLOCK_SIZES=(4k 64k) TEST_PATTERNS=(randread) NUM_JOBS=(1) DIRECT=(1) TEST_SIZE=(4M)
SYNC=(1) IODEPTH=(1) RUNTIME=(1) RAMP_STEPS=(1 2) RAMP_CLIENTS="1,2" PREFILL=1
CLIENT_WORK_DIR="$TMP/work" RUN_UUID=run-1 CLIENT_MODE=true FIO_RETRY_COUNT=0
CLIENT_IOENGINE=libaio FIO_RETRY_LOG=()
mkdir -p "$CLIENT_WORK_DIR"
: >"$TMP/uploads" && : >"$TMP/prefills"
run_client_tests >/dev/null 2>&1; rc=$?
check "configurations x steps (failed step without JSON not uploaded)" 3 "$(grep -c . "$TMP/uploads")"
check "run reports the failed step" 1 "$rc"
check "prefill runs once for the whole run" 1 "$(grep -c . "$TMP/prefills")"
u1=$(sed -n 1p "$TMP/uploads" | cut -d'|' -f2) u2=$(sed -n 2p "$TMP/uploads" | cut -d'|' -f2)
u3=$(sed -n 3p "$TMP/uploads" | cut -d'|' -f2)
check "ramp steps of one config share the ramp_uuid" "$u1" "$u2"
check "next config gets a new ramp_uuid" 1 "$([ "$u3" != "$u1" ] && [ -n "$u3" ] && echo 1 || echo 0)"
check "run_uuid stays the same" 1 "$(cut -d'|' -f3 "$TMP/uploads" | sort -u | grep -c .)"
check "step client counts" "1 2 1" "$(cut -d'|' -f1 "$TMP/uploads" | tr '\n' ' ' | sed 's/ $//')"
check "complete steps flagged complete" "1 1 1" "$(cut -d'|' -f4 "$TMP/uploads" | tr '\n' ' ' | sed 's/ $//')"
check "step description has clients:2" 1 "$(sed -n 2p "$TMP/uploads" | grep -c 'clients:2')"
check "step description has ramp:1" 3 "$(grep -c 'ramp:1' "$TMP/uploads")"
check "client hosts of the 2-client step" "node-a,node-b" "$(sed -n 2p "$TMP/uploads" | cut -d'|' -f6)"

# a step whose fio run fails but leaves JSON is uploaded as incomplete
client_run_step() { cp "$TWO" "$3"; [ "$1" = 1 ]; }
BLOCK_SIZES=(4k) PREFILL=0
: >"$TMP/uploads" && : >"$TMP/prefills"
run_client_tests >/dev/null 2>&1
check "failed step with JSON is uploaded" 2 "$(grep -c . "$TMP/uploads")"
check "failed step flagged incomplete" 0 "$(sed -n 2p "$TMP/uploads" | cut -d'|' -f4)"
check "failed step has incomplete:1 tag" 1 "$(sed -n 2p "$TMP/uploads" | grep -c 'incomplete:1')"
check "complete step has no incomplete tag" 0 "$(sed -n 1p "$TMP/uploads" | grep -c 'incomplete:1')"
check "no prefill with PREFILL=0" 0 "$(grep -c . "$TMP/prefills")"

if [ "$failures" -gt 0 ]; then
    echo "$failures test(s) failed"
    exit 1
fi
echo "all tests passed"
