#!/usr/bin/env bash
# Tests for build_description in fio-test.sh (run: bash scripts/tests/test_description.sh)
# Sanitizing turns spaces into '_' and drops special characters, but keeps dots
# (versions like v1.2 in the user text, FQDN hostnames in the hostname: tag).

# shellcheck disable=SC2034,SC2329  # config vars and stubs are used by the sourced function

set -u
SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/fio-test.sh"

# shellcheck source=/dev/null
source <(sed -n '/^build_description()/,/^}/p' "$SCRIPT")
declare -F build_description >/dev/null || { echo "build_description not found in $SCRIPT"; exit 1; }

sat_cap_active() { return 1; }

failures=0
check() {  # check <description> <expected> <actual>
    if [ "$2" = "$3" ]; then
        echo "ok   - $1"
    else
        echo "FAIL - $1 (expected '$2', got '$3')"
        failures=$((failures + 1))
    fi
}
# element <name>: value of the "<name>:" element of DESCRIPTION ("" = the first element)
element() {
    local IFS=, e
    for e in $DESCRIPTION; do
        if [ -z "$1" ]; then printf '%s' "$e"; return; fi
        case $e in "$1":*) printf '%s' "${e#"$1":}"; return ;; esac
    done
}

SATURATION_MODE=false PREFILL=0 FILE_PER_JOB=0 CLIENT_MODE=false
HOSTNAME=srv.example.com PROTOCOL=NFS DRIVE_TYPE=ssd DRIVE_MODEL=pool.syncoff
CONFIG_UUID=c1 RUN_UUID=r1
BASE_DESCRIPTION="release v1.2 \$HOME 'q'"
build_description

check "user text keeps dots, spaces become _, \$ and ' are removed" "release_v1.2_HOME_q" "$(element "")"
check "FQDN hostname keeps its dots" "srv.example.com" "$(element hostname)"
check "drive model keeps its dots" "pool.syncoff" "$(element drivemodel)"
check "protocol tag is intact" "NFS" "$(element protocol)"
check "only allowed characters remain" "" "$(printf '%s' "$DESCRIPTION" | tr -d -- '-a-zA-Z0-9_.,;:')"

SATURATION_MODE=true BASE_DESCRIPTION="fw 2.0.1"
build_description
check "saturation keeps dots in user text" 1 \
    "$(printf '%s\n' "$DESCRIPTION" | grep -c '^saturation-test,fw_2\.0\.1,hostname:srv\.example\.com,')"

if [ "$failures" -gt 0 ]; then
    echo "$failures test(s) failed"
    exit 1
fi
echo "all tests passed"
