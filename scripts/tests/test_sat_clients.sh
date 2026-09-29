#!/usr/bin/env bash
# Tests for saturation mode in client mode (run: bash scripts/tests/test_sat_clients.sh)
# The unchanged saturation_loop drives the escalation; run_fio_step hands every step to
# client_run_sat_step, which runs it on ALL clients through fio --client. A stubbed fio
# writes fio client JSON (from fixtures/fio_client_2clients.json) whose "All clients" P95
# grows with the step's QD, so the threshold decides where the loop stops.

# shellcheck disable=SC2034,SC2329  # config vars and stubs are used by the sourced functions

set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$DIR/../fio-test.sh"
TWO="$DIR/fixtures/fio_client_2clients.json"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

FUNCS="fio_size_to_bytes bytes_to_mib_size build_description sat_run_label sat_cap_active sat_step_size
data_file_base transient_fio_error_line is_transient_fio_error run_fio_with_retry sanitize_fio_json
curl_auth_config upload_results run_fio_step fio_result_jq extract_avg_clat_ms extract_p70_clat_ms
extract_p99_clat_ms extract_p95_clat_ms extract_iops_value extract_bw_mbs sat_extract_key sat_is_mixed
sat_r_init sat_r_append sat_r_get sat_r_len reset_sat_results saturation_loop print_saturation_summary
fio_server_address client_fio_args client_hosts_list client_storage_info_json client_job_name
client_job_target_lines client_extra_args_ini client_write_job_file client_write_prefill_job
client_write_cleanup_job client_step_complete client_output_messages client_run_step
client_run_sat_step client_print_p95 client_sat_prefill client_sat_prefill_cleanup upload_description
retry_clean_text fio_retry_params fio_retry_kernel print_retry_log client_kernels"
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
print_error() { echo "ERR: $*" >>"$TMP/errors"; }
print_warning() { :; }
keep_json_copy() { :; }
sleep() { :; }
RED="" GREEN="" YELLOW="" BLUE="" CYAN="" BOLD="" NC=""

failures=0
check() {  # check <description> <expected> <actual>
    if [ "$2" = "$3" ]; then
        echo "ok   - $1"
    else
        echo "FAIL - $1 (expected '$2', got '$3')"
        failures=$((failures + 1))
    fi
}

# fio stub: every call is logged (arguments, job file). A benchmark job gets client JSON whose
# P95 is QD x 0.1 ms ("All clients" and client 18801; client 18802 is 1.5 x slower) and
# IOPS 1000 x QD. MISSING_CLIENT_AT=<call> leaves client 18802 out of that call's result.
fio() {
    local out="" arg job calls qd iodepth numjobs
    for arg in "$@"; do case "$arg" in --output=*) out=${arg#--output=} ;; esac; done
    job=${*: -1}
    calls=$(( $(cat "$TMP/calls") + 1 ))
    echo "$calls" >"$TMP/calls"
    printf '%s\n' "$@" >"$TMP/args.$calls"
    cp "$job" "$TMP/job.$calls"
    if [ "${EAGAIN_AT:-0}" = "$calls" ]; then
        echo 'fio: io_u error on file /t/f.0: Resource temporarily unavailable: read offset=0, buflen=4096' >&2
        return 1
    fi
    iodepth=$(sed -n 's/^iodepth=//p' "$job") numjobs=$(sed -n 's/^numjobs=//p' "$job")
    qd=$(( ${iodepth:-1} * ${numjobs:-1} ))
    jq --argjson qd "$qd" --argjson drop "$([ "${MISSING_CLIENT_AT:-0}" = "$calls" ] && echo true || echo false)" '
        .client_stats |= (map(select(($drop | not) or .jobname == "All clients" or .port != 18802))
            | map(((if .jobname != "All clients" and .port == 18802 then 1.5 else 1 end) * $qd * 100000) as $p95
                | .read.iops = ($qd * 1000) | .write.iops = ($qd * 1000)
                | .read.bw_bytes = ($qd * 1048576) | .write.bw_bytes = ($qd * 1048576)
                | .read.clat_ns.percentile["95.000000"] = $p95
                | .write.clat_ns.percentile["95.000000"] = $p95))' "$TWO" >"$out"
    return 0
}
# curl stub for upload_results: one file of arguments per upload
curl() {
    local n
    n=$(( $(cat "$TMP/uploads") + 1 ))
    echo "$n" >"$TMP/uploads"
    printf '%s\n' "$@" >"$TMP/upload.$n"
    printf '{"message":"ok"}200'
}
reset_counters() { echo 0 >"$TMP/calls" && echo 0 >"$TMP/uploads" && rm -f "$TMP"/args.* "$TMP"/job.* "$TMP"/upload.* && : >"$TMP/errors"; }

HOSTNAME=px1-vms PROTOCOL=local DRIVE_TYPE=vm-ssd DRIVE_MODEL=m CONFIG_UUID=c RUN_UUID=run-1
BASE_DESCRIPTION="" SATURATION_MODE=true PREFILL=0 FILE_PER_JOB=0 SAT_MAX_TOTAL_SIZE="" SAT_CAP_MIN_WARNED=false
USERNAME=u PASSWORD=p BACKEND_URL=http://x STORAGE_INFO="" KEEP_JSON_DIR=""
LATENCY_THRESHOLD_MS=10 MAX_STEPS=10 MAX_TOTAL_QD=16384 INITIAL_IODEPTH=16 INITIAL_NUMJOBS=1
SAT_RUNTIME=1 SAT_DIRECT=1 SAT_SYNC=none SAT_TEST_SIZE=16M
TARGET_IS_DEVICE=false TARGET_DIR=/mnt/fio CLIENT_IOENGINE=libaio IOENGINE=libaio IS_SYNC_ENGINE=false
FIO_EXTRA_ARGS_ARR=() FIO_RETRY_MAX=0 FIO_RETRY_COUNT=0
CLIENT_MODE=true RAMP_CLIENTS="" RAMP_UUID="stale" STEP_CLIENTS=0 STEP_COMPLETE=1
CLIENT_CONN_HOST=(127.0.0.1 127.0.0.1) CLIENT_CONN_PORT=(18801 18802)
CLIENT_KEY=(127.0.0.1:18801 127.0.0.1:18802) CLIENT_ENTRY=(vm1 vm2) CLIENT_NAME=(vm1 vm2)
CLIENT_STORAGE=('{"fs_type":"xfs"}' '{"fs_type":"ext4"}')
CLIENT_WORK_DIR="$TMP/work"
mkdir -p "$CLIENT_WORK_DIR"
declare -a SAT_RESULTS_STEP SAT_P_IODEPTH SAT_P_NUMJOBS SAT_P_ESC_COUNT SAT_P_SATURATED SAT_P_STEP
declare -a SAT_P_FAIL_COUNT SAT_P_BEST_IOPS SAT_P_BEST_QD SAT_P_SAT_STEP
SAT_PATTERNS_ARR=(randread) SAT_SYNC_ARR=(none)
upload_field() { grep -x -- "$2=.*" "$TMP/upload.$1" | head -n 1 | cut -d= -f2-; }

# --- EAGAIN retry: retried:N tags only the step that needed it -----------------------------
reset_counters
reset_sat_results
FIO_RETRY_MAX=2 FIO_TEST_RETRIES=5 EAGAIN_AT=2 FIO_RETRY_LOG=() FIO_RETRY_PARAMS="" FIO_RETRY_KERNEL=""
client_kernels() { echo "6.8.0"; }
saturation_loop 4k >"$TMP/out" 2>&1
# fio calls: step 1, step 2 (EAGAIN), step 2 retry, step 3, step 4
check "retry: five fio runs" 5 "$(cat "$TMP/calls")"
check "retry: four steps uploaded" 4 "$(cat "$TMP/uploads")"
check "retry: step 1 not tagged (no carry-over)" 0 "$(upload_field 1 description | grep -c 'retried:')"
check "retry: step 2 tagged retried:1" 1 "$(upload_field 2 description | grep -c ',retried:1$')"
check "retry: step 3 not tagged" 0 "$(upload_field 3 description | grep -c 'retried:')"
check "retry: log names the step's job parameters" 1 \
    "$(printf '%s\n' "${FIO_RETRY_LOG[@]}" | grep -c 'rw=randread bs=4k size=16M numjobs=1 iodepth=32 direct=1 ioengine=libaio')"
check "retry: log names the clients' kernels" 1 "$(printf '%s\n' "${FIO_RETRY_LOG[@]}" | grep -c 'kernel=6.8.0')"
check "retry: job parameters cleared after the step" "" "$FIO_RETRY_PARAMS"
FIO_RETRY_MAX=0 EAGAIN_AT=0 FIO_TEST_RETRIES=0

# --- escalation on all clients until the "All clients" P95 crosses the threshold -------------
reset_counters
reset_sat_results
saturation_loop 4k >"$TMP/out" 2>&1
# QD 16, 32, 64 (P95 1.6 / 3.2 / 6.4 ms), QD 128 = 12.8 ms > 10 ms: saturated at step 4
check "four fio runs until saturation" 4 "$(cat "$TMP/calls")"
check "pattern saturated" true "${SAT_P_SATURATED[0]}"
check "iodepth escalates per step" "16 32 64 128" "$(for i in 1 2 3 4; do sed -n 's/^iodepth=//p' "$TMP/job.$i"; done | tr '\n' ' ' | sed 's/ $//')"
check "every step on both clients" "2 2 2 2" "$(for i in 1 2 3 4; do grep -c '^--client=' "$TMP/args.$i"; done | tr '\n' ' ' | sed 's/ $//')"
check "job file uses the saturation settings" "direct=1 sync=none bs=4k rw=randread size=16M runtime=1" \
    "$(grep -E '^(rw|bs|sync|runtime|direct|size)=' "$TMP/job.1" | tr '\n' ' ' | sed 's/ $//')"
check "job without PREFILL removes its files" 1 "$(grep -cx 'unlink=1' "$TMP/job.1")"
check "P95 read from 'All clients'" "1.60 3.20 6.40 12.80" "$(sat_r_get 0 P95 0) $(sat_r_get 0 P95 1) $(sat_r_get 0 P95 2) $(sat_r_get 0 P95 3)"
check "IOPS read from 'All clients'" "16000 128000" "$(sat_r_get 0 IOPS 0) $(sat_r_get 0 IOPS 3)"
check "per-client P95 printed" 1 "$(grep -c 'P95 per client: vm1=1.6ms vm2=2.4ms' "$TMP/out")"
check "every step uploaded" 4 "$(cat "$TMP/uploads")"
check "upload: latency_threshold_ms" 10 "$(upload_field 1 latency_threshold_ms)"
check "upload: clients" 2 "$(upload_field 1 clients)"
check "upload: client_hosts" vm1,vm2 "$(upload_field 1 client_hosts)"
check "upload: no ramp_uuid" "" "$(upload_field 1 ramp_uuid)"
check "upload: step complete" 1 "$(upload_field 1 ramp_step_complete)"
check "upload: client_storage_info per client" '"xfs" "ext4"' \
    "$(upload_field 1 client_storage_info | jq -r '[.[].fs_type] | map(@json) | join(" ")')"
check "upload: no storage_info of the controller" 0 "$(grep -c '^storage_info=' "$TMP/upload.1")"
desc=$(upload_field 1 description)
check "description starts with saturation-test" 1 "$(grep -c '^saturation-test,' <<< "$desc")"
check "description tagged clients:2" 1 "$(grep -c ',clients:2' <<< "$desc")"
check "description not tagged as ramp" 0 "$(grep -c 'ramp:1' <<< "$desc")"
check "job description matches the upload" "description=$desc" "$(grep '^description=' "$TMP/job.1")"

# --- older fio (3.36): no percentiles in "All clients" -> worst client's P95 -------------------
jq '(.client_stats[] | select(.jobname == "All clients") | .read.clat_ns) |= del(.percentile)
    | (.client_stats[] | select(.jobname != "All clients" and .port == 18802) | .read.clat_ns.percentile["95.000000"]) = 7500000' \
    "$TWO" >"$TMP/old_fio.json"
check "P95 from 'All clients' when present" "0.00" "$(extract_p95_clat_ms "$TWO" randread)"
check "no aggregate percentiles: worst client's P95" "7.50" "$(extract_p95_clat_ms "$TMP/old_fio.json" randread)"
echo '{"jobs":[{"read":{"clat_ns":{"percentile":{"95.000000":2000000}}}}]}' >"$TMP/local.json"
check "local run unchanged" "2.00" "$(extract_p95_clat_ms "$TMP/local.json" randread)"
CLIENT_NAME=(127.0.0.1 127.0.0.1) CLIENT_ADDR=(127.0.0.1 127.0.0.1) CLIENT_ENTRY=(127.0.0.1:18801 127.0.0.1:18802)
check "per-client P95: CLIENTS entry when a client sent no name" "  P95 per client: 127.0.0.1:18801=0ms 127.0.0.1:18802=7.5ms" \
    "$(client_print_p95 "$TMP/old_fio.json" randread)"
CLIENT_ENTRY=(vm1 vm2) CLIENT_NAME=(vm1 vm2)
unset CLIENT_ADDR

# --- a step with a missing client is a failed step: not evaluated, not uploaded ------------------
reset_counters
reset_sat_results
MISSING_CLIENT_AT=2
saturation_loop 4k >"$TMP/out" 2>&1
unset MISSING_CLIENT_AT
check "incomplete step: loop continues to saturation" 4 "$(cat "$TMP/calls")"
check "incomplete step: not uploaded" 3 "$(cat "$TMP/uploads")"
check "incomplete step: no result" "-" "$(sat_r_get 0 P95 1)"
check "incomplete step: reported" 1 "$(grep -c 'Step incomplete' "$TMP/errors")"

# --- sync engine on the clients: numjobs escalates, iodepth stays 1 ---------------------------
reset_counters
reset_sat_results
IS_SYNC_ENGINE=true INITIAL_NUMJOBS=16
saturation_loop 4k >"$TMP/out" 2>&1
check "sync engine: numjobs escalates" "16 32 64 128" "$(for i in 1 2 3 4; do sed -n 's/^numjobs=//p' "$TMP/job.$i"; done | tr '\n' ' ' | sed 's/ $//')"
check "sync engine: iodepth 1" "1 1 1 1" "$(for i in 1 2 3 4; do sed -n 's/^iodepth=//p' "$TMP/job.$i"; done | tr '\n' ' ' | sed 's/ $//')"
IS_SYNC_ENGINE=false INITIAL_IODEPTH=16 INITIAL_NUMJOBS=1

# --- mixed pattern: worst P95 of read/write, IOPS summed -----------------------------------------
reset_counters
reset_sat_results
SAT_PATTERNS_ARR=(randrw)
reset_sat_results
saturation_loop 64k >"$TMP/out" 2>&1
check "randrw: IOPS = read + write of 'All clients'" 32000 "$(sat_r_get 0 IOPS 0)"
check "randrw: saturates at QD 128" 4 "$(cat "$TMP/calls")"
check "randrw: block size in the job" "bs=64k" "$(grep '^bs=' "$TMP/job.1")"
SAT_PATTERNS_ARR=(randread)

# --- PREFILL: data files written once per size, only missing files added, removed at the end ----
reset_counters
PREFILL=1 FILE_PER_JOB=1 SAT_CLIENT_PREFILL=""
client_sat_prefill fio_data_16M 16M 4
check "prefill: first step writes files 0..3" "prefill_0 prefill_1 prefill_2 prefill_3" \
    "$(grep -o '^\[prefill_[0-9]*\]' "$TMP/job.1" | tr -d '[]' | tr '\n' ' ' | sed 's/ $//')"
client_sat_prefill fio_data_16M 16M 4
check "prefill: same files are not written again" 1 "$(cat "$TMP/calls")"
client_sat_prefill fio_data_16M 16M 8
check "prefill: more jobs add only the missing files" "prefill_4 prefill_5 prefill_6 prefill_7" \
    "$(grep -o '^\[prefill_[0-9]*\]' "$TMP/job.2" | tr -d '[]' | tr '\n' ' ' | sed 's/ $//')"
client_sat_prefill fio_data_8M 8M 16
check "prefill: new size removes the old files first" "cleanup_0 cleanup_7" \
    "$(grep -o '^\[cleanup_[0-9]*\]' "$TMP/job.3" | tr -d '[]' | sed -n '1p;$p' | tr '\n' ' ' | sed 's/ $//')"
check "prefill: old files of the right base removed" 8 "$(grep -c 'fio_data_16M' "$TMP/job.3")"
check "prefill: then the new size is written" 16 "$(grep -c '^\[prefill_' "$TMP/job.4")"
client_sat_prefill_cleanup
check "prefill cleanup at the end" 16 "$(grep -c '^\[cleanup_' "$TMP/job.5")"
check "prefill state cleared" "" "$SAT_CLIENT_PREFILL"
client_sat_prefill_cleanup
check "prefill cleanup only once" 5 "$(cat "$TMP/calls")"

# a saturation step with PREFILL uses the prefilled files and keeps them
reset_counters
reset_sat_results
MAX_STEPS=1
saturation_loop 4k >"$TMP/out" 2>&1
check "PREFILL step: prefill then benchmark" 2 "$(cat "$TMP/calls")"
check "PREFILL step: job uses the prefilled files" "filename_format=fio_data_16M.\$jobnum" "$(grep '^filename_format=' "$TMP/job.2")"
check "PREFILL step: files kept (no unlink)" 0 "$(grep -c '^unlink=1' "$TMP/job.2")"
check "PREFILL step: prefill:1 tag" 1 "$(upload_field 1 description | grep -c 'prefill:1')"

if [ "$failures" -gt 0 ]; then
    echo "$failures test(s) failed"
    exit 1
fi
echo "all tests passed"
