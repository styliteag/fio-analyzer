#!/usr/bin/env bash
# Tests for storage detection (STORAGE_INFO), plausibility warnings and the
# storage_info upload field of fio-test.sh
# (run: bash scripts/tests/test_storage_info.sh)
# Loads only the needed functions from the script. External commands (zfs, ceph, rbd,
# getfattr, findmnt, uname, fio, df, mount, curl) are bash function stubs; si_run calls
# functions directly (without timeout), so the stubs are used even where timeout exists.
# MISSING lists commands that `command -v` must report as not installed.

# shellcheck disable=SC2034,SC2329  # config vars and stubs are used by the sourced functions

set -u
SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/fio-test.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

FUNCS="fio_size_to_bytes json_escape json_object si_run si_safe_arg storage_fs_info storage_zfs_dataset
storage_zfs_props storage_rbd_device storage_ceph_pool storage_ceph_info detect_storage
storage_size_matches storage_plausibility_checks storage_summary upload_results"
SED_EXPR=""
for f in $FUNCS; do SED_EXPR+="/^${f}()/,/^}/p;"; done
# shellcheck source=/dev/null
source <(sed -n "$SED_EXPR" "$SCRIPT")
for f in $FUNCS; do
    declare -F "$f" >/dev/null || { echo "function $f not found in $SCRIPT"; exit 1; }
done

print_status() { :; }
print_success() { :; }
print_error() { :; }
print_warning() { echo "WARN: $*" >>"$TMP/warnings"; }
warn_count() { grep -c "$1" "$TMP/warnings" 2>/dev/null || true; }

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
valid_json() {  # prints ok when $1 parses as a JSON object
    python3 -c 'import json,sys; o=json.loads(sys.argv[1]); assert isinstance(o, dict); print("ok")' "$1" 2>/dev/null || echo "invalid"
}
json_get() {  # json_get <json> <python path expression, e.g. ["zfs"]["sync"]>
    python3 -c "import json,sys; print(json.loads(sys.argv[1])$2)" "$1" 2>/dev/null || echo "<none>"
}

# --- json_escape / json_object ----------------------------------------------------
check "plain string" 'abc' "$(json_escape 'abc')"
check "quote" 'a\"b' "$(json_escape 'a"b')"
check "backslash" 'a\\b' "$(json_escape 'a\b')"
check "newline, tab, CR" 'a\nb\tc\rd' "$(json_escape $'a\nb\tc\rd')"
check "other control chars removed" 'ab' "$(json_escape $'a\001\033b')"
check "utf-8 kept" 'größe ×' "$(json_escape 'größe ×')"
check "backslash next to quote" 'a\\\"b\\c' "$(json_escape 'a\"b\c')"
check "object skips empty values" '{"a":"1","c":"x y"}' "$(json_object a 1 b "" c "x y")"
check "numeric key" '{"n":3}' "$(json_object n:n 3)"
check "numeric key with non-number is skipped" '{}' "$(json_object n:n "3 x")"
check "raw object key" '{"o":{"k":"v"}}' "$(json_object o:o '{"k":"v"}')"
check "empty raw object skipped" '{}' "$(json_object o:o '{}')"
nasty=$'we"ird\\na\nme\t<@x>'
check "escaped object is valid JSON" ok "$(valid_json "$(json_object name "$nasty")")"
check "escaped value round-trips" "$nasty" "$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["name"], end="")' "$(json_object name "$nasty")")"

# --- common stubs for detect_storage ------------------------------------------------
reset_stubs() {
    MISSING="timeout gtimeout"
    FINDMNT_OUT="" ZFS_LIST_DIR="" ZFS_LIST_VOLS="" ZFS_PROPS="" GETFATTR_OUT=""
    CEPH_DETAIL="" CEPH_SIZE="" CEPH_MIN_SIZE="" RBD_INFO="" RBD_SHOWMAPPED=""
    UNAME_S=Linux
    : >"$TMP/calls"
}
uname() { case "$1" in -s) echo "$UNAME_S" ;; -r) echo "6.8.0-test" ;; esac; }
fio() { echo "fio $*" >>"$TMP/calls"; echo "fio-3.36"; }
findmnt() { echo "findmnt $*" >>"$TMP/calls"; [ -n "$FINDMNT_OUT" ] && echo "$FINDMNT_OUT"; }
stat() { echo "stat $*" >>"$TMP/calls"; return 1; }
zfs() {
    echo "zfs $*" >>"$TMP/calls"
    case "$1 $2" in
        "list -H")
            if [[ " $* " == *" -t volume "* ]]; then
                [ -n "$ZFS_LIST_VOLS" ] && echo "$ZFS_LIST_VOLS"
            else
                [ -n "$ZFS_LIST_DIR" ] && echo "$ZFS_LIST_DIR"
            fi
            ;;
        "get -H") [ -n "$ZFS_PROPS" ] && printf '%s\n' "$ZFS_PROPS" ;;
    esac
    return 0
}
getfattr() { echo "getfattr $*" >>"$TMP/calls"; [ -n "$GETFATTR_OUT" ] && echo "$GETFATTR_OUT"; }
ceph() {
    echo "ceph $*" >>"$TMP/calls"
    case "$*" in
        "osd pool ls detail") [ -n "$CEPH_DETAIL" ] && printf '%s\n' "$CEPH_DETAIL" ;;
        "osd pool get "*" size") [ -n "$CEPH_SIZE" ] && echo "size: $CEPH_SIZE" ;;
        "osd pool get "*" min_size") [ -n "$CEPH_MIN_SIZE" ] && echo "min_size: $CEPH_MIN_SIZE" ;;
    esac
    return 0
}
rbd() {
    echo "rbd $*" >>"$TMP/calls"
    case "$1" in
        info) [ -n "$RBD_INFO" ] && printf '%s\n' "$RBD_INFO" ;;
        showmapped) [ -n "$RBD_SHOWMAPPED" ] && printf '%s\n' "$RBD_SHOWMAPPED" ;;
    esac
    return 0
}

ZFS_FS_PROPS=$'sync\tdisabled\nrecordsize\t16K\nvolblocksize\t-\ncompression\tlz4\nprimarycache\tall\nlogbias\tlatency'
ZFS_VOL_PROPS=$'sync\talways\nrecordsize\t-\nvolblocksize\t64K\ncompression\toff\nprimarycache\tmetadata\nlogbias\tthroughput'
CEPH_DETAIL_OUT="pool 1 '.mgr' replicated size 3 min_size 2 crush_rule 0 object_hash rjenkins
pool 2 'rbdpool' replicated size 3 min_size 2 crush_rule 0 object_hash rjenkins pg_num 32
pool 3 'ecdata' erasure profile k2m1 size 3 min_size 2 crush_rule 1
pool 4 'cephfs_data' replicated size 2 min_size 1 crush_rule 0"

STORAGE_DETECT=1 IOENGINE=io_uring TARGET_IS_DEVICE=false
TARGET_DIR="$TMP/target"
mkdir -p "$TARGET_DIR"
SI_ZVOL_DIR="$TMP/zvol" SI_RBD_DEV_DIR="$TMP/rbddev" SI_RBD_SYSFS="$TMP/sysrbd"
mkdir -p "$TMP/dev" "$SI_ZVOL_DIR/tank" "$SI_RBD_DEV_DIR/rbdpool" "$SI_RBD_SYSFS/0"

# --- ZFS filesystem ------------------------------------------------------------------
reset_stubs
FINDMNT_OUT="zfs    tank/fio" ZFS_LIST_DIR="tank/fio" ZFS_PROPS="$ZFS_FS_PROPS"
detect_storage
check "zfs filesystem: exact JSON" \
    '{"fs_type":"zfs","kernel":"6.8.0-test","os":"Linux","ioengine":"io_uring","fio_version":"fio-3.36","zfs":{"dataset":"tank/fio","type":"filesystem","sync":"disabled","recordsize":"16K","compression":"lz4","primarycache":"all","logbias":"latency"}}' \
    "$STORAGE_INFO"
check "zfs filesystem: valid JSON" ok "$(valid_json "$STORAGE_INFO")"
check "zfs filesystem: volblocksize '-' skipped" "<none>" "$(json_get "$STORAGE_INFO" '["zfs"]["volblocksize"]')"
check "zfs list is asked for the target dir" 1 "$(grep -c "^zfs list -H -o name $TARGET_DIR$" "$TMP/calls")"

reset_stubs
FINDMNT_OUT="zfs tank/from-mount" ZFS_LIST_DIR="" ZFS_PROPS="$ZFS_FS_PROPS"
detect_storage
check "zfs dataset falls back to the mount source" tank/from-mount "$(json_get "$STORAGE_INFO" '["zfs"]["dataset"]')"

reset_stubs
MISSING="timeout gtimeout zfs"
FINDMNT_OUT="zfs tank/nocli"
detect_storage
check "zfs without CLI: dataset and type only" '{"dataset":"tank/nocli","type":"filesystem"}' \
    "$(python3 -c 'import json,sys; print(json.dumps(json.loads(sys.argv[1])["zfs"], separators=(",",":")))' "$STORAGE_INFO")"

reset_stubs
FINDMNT_OUT="" ZFS_PROPS="$ZFS_FS_PROPS"
stat() { echo "stat $*" >>"$TMP/calls"; echo "ext2/ext3"; }
detect_storage
unset -f stat; stat() { echo "stat $*" >>"$TMP/calls"; return 1; }
check "linux stat fallback when findmnt has no answer" ext2/ext3 "$(json_get "$STORAGE_INFO" '["fs_type"]')"
check "non-zfs: no zfs object" "<none>" "$(json_get "$STORAGE_INFO" '["zfs"]')"
check "non-zfs: zfs not called" 0 "$(grep -c '^zfs' "$TMP/calls")"

# --- ZFS volume (zvol) -----------------------------------------------------------------
: >"$TMP/dev/zd0"; : >"$TMP/dev/zd16"
ln -sf "$TMP/dev/zd0" "$SI_ZVOL_DIR/tank/vol0"
ln -sf "$TMP/dev/zd16" "$SI_ZVOL_DIR/tank/vol1"
reset_stubs
TARGET_IS_DEVICE=true TARGET_DIR="$TMP/dev/zd16"
ZFS_LIST_VOLS=$'tank/vol0\ntank/vol1' ZFS_PROPS="$ZFS_VOL_PROPS"
detect_storage
check "zvol by /dev/zdN: valid JSON" ok "$(valid_json "$STORAGE_INFO")"
check "zvol: fs_type block" block "$(json_get "$STORAGE_INFO" '["fs_type"]')"
check "zvol by /dev/zdN: resolved name" tank/vol1 "$(json_get "$STORAGE_INFO" '["zfs"]["dataset"]')"
check "zvol: type volume" volume "$(json_get "$STORAGE_INFO" '["zfs"]["type"]')"
check "zvol: volblocksize" 64K "$(json_get "$STORAGE_INFO" '["zfs"]["volblocksize"]')"
check "zvol: recordsize '-' skipped" "<none>" "$(json_get "$STORAGE_INFO" '["zfs"]["recordsize"]')"
check "zvol: findmnt not used for devices" 0 "$(grep -c '^findmnt' "$TMP/calls")"

reset_stubs
TARGET_DIR="$SI_ZVOL_DIR/tank/vol0" ZFS_PROPS="$ZFS_VOL_PROPS"
detect_storage
check "zvol by /dev/zvol path" tank/vol0 "$(json_get "$STORAGE_INFO" '["zfs"]["dataset"]')"

reset_stubs
TARGET_DIR="$TMP/dev/zd0" ZFS_LIST_VOLS="tank/other"
detect_storage
check "unknown block device: no zfs object" "<none>" "$(json_get "$STORAGE_INFO" '["zfs"]')"
check "unknown block device: still valid JSON" ok "$(valid_json "$STORAGE_INFO")"

# --- Ceph RBD ---------------------------------------------------------------------------
: >"$TMP/dev/rbd0"
echo rbdpool >"$SI_RBD_SYSFS/0/pool"
echo img1 >"$SI_RBD_SYSFS/0/name"
reset_stubs
TARGET_DIR="$TMP/dev/rbd0" CEPH_DETAIL="$CEPH_DETAIL_OUT"
RBD_INFO=$'rbd image \'img1\':\n\tsize 10 GiB in 2560 objects\n\torder 22 (4 MiB objects)\n\tid: abc'
detect_storage
check "rbd via sysfs: exact ceph object" \
    '{"kind":"rbd","pool":"rbdpool","image":"img1","object_size":4194304,"pool_type":"replicated","pool_size":3,"min_size":2}' \
    "$(python3 -c 'import json,sys; print(json.dumps(json.loads(sys.argv[1])["ceph"], separators=(",",":")))' "$STORAGE_INFO")"
check "rbd info asked for pool/image" 1 "$(grep -c '^rbd info rbdpool/img1$' "$TMP/calls")"

reset_stubs
: >"$TMP/dev/rbd1"
TARGET_DIR="$TMP/dev/rbd1" CEPH_DETAIL="$CEPH_DETAIL_OUT"
RBD_SHOWMAPPED=$'id  pool     namespace  image  snap  device\n0   rbdpool             img1   -     /dev/rbd0\n1   ecmeta              img2   -     '"$TMP/dev/rbd1"
RBD_INFO=$'\torder 23 (8 MiB objects)\n\tdata_pool: ecdata'
detect_storage
check "rbd via showmapped: pool" ecmeta "$(json_get "$STORAGE_INFO" '["ceph"]["pool"]')"
check "rbd via showmapped: image" img2 "$(json_get "$STORAGE_INFO" '["ceph"]["image"]')"
check "rbd object size from order" 8388608 "$(json_get "$STORAGE_INFO" '["ceph"]["object_size"]')"
check "rbd data pool recorded" ecdata "$(json_get "$STORAGE_INFO" '["ceph"]["data_pool"]')"
check "rbd with data pool: erasure type" erasure "$(json_get "$STORAGE_INFO" '["ceph"]["pool_type"]')"

reset_stubs
MISSING="timeout gtimeout ceph rbd"
ln -sf "$TMP/dev/rbd0" "$SI_RBD_DEV_DIR/rbdpool/img1"
TARGET_DIR="$SI_RBD_DEV_DIR/rbdpool/img1"
detect_storage
check "rbd without CLI: only what is known" '{"kind":"rbd","pool":"rbdpool","image":"img1"}' \
    "$(python3 -c 'import json,sys; print(json.dumps(json.loads(sys.argv[1])["ceph"], separators=(",",":")))' "$STORAGE_INFO")"
check "rbd without CLI: nothing called" 0 "$(grep -Ec '^(ceph|rbd)' "$TMP/calls")"

# --- CephFS ------------------------------------------------------------------------------
reset_stubs
TARGET_IS_DEVICE=false TARGET_DIR="$TMP/target"
FINDMNT_OUT="ceph 10.0.0.1:6789:/" GETFATTR_OUT="cephfs_data" CEPH_SIZE=2 CEPH_MIN_SIZE=1
detect_storage
check "cephfs: fs_type" ceph "$(json_get "$STORAGE_INFO" '["fs_type"]')"
check "cephfs: exact ceph object (size via pool get fallback)" \
    '{"kind":"cephfs","pool":"cephfs_data","pool_size":2,"min_size":1}' \
    "$(python3 -c 'import json,sys; print(json.dumps(json.loads(sys.argv[1])["ceph"], separators=(",",":")))' "$STORAGE_INFO")"
check "cephfs: getfattr reads the layout pool" 1 "$(grep -c 'getfattr .*ceph.dir.layout.pool' "$TMP/calls")"

reset_stubs
MISSING="timeout gtimeout getfattr ceph"
FINDMNT_OUT="fuse.ceph-fuse ceph-fuse"
detect_storage
check "ceph-fuse without tools: kind only" '{"kind":"cephfs"}' \
    "$(python3 -c 'import json,sys; print(json.dumps(json.loads(sys.argv[1])["ceph"], separators=(",",":")))' "$STORAGE_INFO")"

# --- size limit ----------------------------------------------------------------------------
reset_stubs
FINDMNT_OUT="ceph mon:/" GETFATTR_OUT="$(printf 'p%.0s' {1..5000})"
detect_storage
check "oversized ceph details are dropped" "<none>" "$(json_get "$STORAGE_INFO" '["ceph"]')"
check "oversized: fs_type kept" ceph "$(json_get "$STORAGE_INFO" '["fs_type"]')"
check "oversized: result below 4 KB" 1 "$([ "$(LC_ALL=C; echo "${#STORAGE_INFO}")" -lt 4096 ] && echo 1 || echo 0)"

# --- macOS / other systems without findmnt --------------------------------------------------
reset_stubs
MISSING="timeout gtimeout findmnt"
UNAME_S=Darwin
df() { printf 'Filesystem 512-blocks Used Available Capacity Mounted on\n/dev/disk3s5 100 50 50 50%% /System/Volumes/Data\n'; }
mount() { printf '/dev/disk3s1s1 on / (apfs, sealed, local)\n/dev/disk3s5 on /System/Volumes/Data (apfs, local, journaled)\n'; }
detect_storage
check "darwin: fs type from mount" apfs "$(json_get "$STORAGE_INFO" '["fs_type"]')"
check "darwin: os" Darwin "$(json_get "$STORAGE_INFO" '["os"]')"
check "darwin: stat not used" 0 "$(grep -c '^stat' "$TMP/calls")"

reset_stubs
MISSING="timeout gtimeout findmnt"
UNAME_S=FreeBSD
df() { printf 'Filesystem 1024-blocks Used Avail Capacity Mounted on\ntank/bsd 100 50 50 50%% /mnt/tank/bsd\n'; }
mount() { printf 'tank on /mnt/tank (zfs, local, nfsv4acls)\ntank/bsd on /mnt/tank/bsd (zfs, local, nfsv4acls)\n'; }
ZFS_PROPS="$ZFS_FS_PROPS"
detect_storage
check "freebsd: zfs from mount" zfs "$(json_get "$STORAGE_INFO" '["fs_type"]')"
check "freebsd: dataset from mount source" tank/bsd "$(json_get "$STORAGE_INFO" '["zfs"]["dataset"]')"
unset -f df mount

# --- STORAGE_DETECT=0 --------------------------------------------------------------------------
reset_stubs
FINDMNT_OUT="zfs tank/fio" ZFS_PROPS="$ZFS_FS_PROPS"
STORAGE_DETECT=0
detect_storage
check "STORAGE_DETECT=0: empty STORAGE_INFO" "" "$STORAGE_INFO"
check "STORAGE_DETECT=0: no commands run" 0 "$(wc -l <"$TMP/calls" | tr -d ' ')"
check "STORAGE_DETECT=0: summary says disabled" "detection disabled (STORAGE_DETECT=0)" "$(storage_summary)"
STORAGE_DETECT=1

# --- storage_summary -----------------------------------------------------------------------------
reset_stubs
FINDMNT_OUT="zfs tank/fio" ZFS_LIST_DIR="tank/fio" ZFS_PROPS="$ZFS_FS_PROPS"
detect_storage
check "summary: zfs filesystem" "fs=zfs zfs=tank/fio sync=disabled recordsize=16K compression=lz4 logbias=latency" "$(storage_summary)"

# --- storage_size_matches ------------------------------------------------------------------------
storage_size_matches 16K 16k; check "16K == 16k" 0 "$?"
storage_size_matches 16k 16384; check "16k == 16384" 0 "$?"
storage_size_matches 1M 1024k; check "1M == 1024k" 0 "$?"
storage_size_matches 16K 128K; check "16K != 128K" 1 "$?"
storage_size_matches 16K bogus; check "unparseable is a mismatch" 1 "$?"

# --- plausibility rules ------------------------------------------------------------------------------
plaus() {  # plaus <drive_model> <drive_type>; uses SI_* set by the caller
    DRIVE_MODEL=$1 DRIVE_TYPE=$2
    : >"$TMP/warnings"
    storage_plausibility_checks
}
zfs_fs() {  # zfs_fs <sync> <recordsize>
    SI_FS_TYPE=zfs SI_ZFS_DATASET=tank/fio SI_ZFS_TYPE=filesystem SI_ZFS_SYNC=$1
    SI_ZFS_RECORDSIZE=$2 SI_ZFS_VOLBLOCKSIZE=""
}
PROTOCOL=local TARGET_IS_DEVICE=false

zfs_fs standard 128K
plaus tank-syncoff mirror
check "syncoff with sync=standard warns" 1 "$STORAGE_WARNINGS"
check "warning names the detected value" 1 "$(warn_count 'sync=standard')"
zfs_fs disabled 128K
plaus tank-SyncOff mirror
check "syncoff with sync=disabled: ok (case-insensitive)" 0 "$STORAGE_WARNINGS"

zfs_fs standard 128K
plaus tank-syncall mirror
check "syncall with sync=standard warns" 1 "$STORAGE_WARNINGS"
plaus tank-syncalways mirror
check "syncalways with sync=standard warns" 1 "$STORAGE_WARNINGS"
zfs_fs always 128K
plaus tank-syncall mirror
check "syncall with sync=always: ok" 0 "$STORAGE_WARNINGS"

zfs_fs disabled 128K
plaus tank-syncstd mirror
check "syncstd with sync=disabled warns" 1 "$STORAGE_WARNINGS"
plaus tank-syncstandard mirror
check "syncstandard with sync=disabled warns" 1 "$STORAGE_WARNINGS"
zfs_fs standard 128K
plaus tank-syncstd mirror
check "syncstd with sync=standard: ok" 0 "$STORAGE_WARNINGS"

zfs_fs standard 128K
plaus tank-rs16k mirror
check "rs16k with recordsize=128K warns" 1 "$STORAGE_WARNINGS"
check "rs warning names recordsize" 1 "$(warn_count 'recordsize=128K')"
zfs_fs standard 16K
plaus tank-rs16k mirror
check "rs16k with recordsize=16K: ok" 0 "$STORAGE_WARNINGS"
zfs_fs standard 1M
plaus tank-RS1M mirror
check "RS1M with recordsize=1M: ok" 0 "$STORAGE_WARNINGS"
zfs_fs standard 128K
plaus users16k mirror
check "rs inside a word is not a recordsize tag" 0 "$STORAGE_WARNINGS"

SI_FS_TYPE=block SI_ZFS_DATASET=tank/vol SI_ZFS_TYPE=volume SI_ZFS_SYNC=standard
SI_ZFS_RECORDSIZE="" SI_ZFS_VOLBLOCKSIZE=16K
TARGET_IS_DEVICE=true
plaus tank-vbs64k raidz1
check "vbs64k with volblocksize=16K warns" 1 "$STORAGE_WARNINGS"
plaus tank-vbs16k raidz1
check "vbs16k with volblocksize=16K: ok (no zfs-layout warning for zvol)" 0 "$STORAGE_WARNINGS"

zfs_fs disabled 16K
TARGET_IS_DEVICE=false
plaus tank-syncstd-rs128k mirror
check "two mismatches give two warnings" 2 "$STORAGE_WARNINGS"

# DRIVE_TYPE zfs layouts on non-ZFS storage
SI_FS_TYPE=ext4 SI_ZFS_DATASET="" SI_ZFS_TYPE="" SI_ZFS_SYNC="" SI_ZFS_RECORDSIZE="" SI_ZFS_VOLBLOCKSIZE=""
plaus tank raidz2
check "raidz2 on ext4 warns" 1 "$STORAGE_WARNINGS"
plaus tank Mirror
check "mirror on ext4 warns" 1 "$STORAGE_WARNINGS"
plaus tank ssd
check "ssd on ext4: ok" 0 "$STORAGE_WARNINGS"
plaus tank-syncoff ssd
check "sync tag without detected zfs is not checked" 0 "$STORAGE_WARNINGS"
plaus tank vm-raidz1
check "vm- prefix: guest cannot see zfs, no warning" 0 "$STORAGE_WARNINGS"
PROTOCOL=NFS SI_FS_TYPE=nfs4
plaus tank raidz1
check "network protocol: no zfs-layout warning" 0 "$STORAGE_WARNINGS"
PROTOCOL=unknown SI_FS_TYPE=nfs4
plaus tank raidz1
check "network filesystem: no zfs-layout warning" 0 "$STORAGE_WARNINGS"
PROTOCOL=Local SI_FS_TYPE=""
plaus tank raidz1
check "unknown fs: no zfs-layout warning" 0 "$STORAGE_WARNINGS"
SI_FS_TYPE=block TARGET_IS_DEVICE=true
plaus tank raidz1
check "raidz1 on a non-zvol block device warns" 1 "$STORAGE_WARNINGS"
zfs_fs standard 128K
TARGET_IS_DEVICE=false
plaus tank raidz1
check "raidz1 on zfs: ok" 0 "$STORAGE_WARNINGS"

STORAGE_DETECT=0
SI_FS_TYPE=ext4 SI_ZFS_SYNC=""
plaus tank raidz1
check "STORAGE_DETECT=0: no plausibility warnings" 0 "$STORAGE_WARNINGS"
STORAGE_DETECT=1

# --- upload_results sends storage_info ----------------------------------------------------------------
curl() { printf '%s\n' "$@" >"$TMP/curl_args"; printf '{"message":"ok"}200'; }
date() { echo "2025-06-31T20:00:00Z"; }
SATURATION_MODE=false USERNAME=u PASSWORD=p DRIVE_MODEL=m DRIVE_TYPE=t HOSTNAME=h
PROTOCOL=p DESCRIPTION=d CONFIG_UUID=c RUN_UUID=r BACKEND_URL=http://stub
: >"$TMP/f.json"
STORAGE_INFO='{"fs_type":"<zfs@x>"}'
upload_results "$TMP/f.json" t >/dev/null
check "storage_info sent with --form-string" 1 \
    "$(grep -A1 -x -- '--form-string' "$TMP/curl_args" | grep -cxF 'storage_info={"fs_type":"<zfs@x>"}')"
STORAGE_INFO=""
upload_results "$TMP/f.json" t >/dev/null
check "no storage_info field when empty" 0 "$(grep -c 'storage_info' "$TMP/curl_args")"
unset -f curl date


# --- values starting with '-' are never passed to zfs/ceph (option injection) -------
: >"$TMP/calls"
storage_zfs_props "-o" filesystem
check "zfs props: dash value not passed to zfs" 0 "$(grep -c '^zfs ' "$TMP/calls")"
: >"$TMP/calls"
storage_ceph_pool "--cluster=evil"
check "ceph pool: dash value not passed to ceph" 0 "$(grep -c '^ceph ' "$TMP/calls")"

if [ "$failures" -gt 0 ]; then
    echo "$failures test(s) failed"
    exit 1
fi
echo "all tests passed"
