#!/usr/bin/env bash
# Tests for storage detection (STORAGE_INFO), plausibility warnings and the
# storage_info upload field of fio-test.sh
# (run: bash scripts/tests/test_storage_info.sh)
# Setup, stubs and fixtures: storage_test_lib.bash (df, mount and curl are stubbed here).
# Pool layout, disk and virtualization detection: test_storage_hw.sh

# shellcheck disable=SC2034,SC2329  # config vars and stubs are used by the sourced functions

# shellcheck source=storage_test_lib.bash
source "$(dirname "$0")/storage_test_lib.bash"

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

# --- ZFS filesystem ------------------------------------------------------------------
reset_stubs
FINDMNT_OUT="zfs    tank/fio" ZFS_LIST_DIR="tank/fio" ZFS_PROPS="$ZFS_FS_PROPS" ZPOOL_STATUS="$ZPOOL_MIRROR"
detect_storage
check "zfs filesystem: exact JSON" \
    '{"fs_type":"zfs","kernel":"6.8.0-test","os":"Linux","ioengine":"io_uring","fio_version":"fio-3.36","zfs":{"dataset":"tank/fio","type":"filesystem","sync":"disabled","recordsize":"16K","compression":"lz4","primarycache":"all","logbias":"latency","pool":"tank","pool_layout":"mirror","pool_vdevs":1}}' \
    "$STORAGE_INFO"
check "zfs filesystem: valid JSON" ok "$(valid_json "$STORAGE_INFO")"
check "zfs filesystem: volblocksize '-' skipped" "<none>" "$(json_get "$STORAGE_INFO" '["zfs"]["volblocksize"]')"
check "zfs list is asked for the target dir" 1 "$(grep -c "^zfs list -H -o name $TARGET_DIR$" "$TMP/calls")"

reset_stubs
FINDMNT_OUT="zfs tank/from-mount" ZFS_LIST_DIR="" ZFS_PROPS="$ZFS_FS_PROPS"
detect_storage
check "zfs dataset falls back to the mount source" tank/from-mount "$(json_get "$STORAGE_INFO" '["zfs"]["dataset"]')"

reset_stubs
MISSING="timeout gtimeout zfs zpool"
FINDMNT_OUT="zfs tank/nocli"
detect_storage
check "zfs without CLI: dataset, type and pool name only" '{"dataset":"tank/nocli","type":"filesystem","pool":"tank"}' \
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
check "darwin: no lsblk/zpool/systemd-detect-virt" 0 "$(grep -Ec '^(lsblk|zpool|systemd-detect-virt)' "$TMP/calls")"

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
FINDMNT_OUT="zfs tank/fio" ZFS_LIST_DIR="tank/fio" ZFS_PROPS="$ZFS_FS_PROPS" ZPOOL_STATUS="$ZPOOL_MIRROR"
detect_storage
SUMMARY=$(storage_summary)
check "summary: zfs filesystem, all values in order" \
    "fs=zfs zfs=tank/fio sync=disabled recordsize=16K compression=lz4 primarycache=all logbias=latency pool=tank layout=mirror vdevs=1 kernel=6.8.0-test ioengine=io_uring fio=3.36" \
    "$(printf '%s' "$SUMMARY" | tr '\n' ' ' | tr -s ' ')"
check "summary: zfs filesystem: every line fits 110 columns with the label" 0 \
    "$(printf 'Storage:      %s\n' "$SUMMARY" | awk 'length > 110' | wc -l | tr -d ' ')"
check "summary: zfs filesystem: continuation lines indented 14 spaces" "$(( $(printf '%s\n' "$SUMMARY" | wc -l) - 1 ))" \
    "$(printf '%s\n' "$SUMMARY" | sed -n '2,$p' | grep -c '^              [^ ]')"

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
    SI_ZFS_RECORDSIZE=$2 SI_ZFS_VOLBLOCKSIZE="" SI_ZFS_POOL="" SI_ZFS_POOL_LAYOUT="" SI_ZFS_POOL_VDEVS=""
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
SI_ZFS_RECORDSIZE="" SI_ZFS_VOLBLOCKSIZE=16K SI_ZFS_POOL="" SI_ZFS_POOL_LAYOUT="" SI_ZFS_POOL_VDEVS=""
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
check "zfs props: dash value not passed to zfs/zpool" 0 "$(grep -Ec '^(zfs|zpool) ' "$TMP/calls")"
: >"$TMP/calls"
storage_ceph_pool "--cluster=evil"
check "ceph pool: dash value not passed to ceph" 0 "$(grep -c '^ceph ' "$TMP/calls")"

finish
