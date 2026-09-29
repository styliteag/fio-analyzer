#!/usr/bin/env bash
# Tests for client_run_step in fio-test.sh (run: bash scripts/tests/test_client_step_retry.sh)
# A fio server can refuse a job right after the previous one ("<host> error: failed to
# setup shm segment", seen with fio 3.43 servers on macOS): fio exits 0, writes the server
# message before the JSON and client_stats is empty. Such a step is retried
# (FIO_RETRY_MAX); steps with a real client error are not.

# shellcheck disable=SC2034,SC2329  # config vars and stubs are used by the sourced functions

set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$DIR/../fio-test.sh"
TWO="$DIR/fixtures/fio_client_2clients.json"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

FUNCS="transient_fio_error_line is_transient_fio_error run_fio_with_retry sanitize_fio_json
fio_server_address client_fio_args client_step_complete client_output_messages client_run_step
retry_clean_text fio_retry_params fio_retry_kernel client_kernels upload_description
client_step_label client_run_ramp_step client_cache_fit_check test_working_set_bytes host_cache_bytes
cache_mul si_byte_count fio_size_to_bytes cache_fit_text human_bytes cache_size_bytes apply_cachefit_tag"
SED_EXPR=""
for f in $FUNCS; do SED_EXPR+="/^${f}()/,/^}/p;"; done
# shellcheck source=/dev/null
source <(sed -n "$SED_EXPR" "$SCRIPT")
for f in $FUNCS; do
    declare -F "$f" >/dev/null || { echo "function $f not found in $SCRIPT"; exit 1; }
done

print_status() { :; }
print_error() { :; }
print_warning() { echo "WARN: $*" >>"$TMP/warnings"; }
sleep() { :; }

failures=0
check() {  # check <description> <expected> <actual>
    if [ "$2" = "$3" ]; then
        echo "ok   - $1"
    else
        echo "FAIL - $1 (expected '$2', got '$3')"
        failures=$((failures + 1))
    fi
}

EMPTY='{ "fio version" : "fio-3.43", "global options" : {}, "client_stats" : [], "disk_util" : [] }'
# fio stub: output of call <k> is FIO_OUT_<k> ("two" = the real 2-client fixture)
fio() {
    local out="" arg calls var
    for arg in "$@"; do case "$arg" in --output=*) out=${arg#--output=} ;; esac; done
    printf '%s\n' "$@" >"$TMP/args"
    calls=$(( $(cat "$TMP/calls") + 1 ))
    echo "$calls" >"$TMP/calls"
    var="FIO_OUT_$calls"
    case "${!var:-two}" in
        two) cp "$TWO" "$out" ;;
        shm) printf '<node-a.home> error: failed to setup shm segment\n\n%s\n' "$EMPTY" >"$out" ;;
        err) jq '.client_stats[0].error = 28' "$TWO" >"$out" ;;
        eagain)
            echo 'fio: io_u error on file /t/f.0: Resource temporarily unavailable: read offset=8589930496, buflen=4096' >&2
            return 1 ;;
    esac
    return 0
}
FIO_RETRY_LOG=() FIO_TEST_RETRIES=0 FIO_RETRY_PARAMS="" FIO_RETRY_KERNEL="" CLIENT_MODE=true
CLIENT_STORAGE=('{"kernel":"6.8.12-pve"}' '{"kernel":"6.1.0-deb"}')
CLIENT_CONN_HOST=(127.0.0.1 127.0.0.1) CLIENT_CONN_PORT=(18801 18802)
CLIENT_KEY=(127.0.0.1:18801 127.0.0.1:18802)
CLIENT_WORK_DIR="$TMP"

# 1. server refuses once, then the job runs
FIO_RETRY_MAX=2 FIO_RETRY_COUNT=0 CLIENT_SERVER_RETRIES=0 FIO_OUT_1=shm FIO_OUT_2=two
echo 0 >"$TMP/calls" && : >"$TMP/warnings"
client_run_step 2 "$TMP/job.fio" "$TMP/out.json" step1; rc=$?
check "refused step is retried and succeeds" 0 "$rc"
check "fio ran twice" 2 "$(cat "$TMP/calls")"
check "retry counted" 1 "$CLIENT_SERVER_RETRIES"
check "server message shown" 1 "$(grep -c 'failed to setup shm segment' "$TMP/warnings")"
client_step_complete "$TMP/out.json" 2; check "final JSON is complete" 0 "$?"

# fio forwards options that follow a --client= to that server: the output options must come
# first, otherwise every server tries to open the controller's output path
first_client=$(grep -n -m 1 '^--client=' "$TMP/args" | cut -d: -f1)
check "--output before the first --client" 1 "$([ "$(grep -n -m 1 '^--output=' "$TMP/args" | cut -d: -f1)" -lt "$first_client" ] && echo 1)"
check "--output-format before the first --client" 1 "$([ "$(grep -n -m 1 '^--output-format=' "$TMP/args" | cut -d: -f1)" -lt "$first_client" ] && echo 1)"
check "no --output= after a --client" 0 "$(sed -n "${first_client},\$p" "$TMP/args" | grep -c '^--output=')"
# ...but every server gets --output-format=json, otherwise it sends text status lines
check "each --client followed by --output-format=json" 2 "$(grep -A1 '^--client=' "$TMP/args" | grep -cx -- '--output-format=json')"
check "job file is the last argument" "$TMP/job.fio" "$(tail -n 1 "$TMP/args")"

# 2. server keeps refusing: gives up after FIO_RETRY_MAX retries, JSON stays for the upload
FIO_RETRY_MAX=2 FIO_RETRY_COUNT=0 FIO_OUT_1=shm FIO_OUT_2=shm FIO_OUT_3=shm
echo 0 >"$TMP/calls" && : >"$TMP/warnings"
client_run_step 2 "$TMP/job.fio" "$TMP/out.json" step2
check "persistent refusal: 1 + 2 retries" 3 "$(cat "$TMP/calls")"
check "persistent refusal: JSON is valid" 0 "$(jq -e '.client_stats' "$TMP/out.json" >/dev/null; echo $?)"

# 3. a client error (error != 0) is a result, not retried
FIO_RETRY_MAX=2 FIO_RETRY_COUNT=0 FIO_OUT_1=err
echo 0 >"$TMP/calls"
client_run_step 2 "$TMP/job.fio" "$TMP/out.json" step3
check "client error not retried" 1 "$(cat "$TMP/calls")"

# 4. FIO_RETRY_MAX=0 disables the retry
FIO_RETRY_MAX=0 FIO_RETRY_COUNT=0 FIO_OUT_1=shm
echo 0 >"$TMP/calls"
client_run_step 2 "$TMP/job.fio" "$TMP/out.json" step4
check "FIO_RETRY_MAX=0: no retry" 1 "$(cat "$TMP/calls")"

# 5. EAGAIN in a ramp step: the warning names the step's parameters and the clients'
#    kernels, only that step's upload gets retried:1, the retry is logged
print_step() { :; }
data_file_base() { echo "fio_data_$2"; }
build_description() { DESCRIPTION="base,clients:${STEP_CLIENTS}"; }
client_write_job_file() { : >"$1"; }
client_hosts_list() { echo "node-a,node-b"; }
client_storage_info_json() { echo '{}'; }
keep_json_copy() { :; }
display_client_step() { :; }
upload_results() { upload_description >>"$TMP/uploads"; echo >>"$TMP/uploads"; }
CLIENT_IOENGINE=libaio CLIENT_UPLOADS_OK=0 CLIENT_UPLOADS_FAILED=0 CLIENT_STEPS_FAILED=0 CLIENT_STEPS_INCOMPLETE=0
TARGET_IS_DEVICE=false FILE_PER_JOB=0 STORAGE_CACHE_BYTES_N="" CACHE_FIT=0 CLIENT_MEM=() CLIENT_ARC=() CLIENT_ON_ZFS=() CLIENT_PCACHE=()
FIO_RETRY_MAX=2 FIO_RETRY_COUNT=0 FIO_RETRY_LOG=() FIO_OUT_1=eagain FIO_OUT_2=two FIO_OUT_3=two
echo 0 >"$TMP/calls" && : >"$TMP/warnings" && : >"$TMP/uploads"
client_run_ramp_step 2 read 4k 1 0 8G none 32 60
client_run_ramp_step 2 randread 4k 1 0 8G none 32 60
warn=$(grep 'Transient fio error' "$TMP/warnings")
check "client EAGAIN retried" 3 "$(cat "$TMP/calls")"
check "client warning has the step parameters" 1 \
    "$(grep -cF '(rw=read bs=4k size=8G numjobs=1 iodepth=32 direct=0 ioengine=libaio, kernel=6.1.0-deb/6.8.12-pve)' <<< "$warn")"
check "retried step uploaded with retried:1" "base,clients:2,retried:1" "$(sed -n 1p "$TMP/uploads")"
check "next step uploaded without the tag" "base,clients:2" "$(sed -n 2p "$TMP/uploads")"
check "client retry logged" 1 "${#FIO_RETRY_LOG[@]}"
check "client log entry names the step" 1 "$(grep -c '^read_4k_1_0_8G_none_32_60_clients2: rw=read' <<< "${FIO_RETRY_LOG[0]:-}")"
check "step parameters cleared after the step" "" "$FIO_RETRY_PARAMS$FIO_RETRY_KERNEL"

# 6. Outside a ramp step (prefill/cleanup) the kernels of all clients are named
check "fio_retry_kernel in client mode" "6.1.0-deb/6.8.12-pve" "$(fio_retry_kernel)"
CLIENT_STORAGE=('{"kernel":"6.8\u001b[31m\\\\x"}' '{}')
check "client kernels without control characters or backslashes" "6.8[31mx" "$(client_kernels 2)"

if [ "$failures" -gt 0 ]; then
    echo "$failures test(s) failed"
    exit 1
fi
echo "all tests passed"
