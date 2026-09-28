# Changelog

All notable changes to FIO Analyzer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

> **Upgrade note - back up the database first.** On the first start the backend rebuilds the `test_runs` table so that the client count becomes part of its unique key (migration 9). Stop the container and copy `data/backend/db/storage_performance.db` (Docker) or `backend/db/storage_performance.db` before upgrading. The migration keeps every row, index and view; existing results get `clients = 1`.

### Added
- **Multi-client runs**: uploads of `fio --client=… job.fio` output (fio client mode) are recognised. Each step is stored once with the metrics of fio's "All clients" result and `clients` = number of clients; per-client results (IOPS, bandwidth, latencies, error, storage_info of that client) go to the new `client_results` table. New optional upload fields: `ramp_uuid`, `client_hosts`, `client_storage_info`
- **New endpoints** (viewer role is enough, all read-only):
  - `GET /api/ramp/runs` - list of client ramps (per `ramp_uuid`) with configuration, client counts and step count; filters `hostname`, `run_uuid`, `limit`
  - `GET /api/ramp/runs/{ramp_uuid}` - all steps of a ramp with aggregate metrics and per-client results
  - `GET /api/ramp/runs/{ramp_uuid}/summary?threshold_ms=100` - highest client count within the P95 threshold, first count above it, highest aggregate IOPS, per-client IOPS drop and per-step fairness (slowest / fastest client)
  - `GET /api/raw/ramps/{ramp_uuid}` - ZIP with the raw fio JSON of every step of a ramp
- **fio-test.sh server mode** (`./fio-test.sh --server`): starts `fio --server` on the address in `FIO_SERVER_BIND` (required; `0.0.0.0` and `::` are refused) and port `FIO_SERVER_PORT` (8765). It also publishes the storage detection of `TARGET_DIR` on a read-only info port (`FIO_SERVER_INFO_PORT`, default 8766). The server stops with Ctrl-C, `--server-stop` or after `FIO_SERVER_TIMEOUT` (default 2h). A warning at start explains that fio's server has no authentication and shows nftables/iptables rules that allow only the controller
- **fio-test.sh controller mode** (`CLIENTS=host[:port[:infoport]],…`): runs every test with `fio --client` on all clients at once, using the usual `NUM_JOBS`, `IODEPTH`, `TEST_SIZE`, `RUNTIME`, `SYNC` and `PREFILL` per client. `TARGET_DIR` is a path on the clients and may be a block device. `RAMP_CLIENTS=1,2,4,…` repeats each test with a growing number of clients; all steps share one `ramp_uuid`. `PREFILL` runs once per client before the first step. A missing or failed client marks the step `incomplete:1`. Each step uploads fio's combined result plus every client's result and storage configuration
- **fio-test.sh SSH tunnel mode** (`CLIENT_SSH=1`): for servers bound to `127.0.0.1`, the controller reaches each client through `ssh -N -L` (key login, BatchMode), so no port is open on the network

### Changed
- **Database**: `test_runs` keeps one latest row per configuration *and* client count, so a 4-client step no longer replaces the single-host result of the same configuration
- **Comparison**: strict matching also requires the same client count; loose mode reports `clients` in `mismatch`, and the Compare page shows the client count of multi-client rows
### Security
- **Import**: fio JSON with `NaN`, `Infinity` or overflowing numbers, and metrics that are not numbers (e.g. `"iops": "1"`), are rejected with 400; stored, they made every response containing the row fail. Invalid UTF-8 now gives 400 instead of 500
- **Ramps**: a `ramp_uuid` may only contain letters, digits and `_ . : -`, cannot be reused for another test configuration (409), and is limited to 500 steps / 20,000 client results (413)
- **Bulk import**: `.info` metadata files can only set the known string fields (hostname, protocol, drive type/model, description, date, UUIDs)
- **fio-test.sh server mode**:
  - `FIO_SERVER_BIND` must be a concrete address. Every spelling of "all interfaces" (`0.0.0.0`, `::`, `0::0`, `::ffff:0.0.0.0`, leading zeros) is refused.
  - A loopback bind as root is refused unless `FIO_SERVER_ALLOW_ROOT=1` is set; otherwise any local user could run commands as root through fio.
  - The state directory must be owned by the user and not writable by others. Its files are written without following symlinks.
  - `--server-stop` only kills processes whose start time and owner match the PID file.
- **fio-test.sh controller mode**:
  - fio's client/server protocol has no authentication, so a client can request files from the controller. The script warns about this without `CLIENT_SSH=1` and runs fio from a private work directory.
  - SSH tunnels check that the local port is free and that ssh is still running.
  - Client info downloads are size-limited and bypass proxies.
  - `exec_*` options in `FIO_EXTRA_ARGS` and `external:` I/O engines are refused.
  - A step only counts as complete with exactly one result per client.
- **fio-test.sh**:
  - Upload credentials are passed to curl through a config file descriptor instead of `-u user:password`, so they no longer show up in `ps`.
  - The script warns when the default `uploader/uploader` login is still in use.

## [0.11.2] - 2026-09-28

### Added
- **Comparison**: responses include `match_counts` (strict vs. loose) and a `hint` when strict matching finds fewer configurations, e.g. "0 configurations match exactly, 26 match when test size, runtime and file layout are ignored"; the Compare page shows it with one-click fixes
- **fio-test.sh**: storage detection also records the ZFS pool layout (`pool`, `pool_layout` mirror/raidz1-3/draid/stripe/mixed, `pool_vdevs`) and warns when `DRIVE_TYPE` contradicts it (e.g. `mirror` on a raidz2 pool)
- **fio-test.sh**: storage detection records the disk below the target (model, vendor, serial, transport, driver such as virtio_scsi/virtio_blk/nvme, rotational, size) and, inside VMs, the hypervisor (`systemd-detect-virt`, DMI vendor/product), so VM runs can be told apart without relying on `DRIVE_MODEL`

### Changed
- **fio-test.sh**: the `Storage:` header line shows every detected value (also primarycache, pool layout, disk, hypervisor, kernel, ioengine, fio version) and wraps at 110 columns
- **Comparison**: the default source is now `newest` - the newest comparable run of each target from the full history. With the old default (`latest`, still available) a newer run with another layout (e.g. prefill) hid the older comparable run, so strict comparisons could come back empty
### Security
- **fio-test.sh**: values from sysfs, DMI and storage tools are stripped of control characters before they are printed (no terminal escape sequences from a crafted disk model or VM product name); device names from `lsblk`/sysfs must be plain names; `SI_*` detection variables can no longer be set from `.env`
- **Comparison**: the handler runs in a worker thread and a request is limited to 200,000 rows across all targets (50,000 per target from the history)

## [0.11.1] - 2026-09-28

### Added
- **Storage configuration per test run**: uploads can carry a `storage_info` JSON object (filesystem, ZFS dataset/volume properties, Ceph pool/image details, kernel, ioengine, fio version); it is stored with every test run, returned by `/api/test-runs`, `/api/test-runs/{id}` and `saturation-data`, and shown in the test run details and on the Saturation page
- **Compare page** (`/compare`, admin and viewer): pick 2–10 targets (first = baseline) and see the difference per pattern × block size as coloured matrices (median of several configurations per cell, filters for jobs, IO depth, direct, sync mode, tags, date range), a summary per target and all configurations as a table; strict matching can be switched off. Saturation tab: best step within the P95 threshold of several saturation runs side by side
- **fio-test.sh**: detects the storage configuration before the run (filesystem of `TARGET_DIR`; ZFS dataset or zvol with sync, recordsize/volblocksize, compression, primarycache, logbias; Ceph RBD image or CephFS with pool, replication/erasure coding; kernel, ioengine, fio version), shows it in the header and uploads it as `storage_info`. Warns when `DRIVE_MODEL`/`DRIVE_TYPE` contradict it, e.g. `-syncoff` but ZFS `sync=standard`, `-rs16k` but `recordsize=128K`, or `raidz`/`mirror` on a non-ZFS target. `STORAGE_DETECT=0` turns it off
- **API**: `GET /api/compare/targets` lists every Host-Protocol-Type-Model combination with test runs as ready-to-use `target` values

### Changed
- **fio-test.sh**: With several saturation runs (block sizes × `SAT_SYNC`), the header no longer shows a run_uuid that is never used; the real run_uuids are listed at the end
- **Comparison**: `/api/compare` now only matches identical configurations by default (`strict=true`): test size, duration and the file layout tags (`prefill`, `fileperjob`, `satcap`) must match too, so smoke tests or prefilled runs are no longer compared with regular runs. `strict=false` restores the looser matching and lists differing fields per row in `mismatch`; the summary reports `configs_mismatched`
### Security
- **API**: `storage_info` values that cannot be served as JSON (`NaN`, `Infinity`, extreme nesting) are rejected; one such upload could otherwise break the test-run list for every user
- **fio-test.sh**: all upload metadata is sent with `--form-string`; before, a value starting with `@` or `<` (e.g. in `DRIVE_MODEL`) made curl read and upload a local file
- **fio-test.sh**: storage detection never passes values starting with `-` to `zfs`, `ceph` or `rbd`


## [0.11.0] - 2026-09-28

### Added
- **fio-test.sh**: fio runs that fail with a transient EAGAIN error (seen with io_uring on reads ending at the end of the test file) are retried up to `FIO_RETRY_MAX` times (default 2, `0` = off); other errors are never retried, and the summary shows how many retries were needed
- **Viewer role (read-only)**: viewers see all analysis pages and data but cannot upload, edit or delete. Stored in `.htviewers`; create with `manage_users.py add --viewer` or in User Management. Docker: run `touch data/auth/.htviewers` before upgrading, otherwise Docker creates a directory for the new mount
- **API**: `tags` (e.g. `prefill:1,fileperjob:1`), `since`/`until` and `run_uuid` filters on `/api/test-runs` and `/api/time-series/all`; `tags` and `run_uuid` on `/api/time-series/history`
- **API**: Download raw fio JSON: `GET /api/raw/test-runs/{id}` (one test run, `source=latest|history|saturation`) and `GET /api/raw/runs/{run_uuid}` (whole run incl. saturation steps as ZIP with `index.json`). UI: "Raw JSON" in the test run details and "Raw JSON (ZIP)" on the Saturation page
- **fio-test.sh**: `SAT_SYNC` accepts a list (e.g. `sync,dsync`); each block size × sync mode is its own saturation run
- **Saturation summary**: `GET /api/saturation/runs/{run_uuid}/summary` returns per pattern the step with the highest IOPS within the P95 threshold and the first step that crossed it; also shown as a table on the Saturation page. fio-test.sh now sends the threshold with saturation uploads and the server stores it (older runs: pass `threshold_ms`)
- **Comparison**: `GET /api/compare?target=…&target=…` compares 2–10 Host-Protocol-Type-Model combinations (partial or `*`) per pattern, block size, sync mode, direct, numjobs and iodepth, with the difference in % to the first target and a median summary; supports `source=history` and the tag/date/run filters
- **Import log**: every upload attempt is recorded (imported, rejected with reason, or error). `GET /api/import-log/runs/{run_uuid}` counts attempts and stored rows per run; `GET /api/import-log/` lists attempts with filters
- **fio-test.sh**: `SAT_MAX_TOTAL_SIZE` caps the total file size with `FILE_PER_JOB=1` in saturation mode (per-job size = cap / numjobs, at least 1M); tagged `satcap:<size>` in the description

### Changed
- **Saturation page**: the chart uses the threshold stored with the run instead of always 100 ms (runs from fio-test.sh with `--threshold 20` were shown against the wrong line); a "P95 threshold" field overrides it
- **API**: Authenticated users without the required role now get HTTP 403 instead of 401, so the web UI no longer logs them out

### Security
- **Upload**: `hostname`, `protocol` and the file name are sanitized before they are used in the storage path; before, an uploader account could write files outside the uploads directory (path traversal)

### Fixed
- **fio-test.sh**: With an explicitly chosen sync engine (`-i psync`), saturation mode escalated iodepth instead of numjobs

## [0.10.8] - 2026-09-27

### Added
- **fio-test.sh**: `PREFILL=1` writes test files once with incompressible data and reuses them across tests, so reads no longer hit unwritten/fallocated extents or zero data squashed by ZFS compression
- **fio-test.sh**: `FILE_PER_JOB=1` gives every fio job its own file instead of all jobs sharing one
- **fio-test.sh**: `KEEP_JSON_DIR` keeps a copy of every fio JSON result; `FIO_EXTRA_ARGS` appends extra fio options to every benchmark run
- **fio-test.sh**: Runs with `PREFILL`/`FILE_PER_JOB` are tagged `prefill:1` / `fileperjob:1` in the description; all new options are off by default

### Changed
- **Sync mode is stored as text** (`none`, `sync`, `dsync`) instead of 0/1, so O_DSYNC runs are kept apart from O_SYNC runs. Existing data is converted automatically on startup (0 → `none`, 1 → `sync`). API filters accept the names and still accept legacy 0/1. The Host filter shows "None", "Sync (O_SYNC)" and "DSync (O_DSYNC)"

### Fixed
- **Import**: Uploads with `sync=dsync` failed with HTTP 500; unknown sync values now return HTTP 400 with a clear message
- **API**: An invalid `syncs` filter on `/api/test-runs` and `/api/time-series/*` returned HTTP 500 instead of 400
- **fio-test.sh**: `--description` was dropped in saturation mode; saturation uploads now keep it (`saturation-test,<description>,...`)

## [0.10.7] - 2026-09-26

### Added
- **Backend**: `GET /api/dashboard/stats` aggregates dashboard numbers in SQL; the dashboard no longer downloads ~1 MB of test runs to count them

### Fixed
- **Host Analysis**: Hosts with more than 1000 latest test runs were silently truncated to 1000; all pages are now loaded

## [0.10.6] - 2026-09-26

### Added
- **UI**: Shared app shell on every page: one header with all sections (Dashboard, Hosts, History, Saturation, Upload, Admin, Users), active-page highlight, mobile menu, skip link and a consistent footer
- **UI**: Role-aware navigation. Uploader accounts see only Upload and land there after login; admin-only pages show an "Access denied" page instead of failing API calls
- **UI**: 404 page for unknown routes
- **UI**: Page state in the URL (shareable, survives reload): Host selection, view and all filters; History host, time range, metrics and configurations; Saturation host/run/compare selection; Admin tab and search
- **UI**: Toast notifications and a confirmation dialog replace `alert()` / `confirm()`
- **UI**: Dashboard redesign: task cards, "Tested hosts" table with deep links into Host Analysis and History, first-run "Get started" guide when the database is empty
- **UI**: Metric help tooltips (IOPS, bandwidth, latency percentiles) and descriptions for every Host visualization; visualizations grouped into Summary / Compare / Relationships / Trends
- **UI**: Empty states with next steps on Host, History and Saturation pages
- **Upload**: Working drag and drop, file type check, collapsible fio command examples, success banner with "View results" link; host metadata is kept for the next upload instead of redirecting away
- **Frontend**: Playwright E2E smoke tests (`npm run test:e2e`, see `frontend/e2e/`)

### Changed
- **Repo**: `.claude/` (Claude Code settings and speckit commands) is no longer tracked and is now listed in `.gitignore`
- **Docs**: `AGENTS.md` is the single agent instruction file (English-by-default rule, project facts merged from `CLAUDE.md`, stale references removed); `CLAUDE.md` now only imports it; past milestones moved to `INFRASTRUCTURE.md`
- **History**: Loads data on first visit (previously the chart stayed empty until a host was picked), defaults to the host with the most tests, metric checkboxes instead of multi-select lists, unit-aware axis labels
- **Host Analysis**: Hosts load in parallel; hosts that fail to load are reported instead of silently skipped
- **Admin**: Split the 3000-line page into `pages/admin/` (one file per tab, modals and hooks); default tab is now "Latest Runs"; each tab explains what it lists; edits and deletes confirm with a toast

### Fixed
- **Upload**: Failed imports were reported as successful; the server's error message is now shown
- **UI**: Buttons rendered their icon above the label instead of beside it
- **UI**: `hover:theme-*` classes had no effect
- **UI**: History page header overlapped the sidebar
- **Admin**: Bulk update by UUID now URL-encodes the UUID query parameter
- **Admin**: Hierarchy tab mislabeled protocol/type/model for hostnames containing `-` (e.g. `server-01`); labels now come from the run data

### Removed
- Unused frontend code (legacy `HostSelector`, `PerformanceMatrix`, unused services/utils) and the unused `react-parallel-coordinates` and `@types/react-router-dom` packages
- Debug `console.log` output in dashboard statistics, history and chart hooks

## [0.10.5] - 2026-02-20

### Fixed
- **fio-test.sh**: Saturation test now detects sync engines (psync/sync/vsync) and escalates only numjobs — iodepth is ignored by these engines, so 75% of QD escalation steps were previously ineffective

## [0.10.4] - 2026-02-18

### Added
- **Admin**: Saturation tab in Admin page — view, edit (description/metadata), and delete saturation runs grouped by run_uuid
- **Backend**: `PUT /saturation-runs/bulk-by-uuid` and `DELETE /saturation-runs/by-uuid` endpoints for managing saturation runs

### Fixed
- **Admin**: Edit/delete handlers now check API response for errors instead of silently assuming success — fixes views not refreshing after edits across all tabs
- **Admin**: Clear cached expanded UUID group runs after edit/delete so data refreshes properly


## [0.10.3] - 2026-02-18

### Fixed
- **Frontend**: Saturation chart Y-axis now rescales when hiding patterns via legend click in compare mode — previously stayed locked at shared max from all data

### Removed
- **Sweet Spot**: Removed sweet spot concept entirely from backend, frontend, and fio-test.sh — saturation point detection remains
  - Backend: Removed sweet_spot calculation from saturation data endpoint
  - Frontend: Removed green row highlighting and sweet spot legend from SaturationChart
  - fio-test.sh: Removed SAT_P_SWEET_SPOT tracking, green *SWEET* markers, and sweet spot summary section

### Changed
- **fio-test.sh**: Consolidated root-level `fio-test.sh` into `scripts/fio-test.sh` (root copy removed)
- **Backend**: Saturation test data now stored in dedicated `saturation_runs` table instead of `test_runs`/`test_runs_all`
  - New imports route saturation data (`description LIKE 'saturation-test%'`) to `saturation_runs` only, skipping `update_latest_flags`
  - Saturation query endpoints (`/saturation-runs`, `/saturation-data`) now read from `saturation_runs`
  - Normal endpoints (`/test-runs`, time-series, filters) no longer return saturation rows
  - Migration 4 auto-creates `saturation_runs` table on backend startup (idempotent)
  - Standalone migration script (`backend/scripts/migrate_saturation_data.py`) moves existing saturation data


## [0.10.2] - 2026-02-18

### Added
- **Frontend**: Side-by-side saturation run comparison — two-step host→run selectors, optional second run for visual comparison with synchronized Y-axis scaling
- **Frontend**: `useSaturationRunData` and `useSaturationRuns` hooks for independent run data loading
- **Frontend**: Dedicated Saturation Analysis page (`/saturation`) with its own route, header navigation button, and Home page quick action/link
- **fio-test.sh**: 19 new CLI flags for all parameters (`--hostname`, `--protocol`, `--drive-type`, `--drive-model`, `--description`, `--test-size`, `--num-jobs`, `--runtime`, `--direct`, `--sync`, `--iodepth`, `--block-sizes`, `--patterns`, `--target-dir`, `--backend-url`, `-U/--username`, `-P/--password`, `--config-uuid`, `--max-steps`)
- **fio-test.sh**: Proper precedence chain: CLI flags > env vars / .env file > hardcoded defaults

### Changed
- **Frontend**: Refactored `SaturationChart` into a pure display component (data via props, no internal selectors or data fetching)
- **Frontend**: Saturation page now uses host→run two-step selection instead of flat dropdown
- **Frontend**: Moved Saturation Test from Host page visualization to standalone page — `useSaturationData` hook no longer depends on `DriveAnalysis[]`, loads all runs by default
- **Frontend**: Removed saturation button from Host page visualization controls (14 views → 13)
- **fio-test.sh**: Replaced monolithic `set_defaults()` with focused functions: `define_defaults()`, `apply_cli_overrides()`, `generate_uuids()`, `build_description()`, `validate_saturation_config()`, `convert_scalars_to_arrays()`, `init_config()`
- **fio-test.sh**: Replaced 8 copy-pasted array parsing blocks with single `parse_csv_to_array()` helper (unconditional parsing, no fragile default-check skipping)
- **fio-test.sh**: DESCRIPTION now built in single `build_description()` function (was duplicated in 3 places)
- **fio-test.sh**: Help text reorganized with categorized sections and corrected defaults

### Fixed
- **fio-test.sh**: RUNTIME default mismatch — was `20` in set_defaults but `30` in array parsing. Unified to `30`
- **fio-test.sh**: TEST_SIZE default mismatch — was `100M` in set_defaults but `10M` in array parsing. Unified to `10M`
- **fio-test.sh**: MAX_TOTAL_QD help text said `4096` but code used `16384`. Fixed help to match code
- **fio-test.sh**: USERNAME/PASSWORD help text said `admin` but code used `uploader`. Fixed help to match code
- **fio-test.sh**: DESCRIPTION uninitialized in non-saturation mode caused leading comma in metadata string
- **fio-test.sh**: SYNC and IODEPTH had no scalar defaults, causing empty SAT_SYNC in saturation mode
- **fio-test.sh**: `detect_ioengine()` psync fallback set IODEPTH as scalar after array conversion. Now runs before array conversion
- **fio-test.sh**: CLI flags were overwritten by .env file loading. Now CLI flags take proper highest priority


## [0.10.1] - 2026-02-17

### Added
- **Saturation Test**: All 6 valid FIO patterns supported (`randread`, `randwrite`, `randrw`, `read`, `write`, `rw`) with slot-based validation
- **Saturation Test**: Default block size changed to 64k (from 4k) for more realistic saturation testing
- **Saturation Test**: `--max-qd` CLI option and `MAX_TOTAL_QD` default raised to 16384
- **Saturation Test**: Progress summary table printed after each step (live results during test)
- **Saturation Test**: Accepts both `SAT_BLOCK_SIZE` (singular) and `SAT_BLOCK_SIZES` (plural) in `.env`

### Changed
- **Saturation Test**: Summary table redesigned — single QD column, P95 before IOPS, only enabled pattern columns shown, BW column removed
- **Saturation Test**: FIO JSON extraction rewritten with jq for reliable parsing (jq now required for saturation mode)
- **Frontend**: Saturation chart uses same color per pattern for IOPS/latency pairing (solid=IOPS, dashed=latency) for clarity

### Fixed
- **Saturation Test**: Write IOPS/BW incorrectly read as 0 — `tail -1` was hitting FIO's trim section instead of write section; fixed with jq
- **Saturation Test**: `.env` inline comments now stripped correctly (e.g., `IODEPTH=16 # comment` parses as `16`)
- **Saturation Test**: Pattern validation rejects invalid patterns and duplicate slots (e.g., both `read` and `randread`)
- **Saturation Test**: "Never saturated" fallback uses dynamic pattern names instead of hardcoded `randread`/`randwrite`/`randrw`
- **Frontend**: Fixed dark mode colors in saturation summary table (borders, text, row highlights, P95 threshold color)
- **Frontend**: Fixed `theme-border` (non-existent class) → `theme-border-primary` on table and select dropdown

## [0.10.0] - 2026-02-17

### Added
- **Saturation Test Mode** (`fio-test.sh --saturation`): Integrated mode to find maximum IOPS while keeping P95 completion latency below a configurable threshold
  - Configurable patterns via `SAT_PATTERNS` (default: randread, randwrite, randrw) — each escalates QD independently
  - Multiple block sizes via `SAT_BLOCK_SIZES` (comma-separated, e.g., `4k,64k,128k`) — each block size gets its own `run_uuid` and runs a full independent saturation loop
  - Independent saturation detection per pattern — read typically sustains higher QD before saturating
  - iodepth-biased QD escalation (3:1 ratio iodepth:numjobs) — avoids shm exhaustion at high job counts
  - `MAX_TOTAL_QD` safety cap (default: 4096) configurable via `.env` or `--max-qd`
  - P95 clat extraction from FIO JSON output using grep/awk (no jq dependency)
  - Sweet spot detection (best performance within SLA threshold)
  - Color-coded P95 display: green (<70%), yellow (70-100%), bold red (>100% of threshold) with `>>>` markers
  - Colorized summary table with sweet spot and saturation markers
  - CLI options: `--saturation`, `--threshold`, `--block-size`, `--sat-patterns`, `--initial-iodepth`, `--initial-numjobs`
  - `.env` configuration with `--generate-env` support
- **Backend API**: Two new endpoints for saturation test data
  - `GET /api/test-runs/saturation-runs` - List all saturation test runs with summary (includes `block_size`)
  - `GET /api/test-runs/saturation-data?run_uuid=...` - Detailed step-by-step data with sweet spot/saturation point calculation (includes `block_size`)
  - Database index on `run_uuid` for query performance
- **Frontend**: Saturation Test visualization view
  - New "Saturation Test" button in Host visualization controls
  - Dual Y-axis line chart (IOPS + P95 Latency) with logarithmic X-axis for Total Outstanding I/O
  - Horizontal threshold line at configurable latency limit
  - Sweet spot markers (larger points) on chart
  - Run selector dropdown filtered by selected hosts
  - Summary table with green (sweet spot) and red (saturation) row highlighting
- **Enhanced Test Output**: Rich latency and performance metrics displayed after every FIO test
  - Normal mode: IOPS, avg/P70/P95/P99 latency, and bandwidth shown after each test
  - Saturation mode: Per-step output with threshold usage percentage, best-so-far IOPS tracking with ★ marker, avg/P70/P95/P99 latency breakdown
  - Saturation loop uses P95 for threshold decision, outputs P70 and P95 for visibility
  - New helper functions: `extract_avg_clat_ms()`, `extract_p70_clat_ms()`, `extract_p99_clat_ms()` for additional latency metrics
- `fio-test.sh`: Support for testing directly on block devices (e.g., `/dev/sda`, `/dev/nvme0n1`)
  - Auto-detects if TARGET_DIR is a block device
  - Verifies device is not mounted before testing
  - Requires explicit "yes" confirmation for destructive operations

### Fixed
- **Saturation Mode**: Production hardening across script, backend, and frontend
  - Script: Separate `config_uuid` for saturation mode (derived via md5 hash of normal config-uuid)
  - Script: Scalar `SAT_DIRECT`/`SAT_SYNC`/`SAT_RUNTIME`/`SAT_TEST_SIZE` variables instead of array expansion
  - Script: Extraction functions (`extract_p95_clat_ms`, `extract_iops_value`, `extract_bw_mbs`) return "ERR" on failure instead of silent "0"
  - Script: `sanitize_fio_json()` strips non-JSON prefix lines (FIO `note:` warnings) from output before upload and extraction
  - Script: Fixed sweet spot off-by-one (was step-2, now correctly step-1)
  - Script: Numeric validation on `--threshold`, `--initial-iodepth`, `--initial-numjobs` CLI args
  - Script: Upload failures logged with warning instead of silently ignored
  - Backend: Fixed `iodepth or 1` falsiness bug (0 was treated as falsy, replaced with `is not None`)
  - Backend: Improved sweet spot calculation — skips steps with missing/invalid P95, tracks last-within-SLA correctly
  - Backend: Added `threshold_ms` bounds validation (0.01–100000ms)
  - Backend: Added pagination (`limit`/`offset`) to `GET /api/test-runs/saturation-runs`
  - Frontend: Added AbortController cleanup to `useSaturationData` hook (prevents memory leaks)
  - Frontend: Fixed `chartOptions` stale dependency array — now updates when scale type changes
  - Frontend: Graceful fallback to linear X-axis when only 1 data point (logarithmic needs >= 2)
  - Frontend: Dark mode support for threshold line label
  - Frontend: Added `aria-label` to run selector dropdown
  - Frontend: Updated empty state to reference `fio-test.sh --saturation`

## [0.9.0] - 2025-11-22

### Added
- 

## [0.8.3] - 2025-11-21

### Added
- 

## [0.8.2] - 2025-11-21

### Added
- 

## [0.8.1] - 2025-11-21

### Added
- 

## [0.8.0] - 2025-11-21

### Added
- 

## [0.7.2] - 2025-11-20

### Added
- 

## [0.7.1] - 2025-11-20

### Added
- 

## [0.7.0] - 2025-11-19

### Added
- 

## [0.6.11] - 2025-11-16

### Added
- 

## [0.6.10] - 2025-11-16

### Added
- 

## [0.6.9] - 2025-11-16

### Added
- 

## [0.6.8] - 2025-11-16

### Added
- 

## [0.6.7] - 2025-11-16

### Added
- 

## [0.6.6] - 2025-11-16

### Added
- 

## [0.6.5] - 2025-11-16

### Added
- 

## [0.6.4] - 2025-11-16

### Added
- 

## [0.6.3] - 2025-11-16

### Added
- 

## [0.6.2] - 2025-11-16

### Added
- 

## [0.6.1] - 2025-11-16

### Added
- 

## [0.6.0] - 2025-11-16

### Added
- 

## [0.5.11] - 2025-10-09

### Added
- 

## [0.5.10] - 2025-09-27

### Changed
- **Host Page URL Structure**: Removed hostname from URL path for cleaner navigation
  - Changed route from `/host/:hostname?` to `/host` in App.tsx
  - Updated Host.tsx to no longer use hostname from URL parameters
  - Modified useHostData hook to remove URL-based hostname navigation
  - Host selection now works without including hostname in the URL
- **Host Page Empty State**: Host page now starts empty requiring user to select hosts
  - Removed auto-selection of first available host
  - Added dedicated empty state UI with host selector
  - Users must explicitly choose hosts before analysis begins
  - Improved user experience with clear selection interface
  - Fixed loading state logic to properly show empty state instead of spinner
  - Fixed refresh button spinning unnecessarily in empty state

### Fixed
- **Performance Graphs Dark Mode**: Fixed text visibility issues in dark mode across all Performance Graphs components
  - Updated PerformanceMatrix gradient text colors to use `text-gray-900 dark:text-gray-100` for proper contrast
  - Fixed all chart components (IOPSComparisonChart, LatencyAnalysisChart, BandwidthTrendsChart, ResponsivenessChart) to use theme-aware CSS classes
  - Replaced hardcoded `text-muted-foreground` and `text-foreground` classes with proper dark mode variants
  - Updated chart container backgrounds to use `bg-white dark:bg-gray-800` with proper border colors
  - Fixed button and control styling to use appropriate dark mode colors
  - All text now properly visible in both light and dark themes
- Resolve all flake8 warnings (29 total)
  - Remove unused imports (F401): Union, HTTPException, log_info, Depends, HTTPBasicCredentials, List, log_warning, field, sys, Set, Any, Dict, File, Form, UploadFile, require_auth, TestRun, dataclass_to_dict, Optional
  - Fix f-strings without placeholders (F541): Convert unnecessary f-strings to regular strings
  - Remove unused variables (F841): metadata_path, test_run_id, placeholders, user_type
  - Add missing imports: Path, os, asdict for proper functionality
- Add .flake8 configuration file with default exclusions for .venv, venv, __pycache__, .git
- Update documentation to remove redundant --max-line-length=180 parameters from flake8 commands
- **Docker Configuration Cleanup**: Comprehensive optimization and modernization of Docker setup
  - Fixed health-check.sh script permissions (now properly executable for container health checks)
  - Removed deprecated Docker Compose version field to eliminate deployment warnings  
  - Cleaned up nginx configuration by removing 40+ lines of commented-out code
  - Updated documentation references from Node.js/Express to Python FastAPI backend
  - Streamlined SQLite-web service comments and removed unused proxy rules
  - Added inline documentation to Dockerfile for better maintainability
  - All Docker Compose files now validate without warnings
  - Modernized configuration syntax for production readiness
- **Backend Code Quality**: Comprehensive linting improvements across all Python files
  - Applied Black formatter for consistent code formatting (27 files reformatted)
  - Organized imports with isort for alphabetical consistency (18 files fixed)
  - Removed 25+ unused imports across all modules
  - Fixed missing critical imports (Path, os, asdict, HTTPException)
  - Eliminated trailing whitespace and standardized file endings
  - Installed flake8, black, isort, and ruff for ongoing code quality
  - Reduced linting violations from 100+ to 4 minor non-critical issues
  - All Python files now compile successfully without syntax errors

### Added
- 

## [0.5.9] - 2025-09-26

### Added
- **Performance Graphs Visualization**: New interactive chart-based visualization option alongside Performance Heatmap
  - IOPS Comparison Chart: Line chart comparing IOPS performance across block sizes and patterns
  - Latency Analysis Chart: Multi-axis chart displaying average, P95, and P99 latency metrics
  - Bandwidth Trends Chart: Area chart for bandwidth performance visualization with trend analysis
  - Responsiveness Chart: Horizontal bar chart for system responsiveness comparison
  - Comprehensive theme support (dark/light mode) with Chart.js integration
  - Interactive filtering and metric selection controls
  - Performance-optimized rendering for large datasets 

## [0.5.8] - 2025-09-14

### Added
- 

## [0.5.7] - 2025-09-14

### Fixed
- Authentication API calls from nested routes (e.g., /host/redshark) by using absolute paths instead of relative paths
- Latency values of 0.00ms were not displaying in Performance Fingerprint Heatmap hover tooltips due to incorrect null coalescing
- Multi-host filtering issues when selecting 2+ hosts - key mismatch between filter logic and heatmap processing
- Performance Fingerprint Heatmap dark mode styling issues with borders, backgrounds, and bar colors
- ESLint warning about unused variable in hostAnalysis.ts

### Added
- Comprehensive VITE_API_URL documentation in AGENTS.md
- Performance Fingerprint Heatmap visualization with comprehensive data analysis features
- Mini bar graphs in Performance Fingerprint Heatmap cells showing three metrics: IOPS (blue), Bandwidth (green), Responsiveness (1000/Latency, red)
- Each bar displays normalized performance percentage relative to the host/drive maximum
- Updated legend with metric color coding and improved layout
- Enhanced cell tooltips with detailed multi-dimensional performance data
- IOPS numbers prominently displayed at the top of each heatmap cell with clear labeling
- Responsiveness values shown in tooltips with "ops/ms" units and calculation explanation
- User-friendly explanation of how Responsiveness is calculated (1000 ÷ Latency)

### Enhanced
- Performance Fingerprint Heatmap cell display: larger IOPS numbers with "IOPS:" label, removed redundant debug text for cleaner appearance
- Performance Fingerprint Heatmap tooltips now display latency in nanoseconds instead of milliseconds for better precision
- Performance Fingerprint Heatmap includes detailed Responsiveness calculation explanation and actual values
- Reordered visualization controls: Performance Heatmap now appears second after Overview for better user experience
- Performance Fingerprint Heatmap bars now normalize against visible/filtered data for fair comparison within current view

### Removed
- Performance Matrix visualization option from host analysis interface

## [0.5.6] - 2025-09-14

### Fixed
- VITE_API_URL configuration in GitHub Actions Docker build

### Added

## [0.5.5] - 2025-09-14

### Added

## [0.5.4] - 2025-09-14

## [0.5.3] - 2025-09-XX

### Changed
- Updated project documentation and cleanup
- Removed deprecated agent markdown files
- Removed unused prompt creation markdown file
- Removed tests-with-browser directory and associated files
- Removed deprecated command markdown files

### Fixed
- VERSION file path resolution for Docker environment

### Added
- Comprehensive agents documentation (AGENTS.md)
- API endpoint documentation generation script
- Enhanced error handling and test configuration validation

## [0.5.1] - 2025-08-XX

### Added
- Support for selecting number of jobs in host filters
- Interactive stacked bar chart visualization with customizable stacking options
- Configuration files for Claude and MCP server integration
- Complete pagination coverage for all time-series components
- Comprehensive pagination system for time-series data
- Display all time series data functionality
- Script to kill processes on specified ports (kill-ports.sh)

### Fixed
- Update datetime handling to use timezone-aware timestamps
- Admin.tsx data loading optimization

### Changed
- Update default mode in Claude settings
- Remove .mcp.json configuration file

## [0.5.0] - 2025-08-XX

### Added
- Version display from VERSION file to frontend footer and backend APIs
- LICENSE.txt file with GNU General Public License v3.0

### Fixed
- Remove unnecessary sleep command from Docker startup script
- Resolve venv shebang path issue in Docker container
- Correct virtual environment path in Docker container

### Performance
- Optimize Docker build to prebuild virtual environment

## [0.4.3] - 2025-08-XX

### Changed
- Update Docker configuration and version bump

---

## Version History Notes

- **Current Version**: 0.5.3 (as per VERSION file)
- **Development Timeline**: Active development with frequent feature additions and improvements
- **Key Features**: FIO benchmark analysis, interactive charts, automated testing, authentication system
- **Technology Stack**: React + TypeScript frontend, Python FastAPI backend, SQLite database, Docker containerization

## Contributing

This changelog is maintained automatically based on commit messages following [Conventional Commits](https://conventionalcommits.org/) format:

- `feat:` - New features
- `fix:` - Bug fixes
- `chore:` - Maintenance tasks
- `docs:` - Documentation updates
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `test:` - Testing related changes
- `ci:` - CI/CD related changes

## Types of Changes

### Features
- Major functionality additions and enhancements
- New API endpoints and UI components
- Integration with external tools and services

### Fixes
- Bug fixes and error corrections
- Security vulnerability patches
- Performance issue resolutions

### Maintenance
- Code refactoring and optimization
- Dependency updates
- Configuration changes
- Documentation updates

---

For the most up-to-date information, please refer to the [README.md](README.md) and project documentation.
