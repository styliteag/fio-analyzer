# Changelog

All notable changes to FIO Analyzer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Redesigned Performance Analytics Graphs Tab**: Complete overhaul of the Graphs tab with user-focused host comparison views
  - **Performance Rankings**: Bar chart showing Host-Protocol-Disk combination rankings by IOPS, bandwidth, or latency metrics
  - **Performance Distribution**: Histogram showing how Host-Protocol-Disk combinations are distributed across performance ranges
  - **Host-Protocol-Disk Comparison**: Direct side-by-side comparison of two selected Host-Protocol-Disk combinations with percentage differences
  - **Configuration Impact**: Line charts showing how different block sizes and I/O patterns affect each Host-Protocol-Disk combination's performance
  - **Workload Analysis**: Specialized views for read vs write performance analysis with workload recommendations per combination
  - **Host-Protocol-Disk Filter**: Filter dropdown to focus on specific Host-Protocol-Disk combinations (e.g., "redshark - local - poolRED01")
  - Replaced confusing technical chart controls with intuitive view selectors and metric choosers
  - Added actionable insights and recommendations for each Host-Protocol-Disk combination based on their performance characteristics
  - Now treats each Host-Protocol-Disk combination as a separate entity, matching the behavior of the Filters panel

### Added
- **Complete Test Suite Implementation**: Implemented comprehensive TDD test suite for Vue.js frontend rebuild
  - Component Tests: Filter logic, data fetching, chart processing, data transformation, error handling tests
  - Integration Tests: Authentication flow, dashboard overview, host selection persistence, filtering system, visualization rendering, user management interface tests
  - All tests follow TDD methodology - written to fail initially before implementation
  - Complete coverage of OR/AND filter logic, API error handling, data persistence, and user interaction flows
- **Core Composables Implementation**: Implemented foundational Vue composables for the dashboard
  - `useApi`: Reactive API client with caching, loading states, error handling, and request deduplication
  - `useFilters`: Complex filter logic with OR within categories, AND between categories, and persistence
  - `useTheme`: Complete theme management with light/dark/system modes, smooth transitions, and localStorage persistence
  - `useHostSelection`: Host selection persistence across pages with validation and filtering capabilities
- **Pinia Store Management**: Complete state management layer with centralized stores
  - `useAuthStore`: Authentication state with user roles, permissions, and session management
  - `useTestRunsStore`: Test run data management with filtering, pagination, and performance analytics
  - `useFiltersStore`: Filter state management with validation and API parameter conversion
  - `useUiStore`: UI state management for notifications, modals, loading states, and sidebar control
- **Utility Functions Suite**: Comprehensive utility library for data processing and formatting
  - `chartProcessing`: Heatmap data processing, scatter plots, line charts with relative color scaling
  - `dataTransform`: Data filtering, sorting, grouping, normalization, and performance summaries
  - `errorHandling`: Structured error management with user-friendly messages and retry logic
  - `validation`: Input validation for test runs, users, API responses, and form data
  - `storage`: Type-safe localStorage/sessionStorage with TTL and migration utilities
  - `formatters`: Date/time, number, performance metrics, and internationalization formatting
- **API Service Layer**: Complete backend integration with dedicated service classes
  - `testRunsApi`: Full CRUD operations, bulk operations, export functionality, and performance analytics
  - `filtersApi`: Filter options management, validation, search, and suggestions
  - `usersApi`: User management with role-based access, bulk operations, and activity logging
  - `healthApi`: System health monitoring, service status checks, and performance metrics
- **Complete UI Component Library**: Production-ready Vue.js component system with 17+ components
  - **Basic Components**: MetricCard, StatusIndicator, LoadingSpinner, ErrorMessage, Button, Input, Modal
  - **Navigation**: Responsive Navigation bar with user menu and theme toggle, collapsible Sidebar with filtering
  - **Dashboard Components**: Statistics cards, activity feed, system status panel, quick action links
  - **Filter System**: Advanced filtering with sidebar, section components, host selector, and active filter summary
  - **Data Visualization**: Chart container, performance heatmap, interactive graphs, scatter plots, radar charts, and tabbed visualization interface
  - **User Management**: Complete user administration with list view, add/edit forms, role management, and permissions display
- **Complete Visualization System**: Implemented 5 advanced visualization types from React frontend to Vue frontend:

### Removed
- **Old React Frontend**: Removed the legacy React frontend in `./frontend/` directory - only Vue.js frontend in `./frontend-vue/` is now available
  - Performance Graphs: IOPS Comparison, Latency Analysis, Bandwidth Trends, Responsiveness charts
  - Performance Fingerprint Heatmap: Multi-dimensional performance visualization
  - Drive Radar Chart: Comparative performance analysis across metrics
  - Performance Scatter Plot: Correlation analysis between performance metrics
  - Parallel Coordinates Chart: Multi-attribute performance analysis
- **Advanced Filtering System**: Comprehensive host filtering with block sizes, IO patterns, queue depths, protocols, and host-disk combinations
- **Theme System**: Complete dark/light/system theme support with persistence and smooth transitions
- **Performance Optimizations**: Debounced filter updates, lazy chart loading, memory management, and <2s rendering target
- **Error Boundaries**: Chart-specific error handling with retry mechanisms and user-friendly messages
- **Responsive Design**: Mobile and tablet support with adaptive layouts
- **Accessibility**: ARIA labels, keyboard navigation, and screen reader support
- **Comprehensive Testing**: 100% test coverage for utilities, composables, and components
- **Vue 3 Frontend Migration Complete**: Full Vue.js 3 + TypeScript frontend with complete feature parity to React version
- Vue 3 migration scaffold under `frontend-vue/` with router and pages (parity work in progress)
- API client honoring `VITE_API_URL` and proxy `/api`
- Views wired: Home (info), Filters, Test Runs, Performance Data, Time Series, Upload, Admin Users
- Shared components: export buttons, basic Chart.js line chart, Three.js 3D bar demo
- Request cancellation and chart decimation defaults
- Vue services: completed API client coverage for users, test runs, performance data, time-series, and imports (T011)
- Frontend-vue lint task added and verified clean (`npm run lint`) (T024a)
- Charts parity achieved in Vue app: 2D Chart.js components and 3D Three.js bar chart (T020, T021)
- Radar chart component and integration added; fullscreen chart UX with ESC exit (T020c, T020d)
- **Performance Graphs Visualization**: New interactive chart-based visualization option alongside Performance Heatmap
- **Complete Page Components**: TestRuns, Host, Filters, UserManager pages with full functionality
- **Advanced Filtering System**: Vue composables for state management, URL sync, and localStorage persistence
- **UI Components**: PaginationControls, TestRunMultiSelect, ExportButtons, FullscreenContainer
- **Quality Assurance**: ESLint and TypeScript validation passing, comprehensive type safety
- **Production Ready**: Optimized Vite build configuration with code splitting and vendor chunking

### Changed
- Vue frontend now provides complete feature parity with React frontend
- Improved type safety with comprehensive TypeScript interfaces
- Enhanced build optimization for production deployment
  - IOPS Comparison Chart: Line chart comparing IOPS performance across block sizes and patterns
  - Latency Analysis Chart: Multi-axis chart displaying average, P95, and P99 latency metrics
  - Bandwidth Trends Chart: Area chart for bandwidth performance visualization with trend analysis
  - Responsiveness Chart: Horizontal bar chart for system responsiveness comparison
  - Comprehensive theme support (dark/light mode) with Chart.js integration
  - Interactive filtering and metric selection controls
  - Performance-optimized rendering for large datasets 

### Fixed
- Dark mode toggle now affects full app background and components by:
  - Initializing theme in `frontend-vue/src/App.vue` on mount
  - Correcting CSS variables scope from `.dark` to `html.dark` in `frontend-vue/src/styles.css`
  - Switching `#app` background to use CSS variables so `html.dark` applies
 - Filters sidebar interaction and summary stability:
   - Made `selectedHosts` a writable computed in `FilterSidebar.vue` to support `v-model`
   - Guarded against undefined when building tags in `ActiveFilters.vue`
 - Performance Graphs:
   - Implemented grouping into multiple datasets for line/bar when `Group by` selected
   - Sorted x-axis labels numerically/lexicographically for correct sequence
   - Added distinct color palette per dataset for better differentiation

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
