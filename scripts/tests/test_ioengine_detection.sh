#!/usr/bin/env bash
# Tests for I/O engine detection in fio-test.sh (run: bash scripts/tests/test_ioengine_detection.sh)
# Regression: an explicitly chosen sync engine (-i psync) must set IS_SYNC_ENGINE, otherwise
# saturation mode escalates iodepth, which sync engines ignore.

# shellcheck disable=SC2034  # IOENGINE/IODEPTH are read by the sourced function

set -u
SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/fio-test.sh"

# shellcheck source=/dev/null
source <(sed -n '/^set_sync_engine_flag()/,/^}/p;/^detect_ioengine()/,/^}/p' "$SCRIPT")
declare -F detect_ioengine >/dev/null || { echo "detect_ioengine not found in $SCRIPT"; exit 1; }

print_status() { :; }
print_success() { :; }
print_warning() { :; }
print_error() { :; }

failures=0
check() {  # check <description> <expected> <actual>
    if [ "$2" = "$3" ]; then
        echo "ok   - $1"
    else
        echo "FAIL - $1 (expected '$2', got '$3')"
        failures=$((failures + 1))
    fi
}

AVAILABLE=""
test_ioengine() { [[ " $AVAILABLE " == *" $1 "* ]]; }

detect() {  # detect <explicit engine or ""> <available engines>
    IOENGINE=$1 AVAILABLE=$2 IS_SYNC_ENGINE=unset IODEPTH=4
    detect_ioengine
}

for engine in psync sync vsync; do
    detect "$engine" "io_uring libaio psync sync vsync"
    check "explicit $engine is a sync engine" true "$IS_SYNC_ENGINE"
done

for engine in io_uring libaio; do
    detect "$engine" "io_uring libaio psync"
    check "explicit $engine is not a sync engine" false "$IS_SYNC_ENGINE"
done

detect "" "io_uring libaio psync"
check "auto-detect prefers io_uring" io_uring "$IOENGINE"
check "auto-detected io_uring is not a sync engine" false "$IS_SYNC_ENGINE"

detect "" "psync"
check "auto-detect falls back to psync" psync "$IOENGINE"
check "auto-detected psync is a sync engine" true "$IS_SYNC_ENGINE"

if [ "$failures" -gt 0 ]; then
    echo "$failures test(s) failed"
    exit 1
fi
echo "all tests passed"
