# FIO I/O Engine Selection

## Overview

The `fio-test.sh` script now supports automatic detection and manual selection of I/O engines for optimal performance.

## Automatic Detection (Default)

When no engine is specified, the script automatically detects and uses the best available I/O engine in this priority order:

1. **io_uring** - Best performance (Linux kernel 5.1+)
2. **libaio** - Good async I/O performance (standard Linux async I/O)
3. **psync** - Fallback synchronous I/O (always available)

> **Note**: The script focuses on Linux-optimized engines. While `aio` (POSIX AIO) is also supported for manual selection, it's not included in auto-detection since `libaio` is superior on Linux systems.

### Example Output:
```bash
./fio-test.sh
# Output:
# [INFO] Auto-detecting best available I/O engine...
# [SUCCESS] io_uring engine is available - using for best performance
# [INFO] io_uring provides the best performance on modern Linux kernels (5.1+)
```

## Manual Engine Selection

You can manually specify an I/O engine using the `-i` or `--engine` option:

### Usage:
```bash
./fio-test.sh --engine io_uring
./fio-test.sh -i libaio
./fio-test.sh --engine psync
./fio-test.sh --engine aio  # POSIX AIO (if you need it)
```

### Supported Engines:
- `io_uring` - Modern async I/O (requires Linux 5.1+)
- `libaio` - Linux native async I/O (recommended for Linux)
- `aio` - POSIX async I/O (cross-platform, but slower than libaio on Linux)
- `psync` - POSIX synchronous I/O

### Example with Manual Selection:
```bash
./fio-test.sh --engine io_uring -e production.env
# Output:
# [INFO] Testing specified I/O engine: io_uring
# [SUCCESS] I/O engine 'io_uring' is available
```

### Error Handling:
If you specify an engine that's not available, the script will exit with an error:
```bash
./fio-test.sh --engine io_uring
# Output (if io_uring not available):
# [INFO] Testing specified I/O engine: io_uring
# [ERROR] Specified I/O engine 'io_uring' is not available
```

## Engine Characteristics

### io_uring (Recommended)
- **Performance**: Highest
- **Requirements**: Linux kernel 5.1+, liburing
- **Best for**: Modern systems, high-performance workloads
- **Async**: Yes (true async)
- **Notes**: Provides the lowest latency and highest throughput. The future of Linux I/O.

### libaio (Recommended for Linux)
- **Performance**: High
- **Requirements**: Linux with libaio library
- **Best for**: General Linux systems, production workloads
- **Async**: Yes (true async)
- **Notes**: Linux-native async I/O using kernel syscalls (`io_submit`, `io_getevents`). Widely supported and battle-tested.

### aio (POSIX AIO)
- **Performance**: Medium
- **Requirements**: POSIX-compliant systems
- **Best for**: Cross-platform compatibility, non-Linux systems
- **Async**: Partial (may use threads internally)
- **Notes**: POSIX standard async I/O (`aio_read`, `aio_write`). Generally slower than libaio on Linux. Use only if you need portability or libaio is not available.

### psync
- **Performance**: Lower
- **Requirements**: None (always available)
- **Best for**: Fallback, compatibility testing, synchronous workloads, **FreeBSD/TrueNAS Core**
- **Async**: No (synchronous)
- **Notes**: Synchronous I/O using `pwrite()`. **Always limited to `iodepth=1`** (the script automatically sets this when psync is detected).

> **⚠️ FreeBSD / TrueNAS Core Users**: FreeBSD systems (including TrueNAS Core) only support the `psync` engine, which is limited to `iodepth=1`. To achieve higher queue depths on these systems, **increase `NUM_JOBS` instead of `IODEPTH`**. 
>
> **Queue Depth Formula**: `Total Queue Depth = NUM_JOBS × IODEPTH`
>
> **Example**: To get a queue depth of 64 on FreeBSD:
> ```bash
> NUM_JOBS=64
> IODEPTH=1  # Always 1 for psync
> # Effective QD = 64 × 1 = 64
> ```

## libaio vs aio - What's the Difference?

This is a common source of confusion:

- **`libaio`** = Linux-specific, kernel-native async I/O (better performance)
- **`aio`** = POSIX standard async I/O (more portable, but slower on Linux)

**On Linux, always prefer `libaio` over `aio`** unless you have specific portability requirements.

## Configuration File

You can also set the engine in your `.env` file:

```bash
# In your .env file
IOENGINE=io_uring
```

Note: Command-line options override environment file settings.

## Complete Example

```bash
# Generate a config file
./fio-test.sh --generate-env test.env

# Edit test.env to set your parameters
# Then run with io_uring engine
./fio-test.sh --engine io_uring -e test.env -y

# Or let it auto-detect (will use io_uring if available)
./fio-test.sh -e test.env -y
```

## Verification

The selected engine is displayed in the configuration summary:

```
=========================================
FIO Performance Test Configuration
=========================================
Hostname:     myserver
Protocol:     local
...
I/O Engine:   io_uring
I/O Depth:    1
...
=========================================
```

## Troubleshooting

### io_uring not available
- Check kernel version: `uname -r` (needs 5.1+)
- Install liburing: `apt install liburing-dev` or `yum install liburing-devel`
- Rebuild fio with io_uring support

### libaio not available
- Install libaio: `apt install libaio-dev` or `yum install libaio-devel`
- Rebuild fio with libaio support

### All async engines unavailable
- The script will automatically fall back to `psync`
- Consider upgrading your system or rebuilding fio with async I/O support

## Recommendations

1. **Modern Linux (kernel 5.1+)**: Use `io_uring` for best performance
2. **Older Linux**: Use `libaio` (standard async I/O)
3. **FreeBSD / TrueNAS Core**: Use `psync` (only option) with `NUM_JOBS` for queue depth
4. **Cross-platform**: Use `aio` only if you need POSIX compatibility
5. **Fallback**: `psync` is always available but synchronous only

## FreeBSD / TrueNAS Core Configuration

FreeBSD systems (including TrueNAS Core) have limited I/O engine support and will automatically use `psync`.

### Key Differences:
- **Engine**: Only `psync` is available (no async engines)
- **IODEPTH**: Always forced to `1` (script sets this automatically)
- **Queue Depth**: Controlled via `NUM_JOBS` instead

### Example Configuration for TrueNAS Core:

```bash
# In your .env file for FreeBSD/TrueNAS Core
HOSTNAME="truenas-01"
PROTOCOL="local"
DRIVE_TYPE="raidz2"
DRIVE_MODEL="tank"

# Engine will auto-detect as psync
# IOENGINE=psync  # Optional, will be auto-detected

# For queue depth of 64, use NUM_JOBS instead of IODEPTH
NUM_JOBS="64"     # This controls queue depth on FreeBSD
IODEPTH="1"       # Always 1 for psync (auto-set by script)

# Other settings
TEST_SIZE="10G"
RUNTIME="60"
BLOCK_SIZES="4k,64k,128k,1M"
TEST_PATTERNS="read,write,randread,randwrite"
```

### Running on TrueNAS Core:

```bash
# The script will automatically detect psync and set IODEPTH=1
./fio-test.sh -e truenas.env -y

# Output will show:
# [WARNING] No async I/O engines available - falling back to psync
# [INFO] psync uses POSIX pwrite() - synchronous I/O only
```
