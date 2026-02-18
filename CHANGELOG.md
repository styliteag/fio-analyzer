# Changelog

All notable changes to FIO Analyzer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- 

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
