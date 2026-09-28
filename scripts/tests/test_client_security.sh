#!/usr/bin/env bash
# Security tests for the controller side of fio-test.sh (run: bash scripts/tests/test_client_security.sh)
# Credentials out of argv, backend response filtering, the client-mode trust warning, fio
# running inside the private work dir, SSH tunnel port checks, client info fetch limits,
# job file restrictions and strict step completeness.

# shellcheck disable=SC2034,SC2329  # config vars and stubs are used by the sourced functions

set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$DIR/../fio-test.sh"
TWO="$DIR/fixtures/fio_client_2clients.json"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

FUNCS="curl_auth_config upload_results check_credentials warn_default_credentials
print_client_security_warning valid_port parse_clients parse_ramp_clients validate_client_config
client_ssh_command client_setup_connections client_close_tunnels client_sanitize_name
client_valid_json_object client_fetch_info client_extra_args_ini client_step_label
client_step_complete transient_fio_error_line is_transient_fio_error run_fio_with_retry
sanitize_fio_json fio_server_address client_fio_args client_output_messages client_run_step"
SED_EXPR=""
for f in $FUNCS; do SED_EXPR+="/^${f}()/,/^}/p;"; done
# shellcheck source=/dev/null
source <(sed -n "$SED_EXPR" "$SCRIPT")
for f in $FUNCS; do
    declare -F "$f" >/dev/null || { echo "function $f not found in $SCRIPT"; exit 1; }
done

print_status() { :; }
print_success() { :; }
print_error() { echo "ERR: $*" >>"$TMP/warnings"; }
print_warning() { echo "WARN: $*" >>"$TMP/warnings"; }

failures=0
check() {  # check <description> <expected> <actual>
    if [ "$2" = "$3" ]; then
        echo "ok   - $1"
    else
        echo "FAIL - $1 (expected '$2', got '$3')"
        failures=$((failures + 1))
    fi
}

# --- 6. credentials never on the command line ------------------------------------------------
# curl stub: argv to $TMP/args (one per line), the -K config file content to $TMP/config
CURL_REPLY='{"message":"ok"}200'
curl() {
    local prev=""
    printf '%s\n' "$@" >>"$TMP/args"
    for arg in "$@"; do
        if [ "$prev" = -K ]; then cat "$arg" >>"$TMP/config"; fi
        prev=$arg
    done
    printf '%s' "$CURL_REPLY"
}
USERNAME='bench' PASSWORD='s3cr"et\pa&ss' HOSTNAME=h PROTOCOL=p DRIVE_TYPE=t DRIVE_MODEL=m
DESCRIPTION=d CONFIG_UUID=c RUN_UUID=r BACKEND_URL=http://x SATURATION_MODE=false STORAGE_INFO=''
: >"$TMP/args" && : >"$TMP/config"
upload_results "$TMP/r.json" t >"$TMP/stdout" 2>&1
check "upload: password not in argv" 0 "$(grep -c 's3cr' "$TMP/args")"
check "upload: no -u option" 0 "$(grep -cx -- '-u' "$TMP/args")"
check "upload: credentials via -K config" 1 "$(grep -cx -- '-K' "$TMP/args")"
check "config line with escaped \" and \\" 'user = "bench:s3cr\"et\\pa&ss"' "$(cat "$TMP/config")"
: >"$TMP/args" && : >"$TMP/config"
CURL_REPLY='405'
check_credentials >/dev/null 2>&1
check "check_credentials: password not in argv" 0 "$(grep -c 's3cr' "$TMP/args")"
check "check_credentials: credentials via -K" 1 "$(grep -c 'bench:' "$TMP/config")"
PASSWORD=$'a\nb\rc'
check "newlines stripped from the config value" 'user = "bench:abc"' "$(curl_auth_config)"

# default credentials: one warning
: >"$TMP/warnings"
USERNAME=uploader PASSWORD=uploader DEFAULT_CRED_WARNED=false
warn_default_credentials
warn_default_credentials
check "default uploader/uploader warned once" 1 "$(grep -c 'uploader/uploader' "$TMP/warnings")"
: >"$TMP/warnings"
USERNAME=bench PASSWORD=x DEFAULT_CRED_WARNED=false
warn_default_credentials
check "custom credentials: no warning" 0 "$(grep -c . "$TMP/warnings")"

# backend response is printed without control characters
USERNAME=u PASSWORD=p
CURL_REPLY=$'\e[31mEVIL\e]0;title\a{"message":"ok"}200'
upload_results "$TMP/r.json" t >"$TMP/stdout" 2>&1
check "response: escape sequences removed" 0 "$(grep -c $'\e' "$TMP/stdout")"
check "response: text kept" 1 "$(grep -c 'EVIL' "$TMP/stdout")"

# --- 3. client-mode trust warning -------------------------------------------------------------
: >"$TMP/warnings"
CLIENT_SSH=0
print_client_security_warning
check "CLIENT_SSH=0: warns about missing authentication" 1 "$(grep -c 'no authentication' "$TMP/warnings")"
check "CLIENT_SSH=0: suggests CLIENT_SSH=1" 1 "$(grep -c 'CLIENT_SSH=1' "$TMP/warnings")"
check "CLIENT_SSH=0: unprivileged user hint" 1 "$(grep -c 'unprivileged' "$TMP/warnings")"
: >"$TMP/warnings"
CLIENT_SSH=1
print_client_security_warning
check "CLIENT_SSH=1: no warning" 0 "$(grep -c . "$TMP/warnings")"

# --- 3b. fio runs inside the private work dir --------------------------------------------------
fio() {
    local out=""
    for arg in "$@"; do case "$arg" in --output=*) out=${arg#--output=} ;; esac; done
    pwd >"$TMP/fio_pwd"
    cp "$TWO" "$out"
}
CLIENT_WORK_DIR="$TMP/work" FIO_RETRY_MAX=0 FIO_RETRY_COUNT=0
mkdir -p "$CLIENT_WORK_DIR"
CLIENT_CONN_HOST=(127.0.0.1 127.0.0.1) CLIENT_CONN_PORT=(18801 18802)
CLIENT_KEY=(127.0.0.1:18801 127.0.0.1:18802)
before=$PWD
client_run_step 2 "$TMP/job.fio" "$CLIENT_WORK_DIR/out.json" step
check "fio started in CLIENT_WORK_DIR" "$(cd "$CLIENT_WORK_DIR" && pwd -P)" "$(cd "$(cat "$TMP/fio_pwd")" && pwd -P)"
check "caller's directory restored" "$before" "$PWD"

# --- 7. SSH tunnels: local ports must be free, ssh must still run after the port answers ------
FIO_SERVER_PORT=8765 FIO_SERVER_INFO_PORT="" CLIENTS="10.0.0.1,10.0.0.2" RAMP_CLIENTS=""
SATURATION_MODE=false CLIENT_SSH=1 CLIENT_SSH_USER="" CLIENT_SSH_BASE_PORT=18765
CLIENT_IOENGINE=libaio CLIENT_TARGET_IS_DEVICE=auto TARGET_DIR=/mnt/fio PREFILL=0 FILE_PER_JOB=0
validate_client_config
: >"$TMP/ssh_calls"
ssh() { echo "ssh $*" >>"$TMP/ssh_calls"; exec sleep 30; }
client_port_in_use() { [ "$1" = 18768 ]; }  # 2nd client's info port is taken
client_wait_port() { return 0; }
client_setup_connections 2>/dev/null; rc=$?
check "busy local port: error" 1 "$rc"
check "busy local port: no ssh started" 0 "$(grep -c . "$TMP/ssh_calls")"
client_close_tunnels
client_port_in_use() { return 1; }
ssh() { echo "ssh $*" >>"$TMP/ssh_calls"; }  # exits at once (forward failed)
client_setup_connections 2>/dev/null; rc=$?
check "ssh gone after the port answered: error" 1 "$rc"
client_close_tunnels

# --- 8. client info fetch limits ----------------------------------------------------------------
: >"$TMP/args"
curl() { echo "$*" >>"$TMP/args"; return 7; }
CLIENT_ENTRY=(10.0.0.1) CLIENT_ADDR=(10.0.0.1) CLIENT_CONN_HOST=(10.0.0.1) CLIENT_CONN_INFO_PORT=(8766)
client_fetch_info 2>/dev/null
check "both fetches bypass proxies" 2 "$(grep -c -- "--noproxy \*" "$TMP/args")"
check "hostname.txt limited to 256 bytes" 1 "$(grep -- 'hostname.txt' "$TMP/args" | grep -c -- '--max-filesize 256 ')"
check "storage.json limited to 64 KiB" 1 "$(grep -- 'storage.json' "$TMP/args" | grep -c -- '--max-filesize 65536 ')"

# --- 9. job file restrictions -------------------------------------------------------------------
: >"$TMP/warnings"
FIO_EXTRA_ARGS_ARR=(--exec_prerun=id --exec_postrun=id --exec_prerun_x --ioengine=external:/tmp/x.so --refill_buffers)
check "exec_* and external engines never reach the job file" "refill_buffers" "$(client_extra_args_ini 2>/dev/null)"
check "each skipped option is warned about" 4 "$(grep -c 'FIO_EXTRA_ARGS' "$TMP/warnings")"
FIO_EXTRA_ARGS_ARR=()
CLIENT_SSH=0 CLIENT_IOENGINE=external:/tmp/evil.so
validate_client_config 2>/dev/null; check "CLIENT_IOENGINE external:... refused" 1 "$?"
CLIENT_IOENGINE=libaio
check "step label restricted to [A-Za-z0-9_.+-]" "rand..read_4krm-rf_1_1_4M_1_1_1_clients2" \
    "$(client_step_label 2 'rand/../read' '4k;rm -rf' 1 1 4M 1 1 1)"

# --- 10. step completeness: exactly one clean entry per client -----------------------------------
CLIENT_KEY=(127.0.0.1:18801 127.0.0.1:18802)
client_step_complete "$TWO" 2; check "fixture complete" 0 "$?"
jq '.client_stats += [.client_stats[0]]' "$TWO" >"$TMP/dup.json"
client_step_complete "$TMP/dup.json" 2; check "duplicate client entry: incomplete" 1 "$?"
jq '.client_stats[2].hostname = "127.0.0.1\u001b[31m"' "$TWO" >"$TMP/ctl.json"
client_step_complete "$TMP/ctl.json" 2; check "control characters in a hostname: incomplete" 1 "$?"

if [ "$failures" -gt 0 ]; then
    echo "$failures test(s) failed"
    exit 1
fi
echo "all tests passed"
