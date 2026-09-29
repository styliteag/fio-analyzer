#!/usr/bin/env bash
# Tests for command-line and saturation config validation in fio-test.sh
# (run: bash scripts/tests/test_cli_args.sh)
# Misspelled options stop the script with an error instead of being ignored, and saturation
# mode rejects lists in DIRECT/TEST_SIZE/RUNTIME before any test runs (the upload would
# otherwise carry e.g. direct=1,0, which the backend rejects).

# shellcheck disable=SC2034,SC2329  # config vars and stubs are used by the sourced functions

set -u
SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/fio-test.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

failures=0
check() {  # check <description> <expected> <actual>
    if [ "$2" = "$3" ]; then
        echo "ok   - $1"
    else
        echo "FAIL - $1 (expected '$2', got '$3')"
        failures=$((failures + 1))
    fi
}

# run_script <args...>: exit code; output in $TMP/out. HOME/cwd point to an empty dir, so no
# .env is loaded and nothing runs past the argument check.
run_script() {
    local rc=0
    (cd "$TMP" && HOME="$TMP" bash "$SCRIPT" "$@") >"$TMP/out" 2>&1 </dev/null || rc=$?
    echo "$rc"
}

# --- command line --------------------------------------------------------------------------
check "misspelled option: exit 1" 1 "$(run_script --saturaton)"
check "misspelled option: named in the error" 1 "$(grep -c 'Unknown option: --saturaton' "$TMP/out")"
check "misspelled option: points to --help" 1 "$(grep -c -- '--help' "$TMP/out")"
check "unknown option after a valid one: exit 1" 1 "$(run_script -y --treshold 5)"
check "unknown option after a valid one: named in the error" 1 "$(grep -c 'Unknown option: --treshold' "$TMP/out")"
check "positional argument: exit 1" 1 "$(run_script -y extra)"
check "positional argument: named in the error" 1 "$(grep -c 'Unexpected argument: extra' "$TMP/out")"
check "--help not first: exit 1" 1 "$(run_script -y --help)"
check "--help not first: says it must be first" 1 "$(grep -c 'must be the first argument' "$TMP/out")"
check "--help first still works" 0 "$(run_script --help)"
check "--help first prints the usage" 1 "$(grep -c '^Usage:' "$TMP/out")"

# --- saturation config ---------------------------------------------------------------------
# shellcheck source=/dev/null
source <(sed -n '/^validate_saturation_config()/,/^}/p;/^parse_sat_sync_list()/,/^}/p' "$SCRIPT")
for f in validate_saturation_config parse_sat_sync_list; do
    declare -F "$f" >/dev/null || { echo "function $f not found in $SCRIPT"; exit 1; }
done
print_error() { echo "ERR: $*"; }

# sat_validate <VAR=value...>: exit code of validate_saturation_config; output in $TMP/out
sat_validate() {
    local rc=0
    (
        SAT_BLOCK_SIZES=4k SAT_PATTERNS=randread SAT_SYNC="" SYNC=none DIRECT=1 TEST_SIZE=10G RUNTIME=30
        for assignment in "$@"; do declare "$assignment"; done
        validate_saturation_config
    ) >"$TMP/out" 2>&1 || rc=$?
    echo "$rc"
}

check "single values accepted" 0 "$(sat_validate)"
check "sync list accepted (one run per mode)" 0 "$(sat_validate SYNC=sync,dsync)"
check "DIRECT list rejected" 1 "$(sat_validate DIRECT=1,0)"
check "DIRECT list: error names the variable and value" 1 "$(grep -c "single DIRECT value, got '1,0'" "$TMP/out")"
check "DIRECT list: suggests one value" 1 "$(grep -c 'DIRECT=1)' "$TMP/out")"
check "TEST_SIZE list rejected" 1 "$(sat_validate TEST_SIZE=1G,10G)"
check "RUNTIME list rejected" 1 "$(sat_validate RUNTIME=30,60)"

if [ "$failures" -gt 0 ]; then
    echo "${failures} test(s) failed"
    exit 1
fi
echo "all tests passed"
