# Shared setup for the storage detection tests (sourced, not run directly):
# loads the storage functions of fio-test.sh and stubs the external tools.
# External commands (zfs, zpool, ceph, rbd, getfattr, findmnt, stat, uname, fio, lsblk,
# systemd-detect-virt) are bash function stubs; si_run calls functions directly (without
# timeout), so the stubs are used even where timeout exists.
# MISSING lists commands that `command -v` must report as not installed.
# SI_SYS_ROOT points at a private tree, so the host's /sys is never read.

# shellcheck shell=bash disable=SC2034,SC2329  # config vars and stubs are used by the sourced functions

set -u
SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/fio-test.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

FUNCS="fio_size_to_bytes json_escape json_object si_run si_safe_arg si_read_file storage_fs_info
storage_zfs_dataset storage_zpool_layout storage_zfs_props storage_rbd_device storage_ceph_pool
storage_ceph_info storage_parent_disk storage_disk_driver storage_disk_lsblk storage_disk_info
storage_virt_info storage_info_json detect_storage storage_size_matches storage_pool_layout_check
storage_plausibility_checks si_token storage_summary_tokens storage_summary upload_results
si_byte_count storage_cache_sizes human_bytes"
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
finish() {
    if [ "$failures" -gt 0 ]; then
        echo "$failures test(s) failed"
        exit 1
    fi
    echo "all tests passed"
}
valid_json() {  # prints ok when $1 parses as a JSON object
    python3 -c 'import json,sys; o=json.loads(sys.argv[1]); assert isinstance(o, dict); print("ok")' "$1" 2>/dev/null || echo "invalid"
}
json_get() {  # json_get <json> <python path expression, e.g. ["zfs"]["sync"]>
    python3 -c "import json,sys; print(json.loads(sys.argv[1])$2)" "$1" 2>/dev/null || echo "<none>"
}
json_sub() {  # json_sub <json> <key>: compact JSON of one sub-object
    python3 -c 'import json,sys; print(json.dumps(json.loads(sys.argv[1])[sys.argv[2]], separators=(",",":")))' "$1" "$2" 2>/dev/null || echo "<none>"
}

# --- stubs for detect_storage -----------------------------------------------------------
reset_stubs() {
    MISSING="timeout gtimeout"
    FINDMNT_OUT="" ZFS_LIST_DIR="" ZFS_LIST_VOLS="" ZFS_PROPS="" GETFATTR_OUT=""
    CEPH_DETAIL="" CEPH_SIZE="" CEPH_MIN_SIZE="" RBD_INFO="" RBD_SHOWMAPPED=""
    ZPOOL_STATUS="" LSBLK_OUT="" LSBLK_PKNAME="" VIRT_OUT=""
    UNAME_S=Linux UNAME_R=6.8.0-test FIO_VER=fio-3.36
    : >"$TMP/calls"
}
uname() { case "$1" in -s) echo "$UNAME_S" ;; -r) echo "$UNAME_R" ;; esac; }
fio() { echo "fio $*" >>"$TMP/calls"; echo "$FIO_VER"; }
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
zpool() { echo "zpool $*" >>"$TMP/calls"; [ -n "$ZPOOL_STATUS" ] && printf '%s\n' "$ZPOOL_STATUS"; return 0; }
lsblk() {
    echo "lsblk $*" >>"$TMP/calls"
    if [[ " $* " == *" PKNAME "* ]]; then
        # the parent of the parent is empty (whole disk)
        if [ -n "$LSBLK_PKNAME" ] && [ "${*: -1}" != "/dev/$LSBLK_PKNAME" ]; then echo "$LSBLK_PKNAME"; fi
    elif [ -n "$LSBLK_OUT" ]; then
        echo "$LSBLK_OUT"
    fi
    return 0
}
systemd-detect-virt() {
    echo "systemd-detect-virt $*" >>"$TMP/calls"
    echo "${VIRT_OUT:-none}"
    [ -n "$VIRT_OUT" ] && [ "$VIRT_OUT" != none ]
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

# --- fixtures ----------------------------------------------------------------------------
ZFS_FS_PROPS=$'sync\tdisabled\nrecordsize\t16K\nvolblocksize\t-\ncompression\tlz4\nprimarycache\tall\nlogbias\tlatency'
ZFS_VOL_PROPS=$'sync\talways\nrecordsize\t-\nvolblocksize\t64K\ncompression\toff\nprimarycache\tmetadata\nlogbias\tthroughput'
CEPH_DETAIL_OUT="pool 1 '.mgr' replicated size 3 min_size 2 crush_rule 0 object_hash rjenkins
pool 2 'rbdpool' replicated size 3 min_size 2 crush_rule 0 object_hash rjenkins pg_num 32
pool 3 'ecdata' erasure profile k2m1 size 3 min_size 2 crush_rule 1
pool 4 'cephfs_data' replicated size 2 min_size 1 crush_rule 0"

# `zpool status -P` output: TAB, then two spaces per level
ZPOOL_MIRROR=$'  pool: tank\n state: ONLINE\n  scan: scrub repaired 0B in 00:01:02 with 0 errors\nconfig:\n
\tNAME                                    STATE     READ WRITE CKSUM
\ttank                                    ONLINE       0     0     0
\t  mirror-0                              ONLINE       0     0     0
\t    /dev/disk/by-id/ata-SSD_A-part1     ONLINE       0     0     0
\t    /dev/disk/by-id/ata-SSD_B-part1     ONLINE       0     0     0
\tlogs
\t  /dev/disk/by-id/nvme-LOG-part1        ONLINE       0     0     0
\tcache
\t  /dev/disk/by-id/nvme-CACHE-part2      ONLINE       0     0     0
\tspares
\t  /dev/disk/by-id/ata-SPARE-part1       AVAIL
\nerrors: No known data errors'
ZPOOL_RAIDZ2X2=$'  pool: nvme-a\n state: ONLINE\nconfig:\n
\tNAME                    STATE     READ WRITE CKSUM
\tnvme-a                  ONLINE       0     0     0
\t  raidz2-0              ONLINE       0     0     0
\t    /dev/nvme0n1p1      ONLINE       0     0     0
\t    /dev/nvme1n1p1      ONLINE       0     0     0
\t    /dev/nvme2n1p1      ONLINE       0     0     0
\t    /dev/nvme3n1p1      ONLINE       0     0     0
\t  raidz2-1              ONLINE       0     0     0
\t    /dev/nvme4n1p1      ONLINE       0     0     0
\t    /dev/nvme5n1p1      ONLINE       0     0     0
\t    /dev/nvme6n1p1      ONLINE       0     0     0
\t    /dev/nvme7n1p1      ONLINE       0     0     0
\tspecial
\t  mirror-2              ONLINE       0     0     0
\t    /dev/nvme8n1p1      ONLINE       0     0     0
\t    /dev/nvme9n1p1      ONLINE       0     0     0
\tdedup
\t  /dev/nvme10n1p1       ONLINE       0     0     0
\nerrors: No known data errors'
ZPOOL_DRAID=$'  pool: big\n state: ONLINE\nconfig:\n
\tNAME                      STATE     READ WRITE CKSUM
\tbig                       ONLINE       0     0     0
\t  draid2:4d:12c:1s-0      ONLINE       0     0     0
\t    /dev/sda              ONLINE       0     0     0
\t    /dev/sdb              ONLINE       0     0     0
\tspares
\t  draid2-0-0              AVAIL
\nerrors: No known data errors'
ZPOOL_STRIPE=$'  pool: scratch\n state: ONLINE\nconfig:\n
\tNAME          STATE     READ WRITE CKSUM
\tscratch       ONLINE       0     0     0
\t  /dev/sdc     ONLINE       0     0     0
\t  /dev/sdd     ONLINE       0     0     0
\t  /dev/sde     ONLINE       0     0     0
\nerrors: No known data errors'
ZPOOL_MIXED=$'  pool: odd\n state: ONLINE\nconfig:\n
\tNAME          STATE     READ WRITE CKSUM
\todd           ONLINE       0     0     0
\t  mirror-0    ONLINE       0     0     0
\t    /dev/sdc   ONLINE       0     0     0
\t    /dev/sdd   ONLINE       0     0     0
\t  raidz1-1    ONLINE       0     0     0
\t    /dev/sde   ONLINE       0     0     0
\t    /dev/sdf   ONLINE       0     0     0
\t    /dev/sdg   ONLINE       0     0     0
\t  indirect-2  ONLINE       0     0     0
\nerrors: No known data errors'

STORAGE_DETECT=1 IOENGINE=io_uring TARGET_IS_DEVICE=false
TARGET_DIR="$TMP/target"
mkdir -p "$TARGET_DIR"
SI_ZVOL_DIR="$TMP/zvol" SI_RBD_DEV_DIR="$TMP/rbddev" SI_RBD_SYSFS="$TMP/sysrbd"
SI_SYS_ROOT="$TMP/root"
mkdir -p "$TMP/dev" "$SI_ZVOL_DIR/tank" "$SI_RBD_DEV_DIR/rbdpool" "$SI_RBD_SYSFS/0" "$SI_SYS_ROOT/sys"
