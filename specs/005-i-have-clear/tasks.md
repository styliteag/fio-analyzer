# Tasks: Rebuild Vue.js Frontend Dashboard

**Input**: Design documents from `/specs/005-i-have-clear/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/, quickstart.md

## Project Structure
**Web Application**: Vue.js frontend in `/frontend-vue/` directory connecting to existing FastAPI backend

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Phase 3.1: Setup and Project Structure

- [X] T001 Clean existing frontend-vue source files (keep only login functionality in src/)
- [X] T002 Update package.json dependencies: Ensure Vue 3.4+, TypeScript 5.4+, Pinia 2.1, Chart.js 4.4, Vue-ChartJs 5.3, Lucide Vue, TailwindCSS 3.4
- [X] T003 [P] Configure TypeScript with strict mode in frontend-vue/tsconfig.json
- [X] T004 [P] Configure Vitest test setup in frontend-vue/vite.config.ts with Vue Test Utils 2.4+
- [X] T005 [P] Configure ESLint and Prettier for TypeScript and Vue files
- [X] T006 [P] Setup TailwindCSS configuration for dark theme support in frontend-vue/tailwind.config.js

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests [P] - All Parallel
- [X] T007 [P] Contract test GET /api/test-runs in frontend-vue/src/services/api/__tests__/test-runs-api.spec.ts
- [X] T008 [P] Contract test GET /api/filters in frontend-vue/src/services/api/__tests__/filters-api.spec.ts
- [X] T009 [P] Contract test GET /api/test-runs/{id} in frontend-vue/src/services/api/__tests__/test-run-detail-api.spec.ts
- [X] T010 [P] Contract test GET /api/test-runs/performance-data in frontend-vue/src/services/api/__tests__/performance-api.spec.ts
- [X] T011 [P] Contract test GET /health in frontend-vue/src/services/api/__tests__/health-api.spec.ts
- [X] T012 [P] Contract test user management APIs in frontend-vue/src/services/api/__tests__/user-management-api.spec.ts

### Component Tests [P] - All Parallel
- [X] T013 [P] Authentication flow test in frontend-vue/src/composables/__tests__/useAuth.spec.ts
- [X] T014 [P] Filter logic test (OR within categories) in frontend-vue/src/composables/__tests__/useFilters.spec.ts
- [X] T015 [P] Data fetching test in frontend-vue/src/composables/__tests__/useApi.spec.ts
- [X] T016 [P] Chart data processing test in frontend-vue/src/utils/__tests__/chartProcessing.spec.ts
- [X] T017 [P] Data transformation test in frontend-vue/src/utils/__tests__/dataTransform.spec.ts
- [X] T018 [P] Error handling test in frontend-vue/src/utils/__tests__/errorHandling.spec.ts

### Integration Tests [P] - All Parallel
- [X] T019 [P] Authentication flow integration test in frontend-vue/src/components/__tests__/LoginForm.spec.ts
- [X] T020 [P] Dashboard overview integration test in frontend-vue/src/pages/__tests__/Dashboard.spec.ts
- [X] T021 [P] Host selection persistence test in frontend-vue/src/pages/__tests__/HostAnalysis.spec.ts
- [X] T022 [P] Filtering system integration test in frontend-vue/src/components/__tests__/FilterSidebar.spec.ts
- [X] T023 [P] Visualization rendering test in frontend-vue/src/components/__tests__/PerformanceHeatmap.spec.ts
- [X] T024 [P] User management interface test in frontend-vue/src/pages/__tests__/UserManager.spec.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Type Definitions [P] - All Parallel
- [X] T025 [P] TestRun interface in frontend-vue/src/types/testRun.ts
- [X] T026 [P] FilterOptions interface in frontend-vue/src/types/filters.ts
- [X] T027 [P] PerformanceMetrics interface in frontend-vue/src/types/performance.ts
- [X] T028 [P] VisualizationConfig interface in frontend-vue/src/types/visualization.ts
- [X] T029 [P] UserAccount and Auth interfaces in frontend-vue/src/types/auth.ts
- [X] T030 [P] API response interfaces in frontend-vue/src/types/api.ts
- [X] T031 [P] Component prop interfaces in frontend-vue/src/types/components.ts

### Composables and Business Logic
- [X] T032 Authentication composable (useAuth) in frontend-vue/src/composables/useAuth.ts
- [X] T033 API client composable (useApi) in frontend-vue/src/composables/useApi.ts
- [X] T034 Filters composable (useFilters) in frontend-vue/src/composables/useFilters.ts
- [X] T035 Theme composable (useTheme) in frontend-vue/src/composables/useTheme.ts
- [X] T036 Host selection composable (useHostSelection) in frontend-vue/src/composables/useHostSelection.ts

### State Management with Pinia
- [X] T037 [P] Auth store in frontend-vue/src/stores/auth.ts
- [X] T038 [P] Test runs store in frontend-vue/src/stores/testRuns.ts
- [X] T039 [P] Filters store in frontend-vue/src/stores/filters.ts
- [X] T040 [P] UI state store in frontend-vue/src/stores/ui.ts

### Utility Functions [P] - All Parallel
- [X] T041 [P] Chart data processing utilities in frontend-vue/src/utils/chartProcessing.ts
- [X] T042 [P] Data transformation utilities in frontend-vue/src/utils/dataTransform.ts
- [X] T043 [P] Error handling utilities in frontend-vue/src/utils/errorHandling.ts
- [X] T044 [P] Validation utilities in frontend-vue/src/utils/validation.ts
- [X] T045 [P] Local storage utilities in frontend-vue/src/utils/storage.ts
- [X] T046 [P] Date/time formatting utilities in frontend-vue/src/utils/formatters.ts

### API Service Layer
- [X] T047 HTTP client with error handling in frontend-vue/src/services/api/client.ts
- [X] T048 Test runs API service in frontend-vue/src/services/api/testRuns.ts
- [X] T049 Filters API service in frontend-vue/src/services/api/filters.ts
- [X] T050 User management API service in frontend-vue/src/services/api/users.ts
- [X] T051 Health check API service in frontend-vue/src/services/api/health.ts

## Phase 3.4: UI Components

### Basic Components [P] - All Parallel
- [X] T052 [P] MetricCard component in frontend-vue/src/components/ui/MetricCard.vue
- [X] T053 [P] StatusIndicator component in frontend-vue/src/components/ui/StatusIndicator.vue
- [X] T054 [P] LoadingSpinner component in frontend-vue/src/components/ui/LoadingSpinner.vue
- [X] T055 [P] ErrorMessage component in frontend-vue/src/components/ui/ErrorMessage.vue
- [X] T056 [P] Button component in frontend-vue/src/components/ui/Button.vue
- [X] T057 [P] Input component in frontend-vue/src/components/ui/Input.vue
- [X] T058 [P] Modal component in frontend-vue/src/components/ui/Modal.vue

### Navigation Components
- [X] T059 Navigation bar component in frontend-vue/src/components/Navigation.vue (update existing)
- [X] T060 Sidebar navigation component in frontend-vue/src/components/Sidebar.vue

### Dashboard Components
- [X] T061 Statistics cards section in frontend-vue/src/components/dashboard/StatsCards.vue
- [X] T062 Recent activity feed in frontend-vue/src/components/dashboard/RecentActivity.vue
- [X] T063 System status panel in frontend-vue/src/components/dashboard/SystemStatus.vue
- [X] T064 Quick links section in frontend-vue/src/components/dashboard/QuickLinks.vue

### Filter Components
- [X] T065 Filter sidebar container in frontend-vue/src/components/filters/FilterSidebar.vue
- [X] T066 Filter section component in frontend-vue/src/components/filters/FilterSection.vue
- [X] T067 Host selector with tags in frontend-vue/src/components/filters/HostSelector.vue
- [X] T068 Active filters summary in frontend-vue/src/components/filters/ActiveFilters.vue

### Visualization Components
- [X] T069 Chart container component in frontend-vue/src/components/charts/ChartContainer.vue
- [X] T070 Performance heatmap component in frontend-vue/src/components/charts/PerformanceHeatmap.vue
- [X] T071 Performance graphs component in frontend-vue/src/components/charts/PerformanceGraphs.vue
- [X] T072 IOPS vs Latency scatter plot in frontend-vue/src/components/charts/ScatterPlot.vue
- [X] T073 Radar comparison chart in frontend-vue/src/components/charts/RadarChart.vue
- [X] T074 Visualization tabs container in frontend-vue/src/components/charts/VisualizationTabs.vue

### User Management Components
- [X] T075 User list component in frontend-vue/src/components/users/UserList.vue
- [X] T076 Add user form component in frontend-vue/src/components/users/AddUserForm.vue
- [X] T077 Edit user modal component in frontend-vue/src/components/users/EditUserModal.vue

## Phase 3.5: Pages and Routing

### Page Components
- [X] T078 Update LoginForm component with dark theme in frontend-vue/src/components/LoginForm.vue
- [X] T079 Dashboard page in frontend-vue/src/pages/Dashboard.vue
- [X] T080 Host Analysis page in frontend-vue/src/pages/HostAnalysis.vue
- [X] T081 Update UserManager page in frontend-vue/src/pages/UserManager.vue
- [X] T082 Test History page in frontend-vue/src/pages/TestHistory.vue
- [X] T083 Performance Analytics page in frontend-vue/src/pages/PerformanceAnalytics.vue

### Router Configuration
- [X] T084 Update router configuration in frontend-vue/src/router.ts with new routes
- [X] T085 Add route guards for authentication and authorization in frontend-vue/src/router.ts

### Main App Updates
- [X] T086 Update App.vue with theme support and navigation integration
- [X] T087 Update main.ts with Pinia store initialization and global components

## Phase 3.6: Integration and Data Flow

- [X] T088 Integrate auth composable with login form and navigation
- [X] T089 Connect dashboard components to test runs API
- [X] T090 Implement filter logic with OR within categories, AND between categories
- [X] T091 Connect visualizations to filtered data with relative color scaling
- [X] T092 Implement host selection persistence across pages
- [X] T093 Connect user management interface to backend APIs
- [X] T094 Add error handling with user-friendly messages and console logging
- [X] T095 Implement empty state handling for charts and tables

## Phase 3.7: Polish and Performance

### Performance Optimization
- [ ] T096 [P] Optimize chart rendering for 1000+ data points
- [ ] T097 [P] Implement component lazy loading for visualizations
- [ ] T098 [P] Add request cancellation for API calls
- [ ] T099 [P] Optimize bundle size with code splitting

### Testing and Quality Assurance
- [ ] T100 [P] Run all contract tests against backend API
- [ ] T101 [P] Run integration tests with full user scenarios
- [ ] T102 [P] Verify TypeScript compilation with no errors
- [ ] T103 [P] Run ESLint and fix all violations
- [ ] T104 [P] Run accessibility tests with axe-core

### Documentation and Final Steps
- [ ] T105 [P] Update README.md with setup and development instructions
- [ ] T106 [P] Document component props and composable APIs
- [ ] T107 Execute quickstart guide validation scenarios
- [ ] T108 Performance testing: verify <200ms API response rendering
- [ ] T109 Cross-browser testing on Chrome, Firefox, Safari
- [ ] T110 Final cleanup: remove unused code, optimize imports

## Dependencies

### Critical Dependencies (Must Complete Before Next Phase)
- **Setup (T001-T006)** before **Tests (T007-T024)**
- **Tests (T007-T024)** before **Implementation (T025-T095)**
- **Types (T025-T031)** before **Composables (T032-T036)** and **Stores (T037-T040)**
- **Composables (T032-T036)** before **Components (T052-T077)**
- **API Services (T047-T051)** before **Integration (T088-T095)**
- **Pages (T078-T083)** before **Router (T084-T085)**
- **Implementation (T025-T095)** before **Polish (T096-T110)**

### Sequential Dependencies Within Phases
- T047 (HTTP client) blocks T048-T051 (API services)
- T032 (useAuth) blocks T088 (auth integration)
- T033 (useApi) blocks T089 (dashboard data integration)
- T034 (useFilters) blocks T090 (filter logic implementation)
- T037-T040 (stores) block T087 (main.ts store initialization)
- T079 (Dashboard page) blocks T089 (dashboard integration)

## Parallel Execution Examples

### Phase 3.2: All Contract Tests Together
```bash
# Launch T007-T012 together:
Task: "Contract test GET /api/test-runs in frontend-vue/src/services/api/__tests__/test-runs-api.spec.ts"
Task: "Contract test GET /api/filters in frontend-vue/src/services/api/__tests__/filters-api.spec.ts"
Task: "Contract test GET /api/test-runs/{id} in frontend-vue/src/services/api/__tests__/test-run-detail-api.spec.ts"
Task: "Contract test GET /api/test-runs/performance-data in frontend-vue/src/services/api/__tests__/performance-api.spec.ts"
Task: "Contract test GET /health in frontend-vue/src/services/api/__tests__/health-api.spec.ts"
Task: "Contract test user management APIs in frontend-vue/src/services/api/__tests__/user-management-api.spec.ts"
```

### Phase 3.2: All Component Tests Together
```bash
# Launch T013-T018 together:
Task: "Authentication flow test in frontend-vue/src/composables/__tests__/useAuth.spec.ts"
Task: "Filter logic test (OR within categories) in frontend-vue/src/composables/__tests__/useFilters.spec.ts"
Task: "Data fetching test in frontend-vue/src/composables/__tests__/useApi.spec.ts"
Task: "Chart data processing test in frontend-vue/src/utils/__tests__/chartProcessing.spec.ts"
Task: "Data transformation test in frontend-vue/src/utils/__tests__/dataTransform.spec.ts"
Task: "Error handling test in frontend-vue/src/utils/__tests__/errorHandling.spec.ts"
```

### Phase 3.3: All Type Definitions Together
```bash
# Launch T025-T031 together:
Task: "TestRun interface in frontend-vue/src/types/testRun.ts"
Task: "FilterOptions interface in frontend-vue/src/types/filters.ts"
Task: "PerformanceMetrics interface in frontend-vue/src/types/performance.ts"
Task: "VisualizationConfig interface in frontend-vue/src/types/visualization.ts"
Task: "UserAccount and Auth interfaces in frontend-vue/src/types/auth.ts"
Task: "API response interfaces in frontend-vue/src/types/api.ts"
Task: "Component prop interfaces in frontend-vue/src/types/components.ts"
```

### Phase 3.4: Basic UI Components Together
```bash
# Launch T052-T058 together:
Task: "MetricCard component in frontend-vue/src/components/ui/MetricCard.vue"
Task: "StatusIndicator component in frontend-vue/src/components/ui/StatusIndicator.vue"
Task: "LoadingSpinner component in frontend-vue/src/components/ui/LoadingSpinner.vue"
Task: "ErrorMessage component in frontend-vue/src/components/ui/ErrorMessage.vue"
Task: "Button component in frontend-vue/src/components/ui/Button.vue"
Task: "Input component in frontend-vue/src/components/ui/Input.vue"
Task: "Modal component in frontend-vue/src/components/ui/Modal.vue"
```

## Task Validation Rules

### File Independence Check
- [P] tasks modify different files or directories
- No [P] task modifies same file as another [P] task
- Sequential tasks that modify same file are properly ordered

### Test-Driven Development
- All contract tests (T007-T012) must fail initially
- All component tests (T013-T018) must fail initially
- All integration tests (T019-T024) must fail initially
- Implementation tasks only start after tests are failing

### API Constraint Compliance
- No task uses `/api/time-series` endpoints (per FR-022B)
- All chart data derived from `/api/test-runs` and `/api/filters` only
- Error handling includes both UI display and console logging (per FR-022C)

### Feature Requirement Coverage
- Filter logic implements OR within categories (per clarification)
- Host selections persist across pages (per clarification)
- Heatmap uses relative color scaling (per clarification)
- Large datasets handled by browser optimization (per clarification)
- Empty states show "No data available" messages (per clarification)

## Success Criteria

### All Contract Tests Pass
- [ ] All API endpoints return expected data structures
- [ ] All error scenarios handled correctly
- [ ] All authentication and authorization working

### All Integration Tests Pass
- [ ] Complete user workflows function end-to-end
- [ ] Filter logic operates correctly with OR/AND logic
- [ ] Visualizations render with correct data and scaling
- [ ] Host selection persistence works across navigation

### Performance Requirements Met
- [ ] Dashboard loads in <200ms after API response
- [ ] Visualizations render smoothly with 1000+ data points
- [ ] Filter application responds in <50ms
- [ ] No memory leaks during extended usage

### Code Quality Standards
- [ ] TypeScript compilation with zero errors
- [ ] ESLint passes with zero violations
- [ ] All components have proper prop types
- [ ] All composables have proper return types
- [ ] Test coverage >90% for critical paths

### User Experience Validated
- [ ] All quickstart guide scenarios pass
- [ ] Dark theme login page matches specification
- [ ] Dashboard statistics display correctly
- [ ] Filter UI is intuitive and responsive
- [ ] Error messages are user-friendly
- [ ] Empty states are informative

## Notes
- Verify all tests fail before implementing (TDD requirement)
- Commit after each completed task
- Use exact file paths for every task
- Mark [P] only for truly independent files
- Focus on user requirements from specification
- Maintain existing login functionality during rebuild