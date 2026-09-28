#!/usr/bin/env bash
# Security tests for the server mode of fio-test.sh (run: bash scripts/tests/test_server_security.sh)
# Wildcard bind spellings, loopback bind as root, the state directory checks and
# symlink-safe writes of PID files and published info.

# shellcheck disable=SC2034,SC2329  # config vars and stubs are used by the sourced functions

set -u
SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/fio-test.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

FUNCS="is_loopback_addr valid_port server_bind_canonical server_validate_bind server_check_state_dir
server_write_file server_write_info server_proc_stamp server_write_pidfile"
SED_EXPR=""
for f in $FUNCS; do SED_EXPR+="/^${f}()/,/^}/p;"; done
# shellcheck source=/dev/null
source <(sed -n "$SED_EXPR" "$SCRIPT")
for f in $FUNCS; do
    declare -F "$f" >/dev/null || { echo "function $f not found in $SCRIPT"; exit 1; }
done

print_status() { echo "INFO: $*" >>"$TMP/out"; }
print_success() { :; }
print_warning() { echo "WARN: $*" >>"$TMP/out"; }
print_error() { echo "ERR: $*" >>"$TMP/out"; }
MY_UID=1000
id() { case "$1" in -u) echo "$MY_UID" ;; *) echo tester ;; esac; }
MISSING=""
command() {
    if [ "$1" = -v ] && [[ " $MISSING " == *" $2 "* ]]; then return 1; fi
    builtin command "$@"
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
validate() {  # validate <bind> -> return code of server_validate_bind
    : >"$TMP/out"
    FIO_SERVER_BIND=$1 FIO_SERVER_PORT=8765 FIO_SERVER_INFO_PORT=8766
    server_validate_bind
}

# --- 1. wildcard / non-canonical bind addresses (python3 ipaddress) ------------------------
for bad in 0::0 0:: ::0000 0000:: ::0.0.0.0 ::ffff:0.0.0.0 00.0.0.0 0.0.0.00 010.0.0.1 \
    0:0:0:0:0:0:0:0 "[::]" 1.2.3.256 fd00::1%eth0; do
    validate "$bad"; rc=$?
    check "python3: '$bad' refused" 1 "$rc"
done
for good in 10.44.44.101 127.0.0.1 ::1 fd00::1 FD00::1 "[fd00::5]"; do
    validate "$good"; rc=$?
    check "python3: '$good' accepted" 0 "$rc"
done
validate FD00::1
check "IPv6 stored in canonical form" fd00::1 "$FIO_SERVER_BIND"

# --- 1b. without python3: strict canonical regex ----------------------------------------------
MISSING=python3
for bad in 0.0.0.0 00.0.0.0 0.0.0.00 010.0.0.1 1.2.3.256 0::0 :: fd00::1 ::ffff:0.0.0.0; do
    validate "$bad"; rc=$?
    check "no python3: '$bad' refused" 1 "$rc"
done
for good in 10.44.44.101 127.0.0.1 ::1; do
    validate "$good"; rc=$?
    check "no python3: '$good' accepted" 0 "$rc"
done
MISSING=""

# --- 2. loopback bind as root ---------------------------------------------------------------
MY_UID=0 FIO_SERVER_ALLOW_ROOT=""
validate 127.0.0.1; rc=$?
check "root + loopback refused" 1 "$rc"
check "root + loopback names FIO_SERVER_ALLOW_ROOT" 1 "$(grep -c 'FIO_SERVER_ALLOW_ROOT=1' "$TMP/out")"
validate ::1; check "root + ::1 refused" 1 "$?"
FIO_SERVER_ALLOW_ROOT=1
validate 127.0.0.1; check "root + loopback with FIO_SERVER_ALLOW_ROOT=1 allowed" 0 "$?"
FIO_SERVER_ALLOW_ROOT=""
validate 10.44.44.101; check "root + network address allowed (firewall case)" 0 "$?"
MY_UID=1000
validate 127.0.0.1; check "non-root + loopback allowed" 0 "$?"

# --- 4. state directory checks ----------------------------------------------------------------
mkdir -p "$TMP/good" && chmod 700 "$TMP/good"
server_check_state_dir "$TMP/good"; check "own 700 dir accepted" 0 "$?"
server_check_state_dir "$TMP/new-dir"; check "missing dir accepted (created with 700)" 0 "$?"
mkdir -p "$TMP/gw" && chmod 770 "$TMP/gw"
server_check_state_dir "$TMP/gw" 2>/dev/null; check "group-writable dir refused" 1 "$?"
mkdir -p "$TMP/ow" && chmod 707 "$TMP/ow"
server_check_state_dir "$TMP/ow" 2>/dev/null; check "other-writable dir refused" 1 "$?"
ln -s "$TMP/good" "$TMP/link"
server_check_state_dir "$TMP/link" 2>/dev/null; check "symlink refused" 1 "$?"
server_check_state_dir / 2>/dev/null; check "dir owned by someone else refused" 1 "$?"
mkdir -p "$TMP/good2" "$TMP/elsewhere" && chmod 700 "$TMP/good2" && ln -s "$TMP/elsewhere" "$TMP/good2/info"
server_check_state_dir "$TMP/good2" 2>/dev/null; check "symlinked info/ refused" 1 "$?"

# --- 4b. writes never follow symlinks ---------------------------------------------------------
mkdir -p "$TMP/sd" "$TMP/victim"
echo original >"$TMP/victim/file"
ln -s "$TMP/victim/file" "$TMP/sd/fio.pid"
server_write_file "$TMP/sd" fio.pid "4242"
check "symlink target untouched" original "$(cat "$TMP/victim/file")"
check "file replaced the symlink" "4242" "$(cat "$TMP/sd/fio.pid")"
check "no symlink left" 0 "$([ -L "$TMP/sd/fio.pid" ] && echo 1 || echo 0)"
check "no temp files left" 1 "$(find "$TMP/sd" -type f | wc -l | tr -d ' ')"
mkdir -p "$TMP/sd/info"
ln -s "$TMP/victim/file" "$TMP/sd/info/storage.json"
hostname() { echo node-a; }
STORAGE_INFO='{"fs_type":"xfs"}'
server_write_info "$TMP/sd"
check "storage.json symlink not followed" original "$(cat "$TMP/victim/file")"
check "storage.json written" '{"fs_type":"xfs"}' "$(cat "$TMP/sd/info/storage.json")"

# PID file with start time and uid
ps() { case "$*" in *lstart=*) echo "Mon Sep 28 16:20:13 2026    1000" ;; *) return 1 ;; esac; }
server_write_pidfile "$TMP/sd" http 777
check "pid file line 1 = pid" 777 "$(sed -n 1p "$TMP/sd/http.pid")"
check "pid file line 2 = start time + uid" "Mon Sep 28 16:20:13 2026 1000" "$(sed -n 2p "$TMP/sd/http.pid")"

if [ "$failures" -gt 0 ]; then
    echo "$failures test(s) failed"
    exit 1
fi
echo "all tests passed"
