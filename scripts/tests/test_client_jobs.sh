#!/usr/bin/env bash
# Tests for the fio job files written in client mode (run: bash scripts/tests/test_client_jobs.sh)
# Benchmark job (directory / device / file per job), FIO_EXTRA_ARGS conversion, the
# one-time prefill job and the cleanup job that removes the data files on the clients.

# shellcheck disable=SC2034,SC2329  # config vars and stubs are used by the sourced functions

set -u
SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/fio-test.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

FUNCS="data_file_base client_job_target_lines client_extra_args_ini client_job_name
client_write_job_file client_write_prefill_job client_write_cleanup_job"
SED_EXPR=""
for f in $FUNCS; do SED_EXPR+="/^${f}()/,/^}/p;"; done
# shellcheck source=/dev/null
source <(sed -n "$SED_EXPR" "$SCRIPT")
for f in $FUNCS; do
    declare -F "$f" >/dev/null || { echo "function $f not found in $SCRIPT"; exit 1; }
done

print_status() { :; }
print_warning() { echo "WARN: $*" >>"$TMP/warnings"; }
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
has_line() { grep -cxF -- "$2" "$1"; }  # has_line <file> <exact line> -> count

HOSTNAME=px1-vms PROTOCOL=local DRIVE_TYPE=vm-ssd DRIVE_MODEL='pool[1]-syncoff' DESCRIPTION="clients:2,run_uuid:r"
CLIENT_IOENGINE=libaio TARGET_DIR=/mnt/fio TARGET_IS_DEVICE=false PREFILL=0 FILE_PER_JOB=0
FIO_EXTRA_ARGS_ARR=()

# --- directory target, shared file -----------------------------------------------------------
J="$TMP/dir.fio"
client_write_job_file "$J" randread 4k 2 1 4M sync 8 5 fio_test_randread_4k
check "global section first" "[global]" "$(head -n 1 "$J")"
for line in ioengine=libaio direct=1 sync=sync bs=4k rw=randread iodepth=8 size=4M runtime=5 \
    time_based group_reporting norandommap randrepeat=0 thread numjobs=2 \
    filename=/mnt/fio/fio_test_randread_4k unlink=1; do
    check "dir job has '$line'" 1 "$(has_line "$J" "$line")"
done
check "job section name without brackets from DRIVE_MODEL" 1 \
    "$(has_line "$J" "[hostname:px1-vms,protocol:local,drivetype:vm-ssd,drivemodel:pool1-syncoff]")"
check "description in job" 1 "$(has_line "$J" "description=clients:2,run_uuid:r")"
check "no directory= for a shared file" 0 "$(grep -c '^directory=' "$J")"

# --- directory target, file per job ----------------------------------------------------------
FILE_PER_JOB=1
client_write_job_file "$J" write 64k 4 1 8M none 1 5 fio_test_write_64k
check "file per job: directory" 1 "$(has_line "$J" "directory=/mnt/fio")"
# shellcheck disable=SC2016  # literal $ on purpose
check "file per job: literal \$jobnum" 1 "$(has_line "$J" 'filename_format=fio_test_write_64k.$jobnum')"
check "file per job: no filename=" 0 "$(grep -c '^filename=' "$J")"
FILE_PER_JOB=0

# --- PREFILL keeps the files (no unlink) -------------------------------------------------------
PREFILL=1
client_write_job_file "$J" randread 4k 1 1 4M sync 1 5 "$(data_file_base fio_test_randread_4k 4M)"
check "prefill: stable data file" 1 "$(has_line "$J" "filename=/mnt/fio/fio_data_4M")"
check "prefill: files kept (no unlink)" 0 "$(grep -c '^unlink=' "$J")"
PREFILL=0

# --- block device --------------------------------------------------------------------------------
TARGET_DIR=/dev/disk/by-id/scsi-0QEMU_QEMU_HARDDISK_drive-scsi1 TARGET_IS_DEVICE=true
client_write_job_file "$J" randwrite 4k 1 1 4M sync 1 5 fio_test_randwrite_4k
check "device: filename is the device" 1 "$(has_line "$J" "filename=$TARGET_DIR")"
check "device: never unlink" 0 "$(grep -c '^unlink=' "$J")"
TARGET_DIR=/mnt/fio TARGET_IS_DEVICE=false

# --- FIO_EXTRA_ARGS -------------------------------------------------------------------------------
: >"$TMP/warnings"
FIO_EXTRA_ARGS_ARR=(--buffer_compress_percentage=50 --refill_buffers --output=/tmp/x bogus --client=evil)
client_write_job_file "$J" read 1M 1 1 4M sync 1 5 fio_test_read_1M
check "--key=value becomes key=value" 1 "$(has_line "$J" "buffer_compress_percentage=50")"
check "--flag becomes flag" 1 "$(has_line "$J" "refill_buffers")"
check "CLI-only --output is skipped" 0 "$(grep -c '^output' "$J")"
check "CLI-only --client is skipped" 0 "$(grep -c '^client' "$J")"
check "non-option word is skipped" 0 "$(grep -c '^bogus' "$J")"
check "skipped extra args are warned about" 3 "$(grep -c 'FIO_EXTRA_ARGS' "$TMP/warnings")"
FIO_EXTRA_ARGS_ARR=()

# --- prefill job (all clients, once) -------------------------------------------------------------
P="$TMP/prefill.fio"
client_write_prefill_job "$P" fio_data_4M 4M 1 1
for line in rw=write bs=1M size=4M refill_buffers randrepeat=0 end_fsync=1 ioengine=libaio direct=1 \
    "[prefill]" filename=/mnt/fio/fio_data_4M; do
    check "prefill job has '$line'" 1 "$(has_line "$P" "$line")"
done
FILE_PER_JOB=1
client_write_prefill_job "$P" fio_data_4M 4M 3 1
check "prefill per job: one section per file" 3 "$(grep -c '^\[prefill_[0-9]\]$' "$P")"
check "prefill per job: last file" 1 "$(has_line "$P" "filename=/mnt/fio/fio_data_4M.2")"
check "prefill never unlinks" 0 "$(grep -c '^unlink=' "$P")"

# --- cleanup job ---------------------------------------------------------------------------------
C="$TMP/cleanup.fio"
client_write_cleanup_job "$C" fio_data_4M 4M 3
check "cleanup job unlinks" 1 "$(has_line "$C" "unlink=1")"
check "cleanup job reads only a little" 1 "$(has_line "$C" "io_size=4k")"
check "cleanup job covers every file" 3 "$(grep -c '^filename=/mnt/fio/fio_data_4M\.[0-2]$' "$C")"
FILE_PER_JOB=0
client_write_cleanup_job "$C" fio_data_4M 4M 3
check "cleanup job, shared file" 1 "$(has_line "$C" "filename=/mnt/fio/fio_data_4M")"

if [ "$failures" -gt 0 ]; then
    echo "$failures test(s) failed"
    exit 1
fi
echo "all tests passed"
