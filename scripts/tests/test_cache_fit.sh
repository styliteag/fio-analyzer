#!/usr/bin/env bash
# Tests for the cache fit check of fio-test.sh (run: bash scripts/tests/test_cache_fit.sh):
# RAM / ZFS ARC detection (mem_total, arc_max in STORAGE_INFO), STORAGE_CACHE_BYTES,
# the working set per test (shared file, file per job, block device, clients) and the
# per-test description tag cachefit:1 in standard, saturation and client mode.
# Setup, stubs and fixtures: storage_test_lib.bash (/proc files below SI_SYS_ROOT).

# shellcheck disable=SC2016,SC2034,SC2329  # literal $(...) on purpose; config vars and stubs are used by the sourced functions

# shellcheck source=storage_test_lib.bash
source "$(dirname "$0")/storage_test_lib.bash"

EXTRA_FUNCS="build_description apply_cachefit_tag sat_cap_active sat_step_size bytes_to_mib_size
validate_storage_cache test_working_set_bytes cache_mul host_cache_bytes cache_fit_check
client_cache_info client_cache_fit_check cache_fit_text cache_fit_apply show_cache_fit_warning
cache_in_vm cache_summary run_all_tests run_fio_step data_file_base sat_drop_stale_prefill
build_fio_target_args prefill_test_files remove_test_files cache_size_bytes"
SED_EXPR=""
for f in $EXTRA_FUNCS; do SED_EXPR+="/^${f}()/,/^}/p;"; done
# shellcheck source=/dev/null
source <(sed -n "$SED_EXPR" "$SCRIPT")
for f in $EXTRA_FUNCS; do
    declare -F "$f" >/dev/null || { echo "function $f not found in $SCRIPT"; exit 1; }
done

print_step() { :; }
sanitize_fio_json() { return 0; }
keep_json_copy() { return 0; }

G=1073741824
PROC="$SI_SYS_ROOT/proc"
write_meminfo() { mkdir -p "$PROC"; printf 'MemTotal:       %s kB\nMemFree:         1000 kB\n' "$1" >"$PROC/meminfo"; }
write_arcstats() {
    mkdir -p "$PROC/spl/kstat/zfs"
    printf '13 1 0x01 123 33456 1234 5678\nname                            type data\nc                               4    1000\nc_max                           4    %s\nsize                            4    500\n' \
        "$1" >"$PROC/spl/kstat/zfs/arcstats"
}

# --- storage_cache_sizes / STORAGE_INFO ---------------------------------------------------
reset_stubs
rm -rf "$PROC"
storage_cache_sizes
check "no /proc files: mem_total unknown" "" "$SI_MEM_TOTAL"
check "no /proc files: arc_max unknown" "" "$SI_ARC_MAX"

write_meminfo 16384000
storage_cache_sizes
check "MemTotal kB -> bytes" 16777216000 "$SI_MEM_TOTAL"
check "no arcstats: arc_max unknown" "" "$SI_ARC_MAX"

write_arcstats 8589934592
storage_cache_sizes
check "arcstats c_max" 8589934592 "$SI_ARC_MAX"

printf 'MemTotal:       $(id) kB\n' >"$PROC/meminfo"
write_arcstats '1e9'
storage_cache_sizes
check "non-numeric MemTotal ignored" "" "$SI_MEM_TOTAL"
check "non-numeric c_max ignored" "" "$SI_ARC_MAX"
printf 'MemTotal:       1024 MB\n' >"$PROC/meminfo"
write_arcstats 99999999999999999999999
storage_cache_sizes
check "MemTotal in an unknown unit ignored" "" "$SI_MEM_TOTAL"
check "absurd c_max ignored" "" "$SI_ARC_MAX"

write_meminfo 16384000
write_arcstats 8589934592
reset_stubs
FINDMNT_OUT="zfs    tank/fio" ZFS_LIST_DIR="tank/fio" ZFS_PROPS="$ZFS_FS_PROPS" ZPOOL_STATUS="$ZPOOL_MIRROR"
detect_storage
check "STORAGE_INFO valid JSON with cache sizes" ok "$(valid_json "$STORAGE_INFO")"
check "STORAGE_INFO mem_total is a number" "16777216000 int" \
    "$(json_get "$STORAGE_INFO" '["mem_total"], type(json.loads(sys.argv[1])["mem_total"]).__name__')"
check "STORAGE_INFO arc_max is a number" "8589934592 int" \
    "$(json_get "$STORAGE_INFO" '["arc_max"], type(json.loads(sys.argv[1])["arc_max"]).__name__')"
check "summary shows ram and arc_max" 2 "$(storage_summary | grep -oE 'ram=15.6G|arc_max=8.0G' | wc -l | tr -d ' ')"

STORAGE_DETECT=0
detect_storage
check "STORAGE_DETECT=0: no STORAGE_INFO" "" "$STORAGE_INFO"
check "STORAGE_DETECT=0: RAM still known for the cache check" 16777216000 "$SI_MEM_TOTAL"
STORAGE_DETECT=1

# Over 4 KB: the minimal fallback keeps the cache sizes
reset_stubs
FINDMNT_OUT="zfs tank/fio" ZFS_LIST_DIR="tank/fio" ZFS_PROPS="$ZFS_FS_PROPS"
FIO_VER="fio-$(printf 'x%.0s' {1..4200})"
detect_storage
check "4 KB fallback keeps mem_total" 16777216000 "$(json_get "$STORAGE_INFO" '["mem_total"]')"
check "4 KB fallback keeps arc_max" 8589934592 "$(json_get "$STORAGE_INFO" '["arc_max"]')"

# --- STORAGE_CACHE_BYTES --------------------------------------------------------------------
: >"$TMP/warnings"
STORAGE_CACHE_BYTES=64G; validate_storage_cache
check "64G parsed" $((64 * G)) "$STORAGE_CACHE_BYTES_N"
STORAGE_CACHE_BYTES=512m; validate_storage_cache
check "512m parsed" 536870912 "$STORAGE_CACHE_BYTES_N"
STORAGE_CACHE_BYTES=1TiB; validate_storage_cache
check "1TiB parsed" 1099511627776 "$STORAGE_CACHE_BYTES_N"
STORAGE_CACHE_BYTES=""; validate_storage_cache
check "empty = not set" "" "$STORAGE_CACHE_BYTES_N"
STORAGE_CACHE_BYTES=0; validate_storage_cache
check "0 = not set" "" "$STORAGE_CACHE_BYTES_N"
check "empty and 0: no warning" 0 "$(warn_count STORAGE_CACHE_BYTES)"
STORAGE_CACHE_BYTES=lots; validate_storage_cache
check "invalid value ignored" "" "$STORAGE_CACHE_BYTES_N"
check "invalid value cleared" "" "$STORAGE_CACHE_BYTES"
check "invalid value warns" 1 "$(warn_count STORAGE_CACHE_BYTES)"
STORAGE_CACHE_BYTES=1.5G; validate_storage_cache
check "fraction ignored" "" "$STORAGE_CACHE_BYTES_N"
STORAGE_CACHE_BYTES=99999999999999P; validate_storage_cache
check "overflowing size ignored" "" "$STORAGE_CACHE_BYTES_N"
STORAGE_CACHE_BYTES='$(id)'; validate_storage_cache
check "command text ignored" "" "$STORAGE_CACHE_BYTES_N"
STORAGE_CACHE_BYTES=1024P; validate_storage_cache
check "1 EiB and more ignored" "" "$STORAGE_CACHE_BYTES_N"
STORAGE_CACHE_BYTES=0G; validate_storage_cache
check "0G ignored" "" "$STORAGE_CACHE_BYTES_N"
STORAGE_CACHE_BYTES=064G; validate_storage_cache
check "leading zero is decimal, not octal" $((64 * G)) "$STORAGE_CACHE_BYTES_N"

# --- working set ------------------------------------------------------------------------------
TARGET_IS_DEVICE=false FILE_PER_JOB=0
check "shared file: size only" $((10 * G)) "$(test_working_set_bytes 10G 4)"
FILE_PER_JOB=1
check "file per job: size x numjobs" $((40 * G)) "$(test_working_set_bytes 10G 4)"
TARGET_IS_DEVICE=true
check "block device: first <size> bytes for all jobs" $((10 * G)) "$(test_working_set_bytes 10G 4)"
TARGET_IS_DEVICE=false
test_working_set_bytes 10X 4 >/dev/null; check "invalid size: no working set" 1 "$?"
test_working_set_bytes 10G 'x' >/dev/null; check "invalid numjobs: no working set" 1 "$?"
check "huge product is capped, no overflow" 4611686018427387904 "$(test_working_set_bytes 1000P 64)"

# --- cache_fit_check (this host) -------------------------------------------------------------
SI_MEM_TOTAL=$((16 * G)) SI_ARC_MAX=$((8 * G)) SI_ZFS_DATASET="" SI_ZFS_PRIMARYCACHE=""
STORAGE_CACHE_BYTES_N="" FILE_PER_JOB=0
cache_fit_check 1G 4 1
check "direct=1, not on ZFS: RAM does not count" 0 "$CACHE_FIT"
cache_fit_check 1G 4 0
check "direct=0: 1G fits into 16G RAM" 1 "$CACHE_FIT"
check "direct=0: source is the page cache" "page cache (RAM, direct=0)" "$CACHE_SOURCE"
cache_fit_check 32G 4 0
check "direct=0: 32G does not fit into 16G RAM" 0 "$CACHE_FIT"
FILE_PER_JOB=1
cache_fit_check 4G 4 0
check "file per job: 4G x 4 = 16G fits into 16G RAM (<=)" 1 "$CACHE_FIT"
check "file per job: working set" $((16 * G)) "$CACHE_WS"
cache_fit_check 4G 8 0
check "file per job: 4G x 8 does not fit" 0 "$CACHE_FIT"
FILE_PER_JOB=0

SI_ZFS_DATASET=tank/fio SI_ZFS_PRIMARYCACHE=all
cache_fit_check 4G 4 1
check "ZFS primarycache=all: 4G fits into the 8G ARC with direct=1" 1 "$CACHE_FIT"
check "ZFS: source is the ARC" "ZFS ARC (arc_max)" "$CACHE_SOURCE"
SI_ZFS_PRIMARYCACHE=metadata
cache_fit_check 4G 4 1
check "ZFS primarycache=metadata: ARC does not count" 0 "$CACHE_FIT"
SI_ZFS_PRIMARYCACHE=""
cache_fit_check 4G 4 1
check "ZFS primarycache unknown: ARC counts" 1 "$CACHE_FIT"
SI_ZFS_DATASET=""
cache_fit_check 4G 4 1
check "ARC of a host whose target is not on ZFS does not count" 0 "$CACHE_FIT"

STORAGE_CACHE_BYTES_N=$((64 * G))
cache_fit_check 40G 4 1
check "STORAGE_CACHE_BYTES applies with direct=1" 1 "$CACHE_FIT"
check "STORAGE_CACHE_BYTES: source" STORAGE_CACHE_BYTES "$CACHE_SOURCE"
check "fit text" "working set 40.0G <= 64.0G STORAGE_CACHE_BYTES" "$(cache_fit_text)"
cache_fit_check 100G 4 1
check "100G does not fit into STORAGE_CACHE_BYTES=64G" 0 "$CACHE_FIT"
cache_fit_check bogus 4 1
check "invalid size: never tagged" 0 "$CACHE_FIT"
STORAGE_CACHE_BYTES_N=""

# --- description tag -------------------------------------------------------------------------
SATURATION_MODE=false BASE_DESCRIPTION="mytest" PREFILL=0 FILE_PER_JOB=0 SAT_MAX_TOTAL_SIZE=""
HOSTNAME=h PROTOCOL=p DRIVE_TYPE=t DRIVE_MODEL=m CONFIG_UUID=c RUN_UUID=r CLIENT_MODE=false
CACHE_FIT=0
build_description
base_desc=$DESCRIPTION
check "no tag by default" 0 "$(grep -c cachefit <<<"$DESCRIPTION")"
CACHE_FIT=1; apply_cachefit_tag
check "tag appended" "${base_desc},cachefit:1" "$DESCRIPTION"
apply_cachefit_tag
check "applying twice does not duplicate" "${base_desc},cachefit:1" "$DESCRIPTION"
CACHE_FIT=0; apply_cachefit_tag
check "tag removed for the next test, date unchanged" "$base_desc" "$DESCRIPTION"
CACHE_FIT=1; build_description
check "build_description keeps the tag while CACHE_FIT=1" 1 "$(grep -c ',cachefit:1$' <<<"$DESCRIPTION")"
CACHE_FIT=0

# --- standard mode: tag per test ------------------------------------------------------------
# 1G fits into STORAGE_CACHE_BYTES=4G, 8G does not: only the 1G uploads carry the tag
run_fio_test() { echo "FIO size=$6 jobs=$4 desc=$DESCRIPTION" >>"$TMP/fio_runs"; return 0; }
upload_results() { echo "UPLOAD $2 desc=$DESCRIPTION" >>"$TMP/uploads"; return 0; }
print_success() { :; }
BLOCK_SIZES=(4k) TEST_PATTERNS=(randread read) NUM_JOBS=(4) DIRECT=(1) TEST_SIZE=(1G 8G 1G)
SYNC=(1) IODEPTH=(1) RUNTIME=(1) FIO_RETRY_COUNT=0
SI_MEM_TOTAL=$((64 * G)) SI_ARC_MAX="" SI_ZFS_DATASET=""
STORAGE_CACHE_BYTES_N=$((4 * G))
: >"$TMP/fio_runs"; : >"$TMP/uploads"; : >"$TMP/warnings"
run_all_tests >/dev/null
check "6 uploads" 6 "$(wc -l <"$TMP/uploads" | tr -d ' ')"
check "1G uploads tagged" 4 "$(grep -c '_1G_.*cachefit:1$' "$TMP/uploads")"
check "8G uploads not tagged (no leak from the 1G test before)" 0 "$(grep -c '_8G_.*cachefit' "$TMP/uploads")"
check "fio gets the same description" 4 "$(grep -c 'size=1G.*cachefit:1$' "$TMP/fio_runs")"
check "per-test note for fitting tests" 4 "$(warn_count 'Cache fit: working set 1.0G')"
check "last test (1G) leaves the tag, next build is clean" 1 "$(grep -c cachefit <<<"$DESCRIPTION")"
STORAGE_CACHE_BYTES_N=""

# --- saturation mode: tag per step ------------------------------------------------------------
# FILE_PER_JOB=1, 1G per job: 4 jobs = 4G fits into 6G, 8 jobs = 8G does not
run_fio_with_retry() { shift 2; printf '%s\n' "$@" >"$TMP/args"; return 0; }
sat_arg() { grep "^--$1=" "$TMP/args" | head -1 | cut -d= -f2-; }
SATURATION_MODE=true FILE_PER_JOB=1 PREFILL=0 SAT_MAX_TOTAL_SIZE="" SAT_TEST_SIZE=1G SAT_DIRECT=1
SAT_SYNC=none SAT_RUNTIME=1 SAT_CURRENT_BS=4k SAT_PREFILL_BASE="" SAT_CAP_MIN_WARNED=false
TARGET_DIR="$TMP/target" TARGET_IS_DEVICE=false IOENGINE=psync FIO_EXTRA_ARGS_ARR=()
STORAGE_CACHE_BYTES_N=$((6 * G))
build_description
run_fio_step randread 16 4 "$TMP/out.json"
check "sat step 4 jobs: fio description tagged" 1 "$(sat_arg description | grep -c ',cachefit:1$')"
check "sat step 4 jobs: upload description tagged" 1 "$(grep -c ',cachefit:1$' <<<"$DESCRIPTION")"
run_fio_step randread 16 8 "$TMP/out.json"
check "sat step 8 jobs: not tagged" 0 "$(sat_arg description | grep -c cachefit)"
check "sat step 8 jobs: upload description not tagged" 0 "$(grep -c cachefit <<<"$DESCRIPTION")"
FILE_PER_JOB=0
run_fio_step randread 16 64 "$TMP/out.json"
check "sat shared file: 64 jobs still 1G, tagged" 1 "$(sat_arg description | grep -c ',cachefit:1$')"
SAT_MAX_TOTAL_SIZE=2G FILE_PER_JOB=1
run_fio_step randread 16 64 "$TMP/out.json"
check "sat with cap 2G: 64 jobs x 32M = 2G fits" 1 "$(sat_arg description | grep -c ',cachefit:1$')"
SAT_MAX_TOTAL_SIZE="" STORAGE_CACHE_BYTES_N="" SATURATION_MODE=false FILE_PER_JOB=0

# --- client mode ----------------------------------------------------------------------------
CLIENT_NAME=(vm1 vm2 vm3 vm4 vm5 vm6)
CLIENT_STORAGE=(
    '{"fs_type":"ext4","mem_total":8589934592,"virt":{"type":"kvm"}}'
    '{"fs_type":"ext4","mem_total":4294967296}'
    '{"fs_type":"zfs","mem_total":8589934592,"arc_max":4294967296,"zfs":{"dataset":"t/f","primarycache":"all"}}'
    '{"fs_type":"zfs","arc_max":4294967296,"zfs":{"dataset":"t/f","primarycache":"none"}}'
    '{"mem_total":"$(id)","arc_max":-5,"zfs":"x","virt":{"type":"kvm;rm"}}'
    '{}'
)
client_cache_info
check "client mem_total parsed" "8589934592 4294967296 8589934592" "${CLIENT_MEM[*]:0:3}"
check "client arc_max parsed" 4294967296 "${CLIENT_ARC[2]}"
check "client on zfs" "0 0 1 1 0 0" "${CLIENT_ON_ZFS[*]}"
check "client primarycache" none "${CLIENT_PCACHE[3]}"
check "hostile mem_total ignored" "" "${CLIENT_MEM[4]}"
check "hostile arc_max ignored" "" "${CLIENT_ARC[4]}"
check "virt type sanitized" kvmrm "${CLIENT_VIRT[4]}"
check "empty storage.json: nothing known" "" "${CLIENT_MEM[5]}${CLIENT_ARC[5]}"

# 6 VMs on one ZFS hypervisor with a 64G ARC (STORAGE_CACHE_BYTES), 10G each, shared file
TARGET_IS_DEVICE=false FILE_PER_JOB=0 STORAGE_CACHE_BYTES_N=$((64 * G))
client_cache_fit_check 6 10G 4 1
check "6 clients x 10G = 60G fits into 64G" 1 "$CACHE_FIT"
check "client working set is the total" $((60 * G)) "$CACHE_WS"
check "client source" STORAGE_CACHE_BYTES "$CACHE_SOURCE"
client_cache_fit_check 1 10G 4 1
check "1 client x 10G fits" 1 "$CACHE_FIT"
FILE_PER_JOB=1
client_cache_fit_check 2 10G 4 1
check "file per job: 2 clients x 4 x 10G = 80G does not fit" 0 "$CACHE_FIT"
FILE_PER_JOB=0
client_cache_fit_check 6 20G 4 1
check "6 clients x 20G does not fit" 0 "$CACHE_FIT"
STORAGE_CACHE_BYTES_N=""
# Each client's own caches only hold its own share
client_cache_fit_check 2 6G 4 1
check "direct=1: client RAM does not count" 0 "$CACHE_FIT"
client_cache_fit_check 2 6G 4 0
check "direct=0: 6G fits into vm1's 8G RAM" 1 "$CACHE_FIT"
check "direct=0: share is the working set" $((6 * G)) "$CACHE_WS"
check "direct=0: source names the client" "page cache (RAM, direct=0) of client vm1" "$CACHE_SOURCE"
client_cache_fit_check 2 10G 4 0
check "direct=0: 10G fits into no client's RAM" 0 "$CACHE_FIT"
client_cache_fit_check 4 3G 4 1
check "direct=1: vm3's ARC (primarycache=all) holds 3G" 1 "$CACHE_FIT"
check "direct=1: ARC source names vm3" "ZFS ARC (arc_max) of client vm3" "$CACHE_SOURCE"
client_cache_fit_check 2 3G 4 1
check "direct=1: first 2 clients have no ARC" 0 "$CACHE_FIT"

# Description in client mode: clients tag plus cachefit, rebuilt per step
CLIENT_MODE=true STEP_CLIENTS=6 RAMP_CLIENTS=1,6 STEP_COMPLETE=1 CACHE_FIT=1
build_description
check "client description has clients and cachefit" 1 "$(grep -c ',clients:6,ramp:1,cachefit:1$' <<<"$DESCRIPTION")"
CACHE_FIT=0 STEP_COMPLETE=0
build_description
check "next step without fit: no tag" 0 "$(grep -c cachefit <<<"$DESCRIPTION")"
CLIENT_MODE=false STEP_COMPLETE=1

# --- startup warning ----------------------------------------------------------------------
TEST_SIZE=(1G 100G) NUM_JOBS=(4) DIRECT=(1 0) FILE_PER_JOB=0
SI_MEM_TOTAL=$((16 * G)) SI_ARC_MAX="" SI_ZFS_DATASET="" SI_VIRT_TYPE="" STORAGE_CACHE_BYTES_N=""
: >"$TMP/warnings"
show_cache_fit_warning
check "startup: only 1G with direct=0 fits" 1 "$CACHE_FIT_WARNINGS"
check "startup: combination listed" 1 "$(warn_count 'size=1G jobs=4 direct=0: working set 1.0G <= 16.0G page cache')"
check "startup: counts shown" 1 "$(warn_count '1 of 4 test size/jobs/direct')"
check "startup: CACHE_FIT reset afterwards" 0 "$CACHE_FIT"
DIRECT=(1)
: >"$TMP/warnings"
show_cache_fit_warning
check "startup: nothing fits, no warning" 0 "$(warn_count .)"

# VM without STORAGE_CACHE_BYTES: hint to set it
print_status() { echo "STATUS: $*" >>"$TMP/status"; }
: >"$TMP/status"
SI_VIRT_TYPE=kvm
show_cache_fit_warning
check "VM hint without STORAGE_CACHE_BYTES" 1 "$(grep -c 'Set STORAGE_CACHE_BYTES' "$TMP/status")"
SI_VIRT_TYPE=lxc
: >"$TMP/status"
show_cache_fit_warning
check "no VM hint in a container" 0 "$(grep -c 'STORAGE_CACHE_BYTES' "$TMP/status")"
SI_VIRT_TYPE=kvm STORAGE_CACHE_BYTES_N=$((64 * G))
: >"$TMP/status"
show_cache_fit_warning
check "no VM hint once STORAGE_CACHE_BYTES is set" 0 "$(grep -c 'Set STORAGE_CACHE_BYTES' "$TMP/status")"

# Client ramp 1..6 against STORAGE_CACHE_BYTES=64G, 10G per client: all counts fit
CLIENT_MODE=true RAMP_STEPS=(1 2 4 6)
TEST_SIZE=(10G) DIRECT=(1)
: >"$TMP/warnings"
show_cache_fit_warning
check "startup client ramp: every count fits" 4 "$CACHE_FIT_WARNINGS"
check "startup client ramp: 6 clients listed" 1 "$(warn_count 'clients=6: working set 60.0G <= 64.0G STORAGE_CACHE_BYTES')"
TEST_SIZE=(12G)
show_cache_fit_warning
check "startup client ramp: 12G fits up to 5 clients (1,2,4)" 3 "$CACHE_FIT_WARNINGS"
CLIENT_MODE=false

# Saturation: the first step decides
SATURATION_MODE=true SAT_TEST_SIZE=1G INITIAL_NUMJOBS=4 SAT_DIRECT=1 FILE_PER_JOB=1
STORAGE_CACHE_BYTES_N=$((4 * G))
show_cache_fit_warning
check "startup saturation: 4 jobs x 1G fits into 4G" 1 "$CACHE_FIT_WARNINGS"
INITIAL_NUMJOBS=8
show_cache_fit_warning
check "startup saturation: 8 jobs x 1G does not" 0 "$CACHE_FIT_WARNINGS"
SATURATION_MODE=false FILE_PER_JOB=0

# --- cache summary --------------------------------------------------------------------------
SI_MEM_TOTAL=$((16 * G)) SI_ARC_MAX=$((8 * G)) SI_ZFS_DATASET=tank/fio SI_ZFS_PRIMARYCACHE=metadata
STORAGE_CACHE_BYTES_N=$((64 * G))
check "cache summary" "RAM 16.0G (page cache, direct=0 only), ZFS ARC max 8.0G (not used: primarycache=metadata), STORAGE_CACHE_BYTES 64.0G" \
    "$(cache_summary)"
SI_MEM_TOTAL="" SI_ARC_MAX="" STORAGE_CACHE_BYTES_N=""
check "cache summary unknown" unknown "$(cache_summary)"

finish
