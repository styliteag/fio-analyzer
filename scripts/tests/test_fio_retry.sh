#!/usr/bin/env bash
# Tests for the transient-error retry in fio-test.sh (run: bash scripts/tests/test_fio_retry.sh)
# Loads only the retry helpers from the script and replaces fio with a stub.

# shellcheck disable=SC2034  # FIO_RETRY_* and FAIL_* are read by the sourced/stub functions

set -u
SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/fio-test.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# shellcheck source=/dev/null
source <(sed -n '/^transient_fio_error_line()/,/^}/p;/^is_transient_fio_error()/,/^}/p;/^run_fio_with_retry()/,/^}/p' "$SCRIPT")
declare -F run_fio_with_retry >/dev/null || { echo "retry helpers not found in $SCRIPT"; exit 1; }

print_warning() { echo "WARN: $*" >>"$TMP/warnings"; }
sleep() { :; }  # no real waiting in tests

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

if [ "$failures" -gt 0 ]; then
    echo "$failures test(s) failed"
    exit 1
fi
echo "all tests passed"
