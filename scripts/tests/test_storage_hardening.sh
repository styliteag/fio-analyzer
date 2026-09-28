#!/usr/bin/env bash
# Hardening tests for storage detection in fio-test.sh (run: bash scripts/tests/test_storage_hardening.sh)
# - values read from sysfs/DMI/tools are printed to root's terminal: control bytes must be stripped
# - device names from lsblk/sysfs must not walk the sysfs tree with '..'
# - test hooks (SI_*) must not be settable from .env

# shellcheck disable=SC2034  # variables are read by the sourced functions

set -u
SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/fio-test.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# shellcheck source=/dev/null
source <(sed -n '/^si_safe_arg()/,/^}/p;/^si_run()/,/^}/p;/^si_read_file()/,/^}/p;/^si_token()/,/^}/p;/^storage_parent_disk()/,/^}/p;/^clear_storage_overrides()/,/^}/p' "$SCRIPT")
for fn in si_read_file si_token storage_parent_disk clear_storage_overrides; do
    declare -F "$fn" >/dev/null || { echo "$fn not found in $SCRIPT"; exit 1; }
done

failures=0
check() {  # check <description> <expected> <actual>
    if [ "$2" = "$3" ]; then
        echo "ok   - $1"
    else
        echo "FAIL - $1 (expected '$2', got '$3')"
        failures=$((failures + 1))
    fi
}

printf 'Evil\033]0;owned\007 Corp\n' >"$TMP/sys_vendor"
check "si_read_file strips control bytes" "Evil]0;owned Corp" "$(si_read_file "$TMP/sys_vendor")"

SI_TOKENS=()
si_token model $'QEMU\033[2J DISK'
check "si_token strips control bytes" 'model="QEMU[2J DISK"' "${SI_TOKENS[0]}"

lsblk() { echo ".."; }
command() { [ "$1" = -v ] && return 0; builtin command "$@"; }
SI_SYS_ROOT="$TMP/empty"
check "parent '..' from lsblk is ignored" "sdz" "$(storage_parent_disk sdz)"
lsblk() { echo "../../etc"; }
check "parent with '/' from lsblk is ignored" "sdz" "$(storage_parent_disk sdz)"
lsblk() { echo "sda"; }
check "valid parent is followed" "sda" "$(storage_parent_disk sda1)"

SI_SYS_ROOT=/tmp/elsewhere SI_ZVOL_DIR=/x SI_ZFS_SYNC=disabled
clear_storage_overrides
check "SI_* hooks from .env are cleared" "" "${SI_SYS_ROOT:-}${SI_ZVOL_DIR:-}${SI_ZFS_SYNC:-}"

if [ "$failures" -gt 0 ]; then
    echo "$failures test(s) failed"
    exit 1
fi
echo "all tests passed"
