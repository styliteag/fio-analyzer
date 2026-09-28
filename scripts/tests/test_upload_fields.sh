#!/usr/bin/env bash
# Tests for upload_results in fio-test.sh (run: bash scripts/tests/test_upload_fields.sh)
# Metadata fields must be sent with --form-string: with -F, a value starting with '@' or '<'
# makes curl read and upload a local file (the script often runs as root).

# shellcheck disable=SC2034  # variables are read by the sourced function

set -u
SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/fio-test.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# shellcheck source=/dev/null
source <(sed -n '/^upload_results()/,/^}/p' "$SCRIPT")
declare -F upload_results >/dev/null || { echo "upload_results not found in $SCRIPT"; exit 1; }

print_status() { :; }
print_success() { :; }
print_error() { :; }
print_warning() { :; }
curl() { printf '%s\n' "$@" >"$TMP/args"; printf '{"message":"ok"}200'; }

failures=0
check() {  # check <description> <expected> <actual>
    if [ "$2" = "$3" ]; then
        echo "ok   - $1"
    else
        echo "FAIL - $1 (expected '$2', got '$3')"
        failures=$((failures + 1))
    fi
}

DRIVE_MODEL='@/etc/shadow' DRIVE_TYPE='<secret' HOSTNAME=h1 PROTOCOL=local DESCRIPTION=d
CONFIG_UUID=c RUN_UUID=r USERNAME=u PASSWORD=p BACKEND_URL=http://x SATURATION_MODE=false STORAGE_INFO=''
upload_results "$TMP/result.json" "t" >/dev/null 2>&1

args=$(cat "$TMP/args")
check "file is the only -F field" 1 "$(grep -cx -- '-F' "$TMP/args")"
check "file field uploads the JSON" 1 "$(grep -cx -- "file=@$TMP/result.json" "$TMP/args")"
for field in drive_model drive_type hostname protocol description config_uuid run_uuid; do
    line=$(grep -n -- "^${field}=" "$TMP/args" | cut -d: -f1)
    previous=$(sed -n "$((line - 1))p" "$TMP/args")
    check "$field is sent with --form-string" "--form-string" "$previous"
done
check "hostile drive_model is sent literally" 1 "$(printf '%s\n' "$args" | grep -cx -- 'drive_model=@/etc/shadow')"

if [ "$failures" -gt 0 ]; then
    echo "$failures test(s) failed"
    exit 1
fi
echo "all tests passed"
