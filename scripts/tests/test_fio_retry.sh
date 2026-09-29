#!/usr/bin/env bash
# Tests for the transient-error retry in fio-test.sh (run: bash scripts/tests/test_fio_retry.sh)
# Loads only the retry helpers from the script and replaces fio with a stub.

# shellcheck disable=SC2034,SC2329  # FIO_RETRY_* and FAIL_* are read by the sourced/stub functions

set -u
SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/fio-test.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# shellcheck source=/dev/null
FUNCS="transient_fio_error_line is_transient_fio_error run_fio_with_retry retry_clean_text
fio_retry_params fio_retry_kernel print_retry_log print_retry_summary upload_description
upload_results run_fio_test"
SED_EXPR=""
for f in $FUNCS; do SED_EXPR+="/^${f}()/,/^}/p;"; done
# shellcheck source=/dev/null
source <(sed -n "$SED_EXPR" "$SCRIPT")
for f in $FUNCS; do
    declare -F "$f" >/dev/null || { echo "function $f not found in $SCRIPT"; exit 1; }
done

print_warning() { echo "WARN: $*" >>"$TMP/warnings"; }
print_status() { :; }
print_success() { :; }
print_error() { :; }
sleep() { :; }  # no real waiting in tests
FIO_RETRY_LOG=() FIO_TEST_RETRIES=0 FIO_RETRY_PARAMS="" FIO_RETRY_KERNEL="" SI_KERNEL="6.8.12-test"

failures=0
check() {  # check <description> <expected> <actual>
    if [ "$2" = "$3" ]; then
        echo "ok   - $1"
    else
        echo "FAIL - $1 (expected '$2', got '$3')"
        failures=$((failures + 1))
    fi
}

# Stub: fail with the given stderr for the first N calls, then succeed
stub_fio() {  # stub_fio <failures-before-success> <stderr-message>
    echo 0 >"$TMP/calls"
    FAIL_TIMES=$1 FAIL_MSG=$2
    fio() {
        local calls
        calls=$(( $(cat "$TMP/calls") + 1 ))
        echo "$calls" >"$TMP/calls"
        if [ "$calls" -le "$FAIL_TIMES" ]; then
            echo "$FAIL_MSG" >&2
            return 1
        fi
        return 0
    }
}

EAGAIN_MSG='fio: io_u error on file /t/f.0: Resource temporarily unavailable: read offset=8589930496, buflen=4096'

# 1. EAGAIN once, then success -> succeeds after one retry
FIO_RETRY_MAX=2 FIO_RETRY_COUNT=0
stub_fio 1 "$EAGAIN_MSG"
run_fio_with_retry "randread 4k" "$TMP/err" --name=x; rc=$?
check "EAGAIN once then success returns 0" 0 "$rc"
check "EAGAIN once runs fio twice" 2 "$(cat "$TMP/calls")"
check "retry is counted" 1 "$FIO_RETRY_COUNT"
check "retry is logged" 1 "$(grep -c 'retry 1/2' "$TMP/warnings")"

# 2. EAGAIN every time -> gives up after FIO_RETRY_MAX retries
FIO_RETRY_MAX=2 FIO_RETRY_COUNT=0
stub_fio 99 "$EAGAIN_MSG"
run_fio_with_retry "randread 4k" "$TMP/err" --name=x; rc=$?
check "persistent EAGAIN fails" 1 "$rc"
check "persistent EAGAIN runs 1 + 2 retries" 3 "$(cat "$TMP/calls")"
check "error output of last attempt is kept" 1 "$(grep -c 'Resource temporarily unavailable' "$TMP/err")"

# 3. Other errors are not retried
FIO_RETRY_MAX=2 FIO_RETRY_COUNT=0
stub_fio 1 'fio: pid=1, err=28/file:filesetup.c:240, error=No space left on device'
run_fio_with_retry "write 4k" "$TMP/err" --name=x; rc=$?
check "non-transient error fails immediately" 1 "$rc"
check "non-transient error runs fio once" 1 "$(cat "$TMP/calls")"
check "non-transient error is not counted" 0 "$FIO_RETRY_COUNT"

# 4. fio's numeric form err=11 is recognised
FIO_RETRY_MAX=1 FIO_RETRY_COUNT=0
stub_fio 1 'fio: pid=42, err=11/file:io_u.c:1889, func=io_u error, error=Resource temporarily unavailable'
run_fio_with_retry "read 1M" "$TMP/err" --name=x; rc=$?
check "err=11 form is retried" 0 "$rc"

# 5. FIO_RETRY_MAX=0 disables retries
FIO_RETRY_MAX=0 FIO_RETRY_COUNT=0
stub_fio 1 "$EAGAIN_MSG"
run_fio_with_retry "randread 4k" "$TMP/err" --name=x; rc=$?
check "FIO_RETRY_MAX=0 disables retry" 1 "$rc"

# 6. Arguments reach fio unchanged
FIO_RETRY_MAX=0
fio() { printf '%s|' "$@" >"$TMP/args"; return 0; }
run_fio_with_retry "x" "$TMP/err" --name="a b" --filename_format='f.$jobnum'
check "arguments are passed through verbatim" '--name=a b|--filename_format=f.$jobnum|' "$(cat "$TMP/args")"

# 7. The warning names the job parameters and the kernel; the log lists the retried run
FIO_RETRY_MAX=2 FIO_RETRY_COUNT=0 FIO_TEST_RETRIES=0 FIO_RETRY_LOG=()
: >"$TMP/warnings"
stub_fio 1 "$EAGAIN_MSG"
run_fio_with_retry "read 4k" "$TMP/err" --name=x --rw=read --bs=4k --size=8G --numjobs=1 \
    --runtime=60 --iodepth=32 --direct=0 --output-format=json --ioengine=io_uring
warn=$(cat "$TMP/warnings")
check "warning contains the job parameters" 1 \
    "$(grep -cF 'rw=read bs=4k size=8G numjobs=1 iodepth=32 direct=0 ioengine=io_uring' <<< "$warn")"
check "warning contains the kernel" 1 "$(grep -cF 'kernel=6.8.12-test' <<< "$warn")"
check "retry counted for the current test" 1 "$FIO_TEST_RETRIES"
check "one retried run logged" 1 "${#FIO_RETRY_LOG[@]}"
check "log entry has label, parameters, kernel, retries and result" \
    'read 4k: rw=read bs=4k size=8G numjobs=1 iodepth=32 direct=0 ioengine=io_uring, kernel=6.8.12-test, retries=1, ok' \
    "${FIO_RETRY_LOG[0]:-}"
check "print_retry_log lists the run" "  retried: ${FIO_RETRY_LOG[0]:-}" "$(print_retry_log '  retried: ')"
: >"$TMP/warnings"
print_retry_summary
check "summary lists the retried run" 1 "$(grep -cF 'read 4k: rw=read bs=4k size=8G' "$TMP/warnings")"
check "summary mentions the retried:N tag" 1 "$(grep -c 'tagged retried:N' "$TMP/warnings")"

# 8. A run that never succeeds is logged as failed; runs without retry are not logged
FIO_RETRY_MAX=1 FIO_RETRY_COUNT=0 FIO_TEST_RETRIES=0 FIO_RETRY_LOG=()
stub_fio 99 "$EAGAIN_MSG"
run_fio_with_retry "randread 4k" "$TMP/err" --rw=randread --direct=1
check "failed retried run logged as failed" 'randread 4k: rw=randread direct=1, kernel=6.8.12-test, retries=1, failed' "${FIO_RETRY_LOG[0]:-}"
stub_fio 0 ""
run_fio_with_retry "write 4k" "$TMP/err" --rw=write
check "run without retry not logged" 1 "${#FIO_RETRY_LOG[@]}"

# 9. FIO_RETRY_PARAMS / FIO_RETRY_KERNEL override (client mode: parameters in a job file)
FIO_RETRY_MAX=1 FIO_TEST_RETRIES=0 FIO_RETRY_LOG=() FIO_RETRY_PARAMS="rw=read bs=1M" FIO_RETRY_KERNEL="6.1.0-a/6.8.0-b"
: >"$TMP/warnings"
stub_fio 1 "$EAGAIN_MSG"
run_fio_with_retry "step" "$TMP/err" job.fio
check "FIO_RETRY_PARAMS and FIO_RETRY_KERNEL in the warning" 1 \
    "$(grep -cF '(rw=read bs=1M, kernel=6.1.0-a/6.8.0-b)' "$TMP/warnings")"
FIO_RETRY_PARAMS="" FIO_RETRY_KERNEL=""

# 10. No control characters or backslashes from fio's stderr reach the terminal
FIO_RETRY_MAX=1 FIO_TEST_RETRIES=0 FIO_RETRY_LOG=()
: >"$TMP/warnings"
stub_fio 1 $'fio: io_u error: Resource temporarily unavailable \e[31mX\\n'
run_fio_with_retry $'lab\x07el' "$TMP/err" --rw=read
check "warning free of control characters" 0 "$(LC_ALL=C grep -c '[[:cntrl:]]' "$TMP/warnings")"
check "warning free of backslashes" 0 "$(grep -cF -- "\\" "$TMP/warnings")"
check "log free of control characters" 0 "$(printf '%s\n' "${FIO_RETRY_LOG[0]:-}" | LC_ALL=C grep -c '[[:cntrl:]]')"

# 11. run_fio_test + upload_results: retried:N only on the retried test's upload
data_file_base() { echo "fio_test_$1"; }
build_fio_target_args() { FIO_TARGET_ARGS=(--filename="$TMP/$1"); }
prefill_test_files() { return 0; }
remove_test_files() { :; }
sanitize_fio_json() { :; }
keep_json_copy() { :; }
curl_auth_config() { :; }
curl() {  # record the description field, answer HTTP 200
    local arg
    for arg in "$@"; do
        case "$arg" in description=*) echo "${arg#description=}" >>"$TMP/uploads" ;; esac
    done
    printf '{}200'
}
FIO_TARGET_ARGS=() FIO_EXTRA_ARGS_ARR=() IOENGINE=io_uring SATURATION_MODE=false CLIENT_MODE=false
STORAGE_INFO="" BACKEND_URL=http://x HOSTNAME=h PROTOCOL=p DRIVE_TYPE=t DRIVE_MODEL=m CONFIG_UUID=c RUN_UUID=r
DESCRIPTION="base,hostname:h"
FIO_RETRY_MAX=2 FIO_RETRY_COUNT=0 FIO_TEST_RETRIES=0 FIO_RETRY_LOG=()
: >"$TMP/uploads" && : >"$TMP/warnings"
stub_fio 1 "$EAGAIN_MSG"
run_fio_test 4k read "$TMP/out.json" 1 0 8G none 32 60 >/dev/null
upload_results "$TMP/out.json" test1 >/dev/null
stub_fio 0 ""
run_fio_test 4k randread "$TMP/out.json" 1 0 8G none 32 60 >/dev/null
upload_results "$TMP/out.json" test2 >/dev/null
stub_fio 2 "$EAGAIN_MSG"
run_fio_test 1M write "$TMP/out.json" 4 1 8G none 32 60 >/dev/null
upload_results "$TMP/out.json" test3 >/dev/null
check "retried test uploaded with retried:1" "base,hostname:h,retried:1" "$(sed -n 1p "$TMP/uploads")"
check "next test uploaded without the tag" "base,hostname:h" "$(sed -n 2p "$TMP/uploads")"
check "test with two retries uploaded with retried:2" "base,hostname:h,retried:2" "$(sed -n 3p "$TMP/uploads")"
check "DESCRIPTION itself is unchanged" "base,hostname:h" "$DESCRIPTION"
check "run_fio_test warning has its parameters" 1 \
    "$(grep -cF 'Transient fio error in read 4k (rw=read bs=4k size=8G numjobs=1 iodepth=32 direct=0 ioengine=io_uring, kernel=6.8.12-test)' "$TMP/warnings")"
check "two retried runs in the log" 2 "${#FIO_RETRY_LOG[@]}"
check "whole-run retry count" 3 "$FIO_RETRY_COUNT"

# 12. Saturation steps (run_fio_step) count their retries per step, too
# shellcheck source=/dev/null
source <(sed -n '/^run_fio_step()/,/^}/p' "$SCRIPT")
print_step() { :; }
sat_step_size() { SAT_STEP_SIZE=8G; }
sat_cap_active() { return 1; }
sat_drop_stale_prefill() { :; }
SAT_DIRECT=0 SAT_RUNTIME=60 SAT_SYNC=none SATURATION_MODE=true LATENCY_THRESHOLD_MS=100
: >"$TMP/uploads"
stub_fio 1 "$EAGAIN_MSG"
run_fio_step randread 4 2 "$TMP/out.json" 4k
upload_results "$TMP/out.json" step1 >/dev/null
stub_fio 0 ""
run_fio_step randread 8 2 "$TMP/out.json" 4k
upload_results "$TMP/out.json" step2 >/dev/null
check "retried saturation step tagged" "base,hostname:h,retried:1" "$(sed -n 1p "$TMP/uploads")"
check "next saturation step not tagged" "base,hostname:h" "$(sed -n 2p "$TMP/uploads")"

if [ "$failures" -gt 0 ]; then
    echo "$failures test(s) failed"
    exit 1
fi
echo "all tests passed"
