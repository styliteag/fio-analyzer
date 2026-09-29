#!/usr/bin/env bash
# Tests for the upload retry in fio-test.sh (run: bash scripts/tests/test_upload_retry.sh)
# A server that is briefly unreachable or restarting (e.g. during an update) must not lose a
# result: transient HTTP errors are retried; client errors are not.

# shellcheck disable=SC2034  # variables are read by the sourced functions

set -u
SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/fio-test.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# shellcheck source=/dev/null
source <(sed -n '/^upload_retryable()/,/^}/p; /^upload_post()/,/^}/p; /^upload_results()/,/^}/p' "$SCRIPT")
for f in upload_retryable upload_post upload_results; do
    declare -F "$f" >/dev/null || { echo "$f not found in $SCRIPT"; exit 1; }
done

print_status() { :; }
print_success() { :; }
print_error() { :; }
print_warning() { echo "WARN $*" >>"$TMP/warnings"; }
upload_description() { echo d; }
curl_auth_config() { :; }
sleep() { echo "$1" >>"$TMP/sleeps"; }
# curl answers with the next code from $TMP/codes (one per line), then 200
curl() {
    local code
    code=$(head -n 1 "$TMP/codes"); sed -i.bak '1d' "$TMP/codes"
    echo x >>"$TMP/calls"
    printf '{"message":"m"}%s' "${code:-200}"
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

DRIVE_MODEL=m DRIVE_TYPE=t HOSTNAME=h1 PROTOCOL=local CONFIG_UUID=c RUN_UUID=r
BACKEND_URL=http://x SATURATION_MODE=false STORAGE_INFO=''

run_upload() {  # run_upload <codes...>: sets RC, CALLS, SLEEPS
    printf '%s\n' "$@" >"$TMP/codes"
    : >"$TMP/calls"; : >"$TMP/sleeps"; : >"$TMP/warnings"
    upload_results "$TMP/result.json" "step" >/dev/null 2>&1
    RC=$?
    CALLS=$(wc -l <"$TMP/calls" | tr -d ' ')
    SLEEPS=$(tr '\n' ' ' <"$TMP/sleeps" | sed 's/ $//')
}

for code in 000 404 408 429 502 503 504; do
    check "HTTP $code is retryable" 0 "$(upload_retryable "$code"; echo $?)"
done
for code in 200 400 401 403 409 413 422 500; do
    check "HTTP $code is not retryable" 1 "$(upload_retryable "$code"; echo $?)"
done

UPLOAD_RETRY_MAX=3 UPLOAD_RETRY_DELAY=10
run_upload 200
check "success: one call" 1 "$CALLS"
check "success: rc 0" 0 "$RC"
check "success: no sleep" "" "$SLEEPS"

run_upload 404 502 200
check "server update (404, 502): uploaded on the third call" 3 "$CALLS"
check "server update: rc 0" 0 "$RC"
check "server update: delay doubles" "10 20" "$SLEEPS"
check "server update: each retry is warned about" 2 "$(grep -c 'retry' "$TMP/warnings")"

run_upload 000 000 000 000 000
check "unreachable: 1 + UPLOAD_RETRY_MAX calls" 4 "$CALLS"
check "unreachable: rc 1" 1 "$RC"
check "unreachable: no sleep after the last attempt" "10 20 40" "$SLEEPS"

UPLOAD_RETRY_DELAY=40
run_upload 503 503 503 200
check "delay capped at 60 s" "40 60 60" "$SLEEPS"

UPLOAD_RETRY_DELAY=10
run_upload 409
check "client error (409): no retry" 1 "$CALLS"
check "client error: rc 1" 1 "$RC"

UPLOAD_RETRY_MAX=0
run_upload 503
check "UPLOAD_RETRY_MAX=0: no retry" 1 "$CALLS"

if [ "$failures" -gt 0 ]; then
    echo "$failures test(s) failed"
    exit 1
fi
echo "all tests passed"
