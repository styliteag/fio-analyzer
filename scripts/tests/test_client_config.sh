#!/usr/bin/env bash
# Tests for the client (controller) configuration of fio-test.sh
# (run: bash scripts/tests/test_client_config.sh)
# CLIENTS / RAMP_CLIENTS parsing, the client-mode settings check, fio --client arguments
# and the SSH tunnel command lines.

# shellcheck disable=SC2034,SC2329  # config vars and stubs are used by the sourced functions

set -u
SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/fio-test.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

FUNCS="valid_port fio_server_address parse_clients parse_ramp_clients validate_client_config
client_ssh_command client_setup_connections client_close_tunnels client_fio_args"
SED_EXPR=""
for f in $FUNCS; do SED_EXPR+="/^${f}()/,/^}/p;"; done
# shellcheck source=/dev/null
source <(sed -n "$SED_EXPR" "$SCRIPT")
for f in $FUNCS; do
    declare -F "$f" >/dev/null || { echo "function $f not found in $SCRIPT"; exit 1; }
done

client_port_in_use() { return 1; }  # local tunnel ports are free (tested in test_client_security.sh)
print_status() { :; }
print_success() { :; }
print_warning() { echo "WARN: $*" >>"$TMP/out"; }
print_error() { echo "ERR: $*" >>"$TMP/out"; }

failures=0
check() {  # check <description> <expected> <actual>
    if [ "$2" = "$3" ]; then
        echo "ok   - $1"
    else
        echo "FAIL - $1 (expected '$2', got '$3')"
        failures=$((failures + 1))
    fi
}

# --- CLIENTS -------------------------------------------------------------------------------
FIO_SERVER_PORT=8765 FIO_SERVER_INFO_PORT=""
parse_clients "10.44.44.101,10.44.44.102:9000, node3.lan ,[fd00::5]:8770,10.0.0.9:9100:9200"; rc=$?
check "valid CLIENTS list parses" 0 "$rc"
check "client count" 5 "${#CLIENT_ADDR[@]}"
check "addresses" "10.44.44.101 10.44.44.102 node3.lan fd00::5 10.0.0.9" "${CLIENT_ADDR[*]}"
check "fio ports (default FIO_SERVER_PORT)" "8765 9000 8765 8770 9100" "${CLIENT_PORT[*]}"
check "info ports (default fio port + 1)" "8766 9001 8766 8771 9200" "${CLIENT_INFO_PORT[*]}"
check "entries kept for client_name" "10.44.44.101 10.44.44.102:9000 node3.lan [fd00::5]:8770 10.0.0.9:9100:9200" "${CLIENT_ENTRY[*]}"

FIO_SERVER_INFO_PORT=8800
parse_clients "a1,a2:9000"
check "explicit FIO_SERVER_INFO_PORT applies to all clients" "8800 8800" "${CLIENT_INFO_PORT[*]}"
FIO_SERVER_INFO_PORT=""

for bad in "" "a,,b" "a:0" "a:70000" "a:x" "a b" "a;b" "a,a" "fd00::1" "[fd00::1" "-oProxyCommand=x" "a:8765:8765"; do
    parse_clients "$bad" 2>/dev/null; rc=$?
    check "invalid CLIENTS '$bad' rejected" 1 "$rc"
done

# --- RAMP_CLIENTS --------------------------------------------------------------------------
parse_ramp_clients "" 10; check "empty ramp: ok" 0 "$?"
check "empty ramp: one step with all clients" "10" "${RAMP_STEPS[*]}"
parse_ramp_clients "1,2,4,6,8,10" 10; check "ascending ramp: ok" 0 "$?"
check "ascending ramp steps" "1 2 4 6 8 10" "${RAMP_STEPS[*]}"
parse_ramp_clients " 1, 3 " 3; check "spaces trimmed" "1 3" "${RAMP_STEPS[*]}"
for bad in "2,1" "1,1" "0,1" "1,11" "1,x" "1,,2" ","; do
    parse_ramp_clients "$bad" 10 2>/dev/null; rc=$?
    check "invalid RAMP_CLIENTS '$bad' rejected" 1 "$rc"
done

# --- validate_client_config ----------------------------------------------------------------
setup_valid() {
    : >"$TMP/out"
    CLIENTS="10.0.0.1,10.0.0.2" RAMP_CLIENTS="1,2" SATURATION_MODE=false CLIENT_SSH=0
    CLIENT_SSH_USER="" CLIENT_SSH_BASE_PORT=18765 CLIENT_IOENGINE=libaio
    CLIENT_TARGET_IS_DEVICE=auto TARGET_DIR=/mnt/fio PREFILL=0 FILE_PER_JOB=0
}
setup_valid; validate_client_config; check "valid client config" 0 "$?"
check "directory target" false "$TARGET_IS_DEVICE"
setup_valid; SATURATION_MODE=true RAMP_CLIENTS=""; validate_client_config; rc=$?
check "saturation + clients is accepted" 0 "$rc"
check "saturation + clients: no error" 0 "$(grep -c '^ERR' "$TMP/out")"
check "saturation + clients: one step with all clients" 2 "${RAMP_STEPS[*]}"
setup_valid; SATURATION_MODE=true RAMP_CLIENTS=" "; validate_client_config
check "saturation + blank RAMP_CLIENTS is accepted" 0 "$?"
setup_valid; SATURATION_MODE=true; validate_client_config; rc=$?
check "saturation + RAMP_CLIENTS is an error" 1 "$rc"
check "saturation + RAMP_CLIENTS error explains" 1 "$(grep -c 'RAMP_CLIENTS.*SATURATION_MODE' "$TMP/out")"
setup_valid; SATURATION_MODE=true RAMP_CLIENTS="" SAT_BLOCK_SIZES=$'4k\nexec_prerun=id'
validate_client_config; check "SAT_BLOCK_SIZES with newline rejected" 1 "$?"
unset SAT_BLOCK_SIZES
setup_valid; TARGET_DIR=/dev/disk/by-id/scsi-0QEMU_QEMU_HARDDISK_drive-scsi1; PREFILL=1 FILE_PER_JOB=1
validate_client_config; check "device target ok" 0 "$?"
check "auto: /dev/ path is a device" true "$TARGET_IS_DEVICE"
check "device: PREFILL disabled" 0 "$PREFILL"
check "device: FILE_PER_JOB disabled" 0 "$FILE_PER_JOB"
setup_valid; CLIENT_TARGET_IS_DEVICE=1 TARGET_DIR=/srv/raw
validate_client_config; check "forced device" true "$TARGET_IS_DEVICE"
setup_valid; CLIENT_TARGET_IS_DEVICE=0 TARGET_DIR=/dev/shm/fio
validate_client_config; check "forced directory" false "$TARGET_IS_DEVICE"
setup_valid; CLIENT_TARGET_IS_DEVICE=maybe
validate_client_config; check "invalid CLIENT_TARGET_IS_DEVICE rejected" 1 "$?"
setup_valid; TARGET_DIR=./fio_tmp/
validate_client_config; check "relative TARGET_DIR rejected" 1 "$?"
setup_valid; TARGET_DIR=$'/mnt/x\nexec_prerun=touch /tmp/pwned'
validate_client_config; check "TARGET_DIR with newline rejected" 1 "$?"
setup_valid; CLIENT_IOENGINE=$'libaio\nexec_prerun=id'
validate_client_config; check "CLIENT_IOENGINE with newline rejected" 1 "$?"
setup_valid; CLIENT_SSH=yes
validate_client_config; check "CLIENT_SSH must be 0/1" 1 "$?"
setup_valid; CLIENT_SSH_BASE_PORT=65534 CLIENT_SSH=1
validate_client_config; check "tunnel ports beyond 65535 rejected" 1 "$?"
setup_valid; CLIENT_SSH_USER='-oProxyCommand=x' CLIENT_SSH=1
validate_client_config; check "hostile CLIENT_SSH_USER rejected" 1 "$?"
setup_valid; RAMP_CLIENTS="1,3"
validate_client_config; check "ramp step above client count rejected" 1 "$?"

# --- connections without SSH ---------------------------------------------------------------
setup_valid
validate_client_config
client_setup_connections
check "direct: connection hosts" "10.0.0.1 10.0.0.2" "${CLIENT_CONN_HOST[*]}"
check "direct: connection ports" "8765 8765" "${CLIENT_CONN_PORT[*]}"
check "direct: info ports" "8766 8766" "${CLIENT_CONN_INFO_PORT[*]}"
client_fio_args 1
check "fio args for the first client" "--client=ip:10.0.0.1,8765 --output-format=json" "${CLIENT_FIO_ARGS[*]}"
client_fio_args 2
check "fio args for two clients" "--client=ip:10.0.0.1,8765 --output-format=json --client=ip:10.0.0.2,8765 --output-format=json" "${CLIENT_FIO_ARGS[*]}"
check "client keys (host:port as fio reports)" "10.0.0.1:8765 10.0.0.2:8765" "${CLIENT_KEY[*]}"

# --- SSH tunnels ---------------------------------------------------------------------------
setup_valid
CLIENTS="node1,10.0.0.2:9000" CLIENT_SSH=1 CLIENT_SSH_USER=bench
validate_client_config
client_ssh_command 0 18765 18766
check "ssh command line (user@host)" \
    "ssh -N -o ExitOnForwardFailure=yes -o BatchMode=yes -L 18765:127.0.0.1:8765 -L 18766:127.0.0.1:8766 -- bench@node1" \
    "${SSH_CMD[*]}"
CLIENT_SSH_USER=""
client_ssh_command 1 18767 18768
check "ssh command line (no user, custom ports)" \
    "ssh -N -o ExitOnForwardFailure=yes -o BatchMode=yes -L 18767:127.0.0.1:9000 -L 18768:127.0.0.1:9001 -- 10.0.0.2" \
    "${SSH_CMD[*]}"

# tunnels are started in the background; their PIDs are recorded and closed again
: >"$TMP/ssh_calls"
ssh() { echo "ssh $*" >>"$TMP/ssh_calls"; exec sleep 30; }  # exec: the recorded PID is sleep
client_wait_port() { return 0; }
CLIENT_SSH_USER=bench
client_setup_connections; rc=$?
check "tunnels start" 0 "$rc"
check "one ssh per client" 2 "$(grep -c '^ssh ' "$TMP/ssh_calls")"
check "tunnel pids recorded" 2 "${#CLIENT_SSH_PIDS[@]}"
check "tunnel: connection hosts are local" "127.0.0.1 127.0.0.1" "${CLIENT_CONN_HOST[*]}"
check "tunnel: local fio ports from CLIENT_SSH_BASE_PORT" "18765 18767" "${CLIENT_CONN_PORT[*]}"
check "tunnel: local info ports" "18766 18768" "${CLIENT_CONN_INFO_PORT[*]}"
client_fio_args 2
check "tunnel: fio talks to the local ports" "--client=ip:127.0.0.1,18765 --output-format=json --client=ip:127.0.0.1,18767 --output-format=json" "${CLIENT_FIO_ARGS[*]}"
check "tunnel: client keys" "127.0.0.1:18765 127.0.0.1:18767" "${CLIENT_KEY[*]}"
pids=("${CLIENT_SSH_PIDS[@]}")
client_close_tunnels
sleep 0.2
alive=0
for p in "${pids[@]}"; do if kill -0 "$p" 2>/dev/null; then alive=$((alive + 1)); fi; done
check "tunnels closed" 0 "$alive"
check "tunnel pid list cleared" 0 "${#CLIENT_SSH_PIDS[@]}"

# a tunnel that does not come up is an error
client_wait_port() { return 1; }
client_setup_connections 2>/dev/null; rc=$?
check "failed tunnel is an error" 1 "$rc"
client_close_tunnels

if [ "$failures" -gt 0 ]; then
    echo "$failures test(s) failed"
    exit 1
fi
echo "all tests passed"
