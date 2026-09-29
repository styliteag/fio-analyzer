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

# --- client mode: engine chosen from the clients' storage.json ------------------------------
# shellcheck source=/dev/null
source <(sed -n '/^client_ioengine_rank()/,/^}/p;/^client_choose_ioengine()/,/^}/p' "$SCRIPT")
declare -F client_choose_ioengine >/dev/null || { echo "client_choose_ioengine not found in $SCRIPT"; exit 1; }
command -v jq >/dev/null || { echo "jq is required for these tests"; exit 1; }

choose() {  # choose <CLIENT_IOENGINE> <storage.json per client>...
    CLIENT_IOENGINE=$1 IOENGINE="" IS_SYNC_ENGINE=unset IODEPTH=(4 16)
    shift
    CLIENT_STORAGE=("$@") CLIENT_ENTRY=()
    local i
    for ((i = 0; i < $#; i++)); do CLIENT_ENTRY+=("10.0.0.$((i + 1))"); done
    client_choose_ioengine
}

choose "" '{"ioengine":"io_uring"}' '{"ioengine":"io_uring","fs_type":"xfs"}'
check "all clients io_uring -> io_uring" io_uring "$CLIENT_IOENGINE"
check "IOENGINE follows the client engine" io_uring "$IOENGINE"
check "io_uring keeps iodepth" "4 16" "${IODEPTH[*]}"

choose "" '{"ioengine":"io_uring"}' '{"ioengine":"libaio"}' '{"ioengine":"io_uring"}'
check "one libaio client -> libaio for all" libaio "$CLIENT_IOENGINE"
check "libaio is not a sync engine" false "$IS_SYNC_ENGINE"

choose "" '{"ioengine":"libaio"}' '{"ioengine":"psync"}'
check "one psync client -> psync" psync "$CLIENT_IOENGINE"
check "psync sets the sync flag" true "$IS_SYNC_ENGINE"
check "psync forces iodepth 1" "1" "${IODEPTH[*]}"

choose "" '{"ioengine":"io_uring"}' '{}'
check "client without ioengine (older --server) -> libaio" libaio "$CLIENT_IOENGINE"
check "IOENGINE matches the fallback" libaio "$IOENGINE"

choose "" '{"ioengine":"io_uring"}' '{"ioengine":"posixaio"}'
check "unknown engine -> libaio" libaio "$CLIENT_IOENGINE"

choose "" '{"ioengine":5}' '{"ioengine":"io_uring"}'
check "non-string ioengine -> libaio" libaio "$CLIENT_IOENGINE"

choose ""
check "no clients -> libaio" libaio "$CLIENT_IOENGINE"

choose psync '{"ioengine":"io_uring"}' '{"ioengine":"io_uring"}'
check "explicit CLIENT_IOENGINE is kept" psync "$CLIENT_IOENGINE"
check "explicit psync sets the sync flag" true "$IS_SYNC_ENGINE"
check "explicit engine leaves iodepth alone" "4 16" "${IODEPTH[*]}"

choose libaio '{}'
check "explicit libaio with clients publishing nothing" libaio "$IOENGINE"

# main() picks the engine after client_fetch_info and before show_config / any job file
main_body=$(sed -n '/^main()/,/^}/p' "$SCRIPT")
fetch_line=$(grep -n '^ *client_fetch_info$' <<< "$main_body" | cut -d: -f1)
choose_line=$(grep -n '^ *client_choose_ioengine$' <<< "$main_body" | cut -d: -f1)
show_line=$(grep -n '^ *show_config$' <<< "$main_body" | cut -d: -f1)
check "main: client_fetch_info < client_choose_ioengine < show_config" true \
    "$(if [ "${fetch_line:-0}" -gt 0 ] && [ "${choose_line:-0}" -gt "$fetch_line" ] && [ "${show_line:-0}" -gt "$choose_line" ]; then echo true; else echo false; fi)"

if [ "$failures" -gt 0 ]; then
    echo "$failures test(s) failed"
    exit 1
fi
echo "all tests passed"
