#!/usr/bin/env bash
# Tests for the fio server mode of fio-test.sh (run: bash scripts/tests/test_server_mode.sh)
# Bind validation, timeout parsing, fio --server address syntax, the published info
# directory and --server-stop (only PIDs recorded in the state dir with a matching command).

# shellcheck disable=SC2034,SC2329  # config vars and stubs are used by the sourced functions

set -u
SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/fio-test.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

FUNCS="parse_duration_seconds is_loopback_addr valid_port server_validate_bind fio_server_address
server_state_dir server_write_info server_pid_matches server_stop_pids json_escape json_object
server_bind_canonical server_write_file server_proc_stamp"
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

failures=0
check() {  # check <description> <expected> <actual>
    if [ "$2" = "$3" ]; then
        echo "ok   - $1"
    else
        echo "FAIL - $1 (expected '$2', got '$3')"
        failures=$((failures + 1))
    fi
}

# --- timeout parsing -----------------------------------------------------------------------
check "plain seconds" 90 "$(parse_duration_seconds 90)"
check "s suffix" 45 "$(parse_duration_seconds 45s)"
check "m suffix" 600 "$(parse_duration_seconds 10m)"
check "h suffix" 7200 "$(parse_duration_seconds 2h)"
check "upper-case H" 3600 "$(parse_duration_seconds 1H)"
check "0 = no timeout" 0 "$(parse_duration_seconds 0)"
parse_duration_seconds "" >/dev/null; check "empty is invalid" 1 "$?"
parse_duration_seconds 2d >/dev/null; check "unknown unit is invalid" 1 "$?"
parse_duration_seconds -5 >/dev/null; check "negative is invalid" 1 "$?"
parse_duration_seconds 1h30m >/dev/null; check "combined units are invalid" 1 "$?"

# --- bind validation -----------------------------------------------------------------------
validate() {  # validate <bind> -> return code; output in $TMP/out
    : >"$TMP/out"
    FIO_SERVER_BIND=$1 FIO_SERVER_PORT=${2:-8765} FIO_SERVER_INFO_PORT=${3:-8766}
    server_validate_bind
}
validate ""; check "missing FIO_SERVER_BIND is rejected" 1 "$?"
check "missing bind names the setting" 1 "$(grep -c 'needs FIO_SERVER_BIND' "$TMP/out")"
validate 0.0.0.0; check "0.0.0.0 is rejected" 1 "$?"
validate "::"; check ":: is rejected" 1 "$?"
validate "[::]"; check "[::] is rejected" 1 "$?"
validate "*"; check "* is rejected" 1 "$?"
validate "10.0.0.1;rm"; check "garbage address is rejected" 1 "$?"
validate 10.44.44.101; check "private IP is accepted" 0 "$?"
check "private IP: loopback flag off" false "$SERVER_LOOPBACK"
check "private IP: no SSH hint" 0 "$(grep -c 'CLIENT_SSH=1' "$TMP/out")"
validate 127.0.0.1; check "127.0.0.1 is accepted" 0 "$?"
check "127.0.0.1: loopback flag on" true "$SERVER_LOOPBACK"
check "127.0.0.1: SSH hint printed" 1 "$(grep -c 'CLIENT_SSH=1' "$TMP/out")"
validate ::1; check "::1 is accepted" 0 "$?"
check "::1: loopback flag on" true "$SERVER_LOOPBACK"
validate 10.0.0.1 99999; check "port out of range is rejected" 1 "$?"
validate 10.0.0.1 8765 abc; check "non-numeric info port is rejected" 1 "$?"
validate 10.0.0.1 8765 8765; check "info port equal to fio port is rejected" 1 "$?"

# --- fio --server / --client address syntax ------------------------------------------------
check "IPv4 address" "ip:10.0.0.1,8765" "$(fio_server_address 10.0.0.1 8765)"
check "IPv6 address" "ip6:fd00::1,8765" "$(fio_server_address fd00::1 8765)"
check "host name" "node1.lan,9000" "$(fio_server_address node1.lan 9000)"

# --- state dir -------------------------------------------------------------------------------
FIO_SERVER_STATE_DIR="$TMP/explicit"
check "explicit state dir wins" "$TMP/explicit" "$(server_state_dir)"
FIO_TEST_HOOKS=1 FIO_SERVER_STATE_DIR="" XDG_RUNTIME_DIR="$TMP/xdg" SI_RUN_DIR="$TMP/no-run"
check "XDG_RUNTIME_DIR fallback" "$TMP/xdg/fio-test" "$(server_state_dir)"
mkdir -p "$TMP/run"
SI_RUN_DIR="$TMP/run"
check "/run preferred when writable" "$TMP/run/fio-test" "$(server_state_dir)"
SI_RUN_DIR="$TMP/no-run" XDG_RUNTIME_DIR=""
check "no default -> empty (mktemp at start)" "" "$(server_state_dir)"
SI_RUN_DIR="$TMP/run" FIO_TEST_HOOKS=""
check "SI_RUN_DIR ignored without FIO_TEST_HOOKS=1" 0 "$(server_state_dir | grep -c "^$TMP/run")"

# --- published info directory ----------------------------------------------------------------
hostname() { echo "node-a"; }
STORAGE_INFO='{"fs_type":"zfs","zfs":{"dataset":"tank/fio"}}'
mkdir -p "$TMP/state"
server_write_info "$TMP/state"
check "storage.json written" "$STORAGE_INFO" "$(cat "$TMP/state/info/storage.json")"
check "hostname.txt written" "node-a" "$(cat "$TMP/state/info/hostname.txt")"
check "only the two info files are published" 2 "$(find "$TMP/state/info" -type f | wc -l | tr -d ' ')"
STORAGE_INFO=""
server_write_info "$TMP/state"
check "empty STORAGE_INFO publishes {}" "{}" "$(cat "$TMP/state/info/storage.json")"
IOENGINE=io_uring
server_write_info "$TMP/state"
check "STORAGE_DETECT=0 still publishes the engine" '{"ioengine":"io_uring"}' "$(cat "$TMP/state/info/storage.json")"
STORAGE_INFO='{"fs_type":"xfs","ioengine":"libaio"}'
server_write_info "$TMP/state"
check "detected storage info is published as is" "$STORAGE_INFO" "$(cat "$TMP/state/info/storage.json")"
STORAGE_INFO="" IOENGINE=""

# --- run_server_mode detects the engine before storage.json is built -------------------------
server_body=$(sed -n '/^run_server_mode()/,/^}/p' "$SCRIPT")
engine_line=$(grep -n '^ *detect_ioengine$' <<< "$server_body" | cut -d: -f1)
storage_line=$(grep -n '^ *detect_storage$' <<< "$server_body" | cut -d: -f1)
check "run_server_mode calls detect_ioengine once" 1 "$(grep -c '^ *detect_ioengine$' <<< "$server_body")"
check "detect_ioengine runs before detect_storage" true \
    "$(if [ "${engine_line:-0}" -gt 0 ] && [ "$engine_line" -lt "${storage_line:-0}" ]; then echo true; else echo false; fi)"

# --- --server-stop: only the recorded PIDs with the same start time, uid and command ---------
# PID file: line 1 PID, line 2 "<lstart> <uid>" from ps at start.
# Stubs: PS_CMD_<pid> command line, PS_START_<pid> start time, PS_UID_<pid> owner uid
ps() {
    local pid=${*: -1} var
    case "$*" in
        *"lstart="*)
            var="PS_START_$pid"; [ -n "${!var:-}" ] || return 1
            local uvar="PS_UID_$pid"
            printf '%s   %s\n' "${!var}" "${!uvar:-1000}"
            ;;
        *)
            var="PS_CMD_$pid"; [ -n "${!var:-}" ] || return 1
            echo "${!var}"
            ;;
    esac
}
kill() {
    if [ "$1" = -0 ]; then
        local var="PS_CMD_$2"
        [ -n "${!var:-}" ]
        return
    fi
    echo "kill $*" >>"$TMP/kills"
}
pidfile() {  # pidfile <file> <pid> <lstart> <uid>
    printf '%s\n%s %s\n' "$2" "$3" "$4" >"$1"
}
T1="Mon Sep 28 16:20:13 2026" T2="Mon Sep 28 16:20:14 2026"
SD="$TMP/stopdir"
mkdir -p "$SD"
: >"$TMP/kills"
PS_CMD_4101="fio --server=ip:10.0.0.1,8765" PS_START_4101=$T1
PS_CMD_4102="python3 -m http.server --bind 10.0.0.1 8766 --directory $SD/info" PS_START_4102=$T1
PS_CMD_4103="bash ./fio-test.sh --server" PS_START_4103=$T1
pidfile "$SD/fio.pid" 4101 "$T1" 1000
pidfile "$SD/http.pid" 4102 "$T1" 1000
pidfile "$SD/server.pid" 4103 "$T1" 1000
check "process stamp is start time + uid" "$T1 1000" "$(server_proc_stamp 4101)"
server_stop_pids "$SD" >/dev/null 2>&1
check "fio server pid killed" 1 "$(grep -c '4101' "$TMP/kills")"
check "info http pid killed" 1 "$(grep -c '4102' "$TMP/kills")"
check "server script pid killed" 1 "$(grep -c '4103' "$TMP/kills")"
check "pid files removed" 0 "$(find "$SD" -name '*.pid' | wc -l | tr -d ' ')"

# a reused PID (other start time or other command) is left alone
: >"$TMP/kills"
PS_CMD_4201="fio --server=ip:10.0.0.1,8765" PS_START_4201=$T2
PS_CMD_4202="vim notes.txt" PS_START_4202=$T1
pidfile "$SD/fio.pid" 4201 "$T1" 1000
pidfile "$SD/http.pid" 4202 "$T1" 1000
server_stop_pids "$SD" >/dev/null 2>&1
check "reused pid (other start time / command) not killed" 0 "$(grep -c . "$TMP/kills")"
check "stale pid files removed" 0 "$(find "$SD" -name '*.pid' | wc -l | tr -d ' ')"

# recorded uid must be ours (root may stop any recorded uid whose stamp matches)
: >"$TMP/kills"
PS_CMD_4301="fio --server=ip:10.0.0.1,8765" PS_START_4301=$T1 PS_UID_4301=0
pidfile "$SD/fio.pid" 4301 "$T1" 0
server_stop_pids "$SD" >/dev/null 2>&1
check "process of another uid not killed" 0 "$(grep -c . "$TMP/kills")"
pidfile "$SD/fio.pid" 4301 "$T1" 1000
server_stop_pids "$SD" >/dev/null 2>&1
check "recorded uid differs from the running one: not killed" 0 "$(grep -c . "$TMP/kills")"
MY_UID=0
pidfile "$SD/fio.pid" 4301 "$T1" 0
server_stop_pids "$SD" >/dev/null 2>&1
check "root stops a matching root-owned server" 1 "$(grep -c '4301' "$TMP/kills")"
MY_UID=1000

# old one-line pid files, dead PIDs and garbage are ignored
: >"$TMP/kills"
echo 4101 >"$SD/fio.pid"
pidfile "$SD/server.pid" 4401 "$T1" 1000
echo '1; rm -rf /' >"$SD/http.pid"
server_stop_pids "$SD" >/dev/null 2>&1
check "pid file without stamp / dead / invalid pids not killed" 0 "$(grep -c . "$TMP/kills")"

# no state dir at all -> error, nothing killed
: >"$TMP/kills"
server_stop_pids "$TMP/does-not-exist" >/dev/null 2>&1; rc=$?
check "missing state dir returns error" 1 "$rc"
check "missing state dir kills nothing" 0 "$(grep -c . "$TMP/kills")"

if [ "$failures" -gt 0 ]; then
    echo "$failures test(s) failed"
    exit 1
fi
echo "all tests passed"
