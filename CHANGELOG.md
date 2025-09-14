# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
