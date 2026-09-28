#!/usr/bin/env bash
# Tests for ZFS pool layout, disk and virtualization detection, the wrapped
# "Storage:" summary and the 4 KB cap of STORAGE_INFO in fio-test.sh
# (run: bash scripts/tests/test_storage_hw.sh)
# Setup, stubs and fixtures: storage_test_lib.bash. The sysfs/DMI tree lives under
# SI_SYS_ROOT ($TMP/root) and mimics a Proxmox VM (virtio-scsi sda, virtio-blk vda).

# shellcheck disable=SC2034,SC2329  # config vars and stubs are used by the sourced functions

# shellcheck source=storage_test_lib.bash
source "$(dirname "$0")/storage_test_lib.bash"

# --- zpool layout parser ----------------------------------------------------------------
layout_of() { ZPOOL_STATUS=$2; storage_zpool_layout "$1"; }
reset_stubs
check "layout: mirror, logs/cache/spares ignored" "mirror 1" "$(layout_of tank "$ZPOOL_MIRROR")"
check "zpool asked with -P for the pool" 1 "$(grep -cx 'zpool status -P tank' "$TMP/calls")"
check "layout: 2x raidz2, special/dedup ignored" "raidz2 2" "$(layout_of nvme-a "$ZPOOL_RAIDZ2X2")"
check "layout: draid2, draid spare ignored" "draid2 1" "$(layout_of big "$ZPOOL_DRAID")"
check "layout: plain disks are a stripe" "stripe 3" "$(layout_of scratch "$ZPOOL_STRIPE")"
check "layout: mirror + raidz1 is mixed, indirect ignored" "mixed 2" "$(layout_of odd "$ZPOOL_MIXED")"
check "layout: other pool name gives nothing" "" "$(layout_of other "$ZPOOL_MIRROR")"
check "layout: old raidz-N naming is raidz1" "raidz1 1" \
    "$(layout_of p $'config:\n\tp  ONLINE\n\t  raidz-0  ONLINE\n\t    /dev/sda  ONLINE')"
: >"$TMP/calls"
check "layout: dash pool name not passed" "" "$(layout_of -x "$ZPOOL_MIRROR")"
check "layout: dash pool name, zpool not called" 0 "$(grep -c '^zpool' "$TMP/calls")"
MISSING="timeout gtimeout zpool"
check "layout: without zpool nothing" "" "$(layout_of tank "$ZPOOL_MIRROR")"

# --- pool fields in STORAGE_INFO ----------------------------------------------------------
reset_stubs
FINDMNT_OUT="zfs nvme-a/fio" ZFS_LIST_DIR="nvme-a/fio" ZFS_PROPS="$ZFS_FS_PROPS" ZPOOL_STATUS="$ZPOOL_RAIDZ2X2"
detect_storage
check "zfs: pool name" nvme-a "$(json_get "$STORAGE_INFO" '["zfs"]["pool"]')"
check "zfs: pool_layout" raidz2 "$(json_get "$STORAGE_INFO" '["zfs"]["pool_layout"]')"
check "zfs: pool_vdevs is a number" "2 int" \
    "$(json_get "$STORAGE_INFO" '["zfs"]["pool_vdevs"], type(json.loads(sys.argv[1])["zfs"]["pool_vdevs"]).__name__')"
check "zfs: no disk detection for datasets" 0 "$(grep -c '^lsblk' "$TMP/calls")"

: >"$TMP/dev/zd32"
ln -sf "$TMP/dev/zd32" "$SI_ZVOL_DIR/tank/vm-100-disk-0"
reset_stubs
TARGET_IS_DEVICE=true TARGET_DIR="$SI_ZVOL_DIR/tank/vm-100-disk-0"
ZFS_PROPS="$ZFS_VOL_PROPS" ZPOOL_STATUS="$ZPOOL_MIRROR"
detect_storage
check "zvol: pool and layout" "tank mirror 1" \
    "$(python3 -c 'import json,sys; d=json.loads(sys.argv[1])["zfs"]; print(d["pool"], d["pool_layout"], d["pool_vdevs"])' "$STORAGE_INFO")"
check "zvol: no disk detection" 0 "$(grep -c '^lsblk' "$TMP/calls")"
SUMMARY=$(storage_summary)
check "summary: zvol with every zfs value" \
    "fs=block zfs=tank/vm-100-disk-0 (zvol) sync=always volblocksize=64K compression=off primarycache=metadata logbias=throughput pool=tank layout=mirror vdevs=1 kernel=6.8.0-test ioengine=io_uring fio=3.36" \
    "$(printf '%s' "$SUMMARY" | tr '\n' ' ' | tr -s ' ')"
check "summary: zvol: every line fits 110 columns with the label" 0 \
    "$(printf 'Storage:      %s\n' "$SUMMARY" | awk 'length > 110' | wc -l | tr -d ' ')"
check "summary: zvol: continuation lines indented 14 spaces" "$(( $(printf '%s\n' "$SUMMARY" | wc -l) - 1 ))" \
    "$(printf '%s\n' "$SUMMARY" | sed -n '2,$p' | grep -c '^              [^ ]')"
TARGET_IS_DEVICE=false TARGET_DIR="$TMP/target"

# --- pool layout plausibility ----------------------------------------------------------------
plaus_pool() {  # plaus_pool <drive_type> <layout> <vdevs>
    DRIVE_MODEL=m DRIVE_TYPE=$1 PROTOCOL=Local TARGET_IS_DEVICE=false
    SI_FS_TYPE=zfs SI_ZFS_DATASET=nvme-a/fio SI_ZFS_TYPE=filesystem SI_ZFS_SYNC="" SI_ZFS_RECORDSIZE=""
    SI_ZFS_VOLBLOCKSIZE="" SI_ZFS_POOL=nvme-a SI_ZFS_POOL_LAYOUT=$2 SI_ZFS_POOL_VDEVS=$3
    : >"$TMP/warnings"
    storage_plausibility_checks
}
plaus_pool mirror raidz2 2
check "mirror on raidz2 pool warns" 1 "$STORAGE_WARNINGS"
check "warning text" "WARN: DRIVE_TYPE 'mirror' but pool nvme-a is raidz2 (2 vdevs)" "$(cat "$TMP/warnings")"
plaus_pool raidz2 raidz2 2;       check "raidz2 on raidz2: ok" 0 "$STORAGE_WARNINGS"
plaus_pool RAIDZ2 raidz2 1;       check "RAIDZ2 (upper case) on raidz2: ok" 0 "$STORAGE_WARNINGS"
plaus_pool raidz raidz3 1;        check "raidz matches raidz3" 0 "$STORAGE_WARNINGS"
plaus_pool raidz mirror 1;        check "raidz on mirror warns" 1 "$STORAGE_WARNINGS"
check "singular vdev in warning" 1 "$(warn_count 'is mirror (1 vdev)$')"
plaus_pool raidz draid2 1;        check "raidz on draid warns" 1 "$STORAGE_WARNINGS"
plaus_pool raidz1 raidz2 1;       check "raidz1 on raidz2 warns" 1 "$STORAGE_WARNINGS"
plaus_pool draid draid2 1;        check "draid matches draid2" 0 "$STORAGE_WARNINGS"
plaus_pool draid1 draid2 1;       check "draid1 on draid2 warns" 1 "$STORAGE_WARNINGS"
plaus_pool stripe stripe 3;       check "stripe on stripe: ok" 0 "$STORAGE_WARNINGS"
plaus_pool stripe mirror 2;       check "stripe on mirror warns" 1 "$STORAGE_WARNINGS"
plaus_pool mirror mixed 2;        check "mirror on mixed pool warns" 1 "$STORAGE_WARNINGS"
plaus_pool nvme raidz2 2;         check "no layout in DRIVE_TYPE: no warning" 0 "$STORAGE_WARNINGS"
plaus_pool vm-raidz1 raidz1 1;    check "vm-raidz1 on visible raidz1 pool: ok" 0 "$STORAGE_WARNINGS"
plaus_pool vm-mirror raidz1 1;    check "vm-mirror on visible raidz1 pool warns" 1 "$STORAGE_WARNINGS"
plaus_pool mirror "" "";          check "unknown layout: no warning" 0 "$STORAGE_WARNINGS"

# --- sysfs / DMI tree of a Proxmox VM ------------------------------------------------------------
S="$SI_SYS_ROOT/sys"
PCI="$S/devices/pci0000:00"
SCSI="$PCI/0000:00:05.0/virtio1/host2/target2:0:0/2:0:0:1"
VIRTIO_BLK="$PCI/0000:00:0a.0/virtio2"
mkdir -p "$S/bus/scsi/drivers/sd" "$S/bus/virtio/drivers/virtio_scsi" "$S/bus/virtio/drivers/virtio_blk" \
    "$S/bus/pci/drivers/virtio-pci" "$S/class/block" "$S/block" "$S/class/dmi/id" \
    "$SCSI/block/sda/sda1" "$SCSI/block/sda/queue" "$VIRTIO_BLK/block/vda/vda1" "$S/devices/virtual/block/dm-0/slaves"
: >"$SCSI/block/sda/sda1/partition"; : >"$VIRTIO_BLK/block/vda/vda1/partition"
ln -s "$S/bus/scsi/drivers/sd" "$SCSI/driver"
ln -s "$S/bus/virtio/drivers/virtio_scsi" "$PCI/0000:00:05.0/virtio1/driver"
ln -s "$S/bus/pci/drivers/virtio-pci" "$PCI/0000:00:05.0/driver"
ln -s "$S/bus/virtio/drivers/virtio_blk" "$VIRTIO_BLK/driver"
ln -s "$S/bus/pci/drivers/virtio-pci" "$PCI/0000:00:0a.0/driver"
ln -s "$SCSI" "$SCSI/block/sda/device"
ln -s "$VIRTIO_BLK" "$VIRTIO_BLK/block/vda/device"
for d in "$SCSI/block/sda" "$SCSI/block/sda/sda1" "$VIRTIO_BLK/block/vda" "$VIRTIO_BLK/block/vda/vda1" \
    "$S/devices/virtual/block/dm-0"; do
    ln -s "$d" "$S/class/block/${d##*/}"
done
ln -s "$SCSI/block/sda" "$S/block/sda"; ln -s "$VIRTIO_BLK/block/vda" "$S/block/vda"
ln -s "$S/class/block/sda1" "$S/devices/virtual/block/dm-0/slaves/sda1"
printf 'QEMU HARDDISK   \n' >"$SCSI/model"; printf 'QEMU    \n' >"$SCSI/vendor"
echo 1 >"$SCSI/block/sda/queue/rotational"
echo QEMU >"$S/class/dmi/id/sys_vendor"
echo "Standard PC (Q35 + ICH9, 2009)" >"$S/class/dmi/id/product_name"

LSBLK_SDA='MODEL="QEMU HARDDISK" VENDOR="QEMU    " SERIAL="drive-scsi1" TRAN="" ROTA="1" SIZE="32G"'
check "parent of sda1 is sda" sda "$(storage_parent_disk sda1)"
check "parent of dm-0 (single slave sda1) is sda" sda "$(storage_parent_disk dm-0)"
check "whole disk stays" vda "$(storage_parent_disk vda)"
check "virtio-scsi driver above the sd driver" virtio_scsi "$(storage_disk_driver sda)"
check "virtio-blk driver" virtio_blk "$(storage_disk_driver vda)"
check "no sysfs entry: no driver" "" "$(storage_disk_driver sdz)"

# --- Proxmox VM: xfs on a virtio-scsi disk -------------------------------------------------------
reset_stubs
UNAME_R=7.0.14-17-pve FIO_VER=fio-3.39 VIRT_OUT=kvm
FINDMNT_OUT="xfs /dev/sda1" LSBLK_OUT="$LSBLK_SDA"
detect_storage
echo "# Proxmox VM example: $STORAGE_INFO"
check "vm: valid JSON" ok "$(valid_json "$STORAGE_INFO")"
check "vm: disk object" \
    '{"name":"sda","model":"QEMU HARDDISK","vendor":"QEMU","serial":"drive-scsi1","driver":"virtio_scsi","rotational":1,"size":"32G"}' \
    "$(json_sub "$STORAGE_INFO" disk)"
check "vm: virt object" '{"type":"kvm","vendor":"QEMU","product":"Standard PC (Q35 + ICH9, 2009)"}' \
    "$(json_sub "$STORAGE_INFO" virt)"
check "vm: lsblk asked for the parent disk" 1 "$(grep -c '^lsblk -dn -P -o MODEL,VENDOR,SERIAL,TRAN,ROTA,SIZE /dev/sda$' "$TMP/calls")"
check "vm: no zfs object" "<none>" "$(json_get "$STORAGE_INFO" '["zfs"]')"
SUMMARY=$(storage_summary)
check "vm summary: all values, in order" \
    'fs=xfs disk=sda model="QEMU HARDDISK" vendor=QEMU serial=drive-scsi1 driver=virtio_scsi rotational=1 size=32G virt=kvm dmi="QEMU Standard PC (Q35 + ICH9, 2009)" kernel=7.0.14-17-pve ioengine=io_uring fio=3.39' \
    "$(printf '%s' "$SUMMARY" | tr '\n' ' ' | tr -s ' ')"
check "vm summary: wrapped (more than one line)" 1 "$([ "$(printf '%s\n' "$SUMMARY" | wc -l)" -gt 1 ] && echo 1 || echo 0)"
check "vm summary: every line fits 110 columns with the label" 0 \
    "$(printf 'Storage:      %s\n' "$SUMMARY" | awk 'length > 110' | wc -l | tr -d ' ')"
check "vm summary: continuation indented 14 spaces" 1 "$(printf '%s\n' "$SUMMARY" | sed -n 2p | grep -c '^              [^ ]')"

# --- virtio-blk via device-mapper-free partition, sysfs fallback, lsblk PKNAME -------------------
reset_stubs
FINDMNT_OUT="ext4 /dev/vda1" LSBLK_OUT='MODEL="" VENDOR="0x1af4" SERIAL="" TRAN="" ROTA="1" SIZE="64G"'
detect_storage
check "virtio-blk: empty fields omitted" \
    '{"name":"vda","vendor":"0x1af4","driver":"virtio_blk","rotational":1,"size":"64G"}' "$(json_sub "$STORAGE_INFO" disk)"
check "bare metal (virt none): no virt object" "<none>" "$(json_get "$STORAGE_INFO" '["virt"]')"

reset_stubs
MISSING="timeout gtimeout lsblk"
FINDMNT_OUT="xfs /dev/sda1[/subvol]"
detect_storage
check "no lsblk: model/vendor/rotational from sysfs, [subvol] stripped" \
    '{"name":"sda","model":"QEMU HARDDISK","vendor":"QEMU","driver":"virtio_scsi","rotational":1}' \
    "$(json_sub "$STORAGE_INFO" disk)"

reset_stubs
FINDMNT_OUT="ext4 /dev/nvme0n1p2" LSBLK_PKNAME=nvme0n1
LSBLK_OUT='MODEL="Samsung SSD 980 PRO 1TB" VENDOR="" SERIAL="S5GXNX0T" TRAN="nvme" ROTA="0" SIZE="931.5G"'
detect_storage
check "no sysfs entry: parent via lsblk PKNAME" nvme0n1 "$(json_get "$STORAGE_INFO" '["disk"]["name"]')"
check "nvme: transport and rotational 0" "nvme 0" \
    "$(json_get "$STORAGE_INFO" '["disk"]["transport"], json.loads(sys.argv[1])["disk"]["rotational"]')"

reset_stubs
: >"$TMP/dev/sdb"
TARGET_IS_DEVICE=true TARGET_DIR="$TMP/dev/sdb" LSBLK_OUT="$LSBLK_SDA"
detect_storage
check "device target: the device itself" sdb "$(json_get "$STORAGE_INFO" '["disk"]["name"]')"
TARGET_IS_DEVICE=false TARGET_DIR="$TMP/target"

for src in "nfs4 srv:/export" "tmpfs tmpfs" "ceph 10.0.0.1:6789:/"; do
    reset_stubs
    FINDMNT_OUT=$src LSBLK_OUT="$LSBLK_SDA"
    detect_storage
    check "no disk for non-block source '$src'" "<none> 0" \
        "$(json_get "$STORAGE_INFO" '["disk"]') $(grep -c '^lsblk' "$TMP/calls")"
done

# --- virtualization variants ----------------------------------------------------------------------
reset_stubs
VIRT_OUT=lxc FINDMNT_OUT="zfs tank/subvol-101-disk-0"
detect_storage
check "container: type only, no host DMI" '{"type":"lxc"}' "$(json_sub "$STORAGE_INFO" virt)"
reset_stubs
MISSING="timeout gtimeout systemd-detect-virt"
FINDMNT_OUT="xfs /dev/sda1"
detect_storage
check "no systemd-detect-virt: no virt object" "<none>" "$(json_get "$STORAGE_INFO" '["virt"]')"

# --- ceph summary shows every field ----------------------------------------------------------------
: >"$TMP/dev/rbd0"
echo rbdpool >"$SI_RBD_SYSFS/0/pool"; echo img1 >"$SI_RBD_SYSFS/0/name"
reset_stubs
TARGET_IS_DEVICE=true TARGET_DIR="$TMP/dev/rbd0" CEPH_DETAIL="$CEPH_DETAIL_OUT"
RBD_INFO=$'\torder 22 (4 MiB objects)\n\tdata_pool: ecdata'
detect_storage
check "summary: ceph fields" \
    "fs=block ceph=rbd pool=rbdpool image=img1 object_size=4194304 data_pool=ecdata pool_type=erasure pool_size=3 min_size=2 kernel=6.8.0-test ioengine=io_uring fio=3.36" \
    "$(storage_summary | tr '\n' ' ' | tr -s ' ' | sed 's/ $//')"
TARGET_IS_DEVICE=false TARGET_DIR="$TMP/target"

# --- 4 KB cap: drop ceph, disk, virt, zfs (in that order) --------------------------------------------
BIG=$(printf 'x%.0s' {1..5000})
under_4k() { [ "$(LC_ALL=C; echo "${#STORAGE_INFO}")" -lt 4096 ] && echo 1 || echo 0; }
keys() { python3 -c 'import json,sys; print(" ".join(json.loads(sys.argv[1])))' "$STORAGE_INFO"; }

reset_stubs
VIRT_OUT=kvm FINDMNT_OUT="xfs /dev/sda1" LSBLK_OUT="MODEL=\"$BIG\" SIZE=\"32G\""
detect_storage
check "huge disk model: disk dropped, virt kept" "fs_type kernel os ioengine fio_version virt" "$(keys)"
check "huge disk model: below 4 KB" 1 "$(under_4k)"

reset_stubs
VIRT_OUT=kvm FINDMNT_OUT="xfs /dev/sda1" LSBLK_OUT="$LSBLK_SDA"
echo "$BIG" >"$S/class/dmi/id/product_name"
detect_storage
echo "Standard PC (Q35 + ICH9, 2009)" >"$S/class/dmi/id/product_name"
check "huge DMI product: disk and virt dropped" "fs_type kernel os ioengine fio_version" "$(keys)"

reset_stubs
VIRT_OUT=kvm FINDMNT_OUT="zfs tank/fio" ZFS_PROPS=$'compression\t'"$BIG"
detect_storage
check "huge zfs value: zfs and virt dropped, kernel/fio_version kept" "fs_type kernel os ioengine fio_version" "$(keys)"
check "huge zfs value: below 4 KB" 1 "$(under_4k)"

finish
