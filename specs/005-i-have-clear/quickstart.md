# Quickstart Guide: Vue.js Frontend Dashboard

## Overview
This quickstart guide validates the Vue.js frontend dashboard implementation through step-by-step user scenarios based on the feature specification requirements.

## Prerequisites

### System Requirements
- Node.js 18+ installed
- Modern web browser (Chrome 90+, Firefox 88+, Safari 14+)
- Backend API server running on `http://localhost:8000`
- Test data available in backend database

### Setup Steps
1. Navigate to frontend directory:
   ```bash
   cd frontend-vue
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

4. Access application at `http://localhost:5173`

## Quickstart Scenarios

### Scenario 1: Authentication Flow (FR-001, FR-002, FR-003)

**Given**: User visits the application without authentication
**When**: They navigate to `http://localhost:5173`
**Then**: They should see the login page

#### Steps:
1. Open browser and navigate to `http://localhost:5173`
2. **Verify**: Dark-themed login page appears
3. **Verify**: Page displays "Sign in to FIO Analyzer" branding
4. **Verify**: Subtitle shows "Storage Performance Visualizer"
5. **Verify**: Username and Password input fields are present
6. **Verify**: "Sign in" button is visible

#### Login Test:
1. Enter valid admin credentials (username: `admin`, password: `admin`)
2. Click "Sign in" button
3. **Verify**: Successfully redirected to main dashboard
4. **Verify**: Navigation bar appears with Light/Upload/Admin/Users/FIO Benchmark Analysis buttons
5. **Verify**: Welcome message displays "Welcome back, admin!"
6. **Verify**: Logout functionality appears in top right corner

### Scenario 2: Main Dashboard Overview (FR-004, FR-005, FR-006, FR-007)

**Given**: User is authenticated as admin
**When**: They access the main dashboard
**Then**: They should see comprehensive dashboard overview

#### Steps:
1. Navigate to main dashboard (should be automatic after login)
2. **Verify**: Statistics cards are displayed showing:
   - Total Test Runs count (e.g., "519")
   - Active Servers count (e.g., "---" if none active)
   - Average IOPS (e.g., "246,196")
   - Average Latency (e.g., "---" if no data or "12.77ms")
   - Last Upload timestamp (e.g., "9 days ago")
   - Total Hostnames with History ratio (e.g., "6 / 6")

3. **Verify**: Recent Activity feed displays:
   - Recent test uploads with hostnames
   - Server performance analysis entries
   - Timestamps relative to current time (e.g., "9 days ago")

4. **Verify**: System Status panel shows:
   - Backend API status (Green "Online" indicator)
   - Database status (Green "Connected" indicator)
   - File Storage status (Green "Available" indicator)
   - Authentication status (Green "Active" indicator)

5. **Verify**: Quick Links section contains:
   - Performance Analytics (with icon and description)
   - Test History (with icon and description)
   - Upload Data (with icon and description)
   - Admin Panel (with icon and description)
   - Host Analysis (with icon and description)
   - API Documentation (with icon and description)

### Scenario 3: Navigation and Analysis Modes (FR-008, FR-009)

**Given**: User is on the main dashboard
**When**: They interact with navigation tabs
**Then**: They should see different analysis modes

#### Steps:
1. **Verify**: Tabbed navigation displays:
   - Performance Analytics
   - Test History
   - Advanced Host Comparison
   - Host Analysis
   - Refresh Statistics (blue highlighted tab)

2. Click on "Host Analysis" tab
3. **Verify**: Multi-host selection interface appears with:
   - "Select Hosts:" dropdown
   - Tag-based host selector showing removable host chips
   - Available hosts: blueshark, redshark, whiteshark, greenshark

4. Select multiple hosts (e.g., blueshark, redshark, whiteshark)
5. **Verify**: Selected hosts appear as removable tags/chips
6. **Verify**: Host count shows "4 Hosts" in main display
7. Navigate to different page and return
8. **Verify**: Host selections persist across navigation

### Scenario 4: Filtering System (FR-010, FR-011, FR-012, FR-013, FR-014A)

**Given**: User is on Host Analysis page with hosts selected
**When**: They use the filtering system
**Then**: They should be able to filter results effectively

#### Steps:
1. **Verify**: Comprehensive filtering sidebar displays sections:
   - Block Sizes (1K, 4K, 64K buttons)
   - Read/Write Patterns (randread, randwrite, read, write buttons)
   - Queue Depths (QD1, QD64 buttons)
   - Number of Jobs (Jobs:4, Jobs:32 buttons)
   - Protocols (local, zfs buttons)
   - Host-Protocol-Disk combinations

2. **API Test**: Verify filter options are loaded from `/api/filters`
   - Open browser developer tools
   - Check Network tab for API call to `/api/filters`
   - **Verify**: Response contains arrays of available filter values

3. Select multiple block sizes (e.g., 1K, 4K, 64K)
4. **Verify**: Multiple selections within category use OR logic
5. **Verify**: Results include data for ANY selected block size

6. Select patterns (e.g., randread, randwrite)
7. **Verify**: Results match hosts with ANY selected pattern AND ANY selected block size

8. **Verify**: Active Filters summary appears
9. Click "Reset" button
10. **Verify**: All filter selections cleared
11. **Verify**: Results update dynamically without page reload

### Scenario 5: Performance Visualizations (FR-014, FR-015, FR-016, FR-017, FR-018)

**Given**: User has hosts selected and filters applied
**When**: They view performance visualizations
**Then**: They should see interactive charts and data

#### Steps:
1. **Verify**: Multiple visualization mode tabs available:
   - Overview
   - Performance Heatmap (highlighted)
   - Performance Graphs
   - Radar Comparison
   - IOPS vs Latency
   - Parallel Coordinates
   - Facet Scatter Grids
   - Stacked Bar
   - 3D Performance
   - Boxplot by Block Size

2. **Performance Heatmap Test**:
   - **Verify**: Color-coded heatmap displays with:
     - Hosts on Y-axis (blueshark, redshark, whiteshark, greenshark)
     - Patterns on columns (RANDOM WRITE, RANDOM READ, SEQUENTIAL WRITE, SEQUENTIAL READ)
     - Block sizes on sub-columns (1K, 4K, 64K)
   - **Verify**: Cells show IOPS, Bandwidth (BW), and Responsiveness (RESP) metrics
   - **Verify**: Color scaling is relative to current filtered dataset
   - **Verify**: Hover tooltips show detailed metrics
   - **Verify**: Legend explains color scale (0% to 100% Max)

3. **Performance Graphs Test**:
   - Click "Performance Graphs" tab
   - **Verify**: Interactive charts display:
     - IOPS Comparison
     - Latency Analysis
     - Bandwidth Trends
     - Responsiveness
   - **Verify**: Absolute/Normalized view toggle available
   - **Verify**: Charts show area fill for trend visualization
   - **Verify**: Performance Summary section shows statistics

4. **IOPS vs Latency Test**:
   - Click "IOPS vs Latency" tab
   - **Verify**: Scatter plot displays with:
     - IOPS on Y-axis (0 to 1,200,000)
     - Average Latency on X-axis (0 to 250 ms)
     - Color-coded performance zones:
       - Green: High Performance Zone
       - Yellow: Balanced Zone
       - Orange: High Latency Zone
       - Red: Low Performance Zone
   - **Verify**: Data points for poolBLUE, poolRED01, poolGREEN configurations
   - **Verify**: Legend shows Avg IOPS and Avg Latency values

### Scenario 6: Data Integration and Error Handling (FR-019, FR-020, FR-021, FR-022A, FR-022B, FR-022C)

**Given**: User interacts with data displays
**When**: Various data scenarios occur
**Then**: System should handle them appropriately

#### API Integration Test:
1. Open browser developer tools, Network tab
2. Navigate through different views
3. **Verify**: API calls made to `/api/test-runs/` with filter parameters
4. **Verify**: No calls made to `/api/time-series` endpoints
5. **Verify**: All chart data derived from test runs data only

#### Large Dataset Test:
1. Remove all filters to load maximum data
2. **Verify**: System loads all data efficiently
3. **Verify**: Visualizations render smoothly (60fps target)
4. **Verify**: Browser rendering handles 1000+ data points

#### Empty State Test:
1. Apply filters that return zero results (e.g., non-existent hostname)
2. **Verify**: Charts display "No data available" messages
3. **Verify**: Empty state shown instead of broken visualizations

#### Error Handling Test:
1. Disconnect from network or stop backend
2. Try to load data
3. **Verify**: User-friendly error message displayed in UI
4. **Verify**: Detailed error information logged to browser console
5. **Verify**: Error includes HTTP status codes and request details

#### Metrics Units Test:
1. **Verify**: Performance metrics display with correct units:
   - IOPS values (e.g., "125,000.5 IOPS")
   - Latency values (e.g., "0.256 ms")
   - Bandwidth values (e.g., "488.28 MB/s")

### Scenario 7: User Management Interface (FR-022, FR-023)

**Given**: User is authenticated as admin
**When**: They access user management
**Then**: They should be able to manage users

#### Steps:
1. Click "Users" button in navigation bar
2. **Verify**: User Management page loads
3. **Verify**: Page shows "Manage admin and uploader users for the FIO Analyzer system"
4. **Verify**: "Add User" and "Refresh" buttons available

5. **Verify**: Users list displays:
   - User entries with username and role
   - admin user with "You" indicator and "admin" role
   - uploader user with "uploader" role
   - Edit/Delete actions for each user

6. **Role-based Access Test**:
   - **Verify**: Admin user can see Edit/Delete options
   - **Verify**: User count shows "(2)" in header

### Scenario 8: Theme and Responsive Design

**Given**: User is using the application
**When**: They interact with theme controls and resize browser
**Then**: Interface should adapt appropriately

#### Steps:
1. **Verify**: Light theme toggle available in navigation
2. Click theme toggle
3. **Verify**: Interface switches between light and dark themes
4. **Verify**: All components maintain readability in both themes

5. Resize browser window to different sizes
6. **Verify**: Interface remains usable on different screen sizes
7. **Verify**: Navigation collapses appropriately on smaller screens

## Performance Validation

### Loading Performance
- [ ] Initial page load < 2 seconds
- [ ] Dashboard data load < 200ms after API response
- [ ] Visualization rendering < 100ms for typical datasets
- [ ] Filter application response < 50ms

### Memory Usage
- [ ] Initial memory usage reasonable for browser tab
- [ ] Memory usage stable during extended usage
- [ ] No significant memory leaks during navigation

### Network Efficiency
- [ ] Minimal API calls (no unnecessary polling)
- [ ] Reasonable request sizes for filter options
- [ ] Appropriate caching of static data

## Error Scenarios Validation

### Network Errors
1. Disconnect network during data loading
2. **Verify**: Appropriate offline indicators
3. **Verify**: Graceful degradation of functionality

### Authentication Errors
1. Use expired or invalid credentials
2. **Verify**: Redirect to login page
3. **Verify**: Clear error message about authentication

### Data Validation Errors
1. Provide malformed API responses (requires backend modification)
2. **Verify**: Graceful handling of unexpected data
3. **Verify**: Fallback to safe default states

## Success Criteria

### Functional Requirements Met
- [ ] All authentication flows work correctly
- [ ] Dashboard displays all required statistics
- [ ] Filtering system operates with OR logic within categories
- [ ] Visualizations render with relative color scaling
- [ ] Host selections persist across navigation
- [ ] Empty states display appropriate messages
- [ ] Error handling shows user-friendly messages and logs details
- [ ] User management interface functions for admins

### Technical Requirements Met
- [ ] No `/api/time-series` endpoint usage
- [ ] All data derived from `/api/test-runs` and `/api/filters`
- [ ] TypeScript compilation with no errors
- [ ] All tests pass (run `npm test`)
- [ ] Linting passes (run `npm run lint`)

### User Experience Requirements Met
- [ ] Interface matches provided screenshots
- [ ] Navigation is intuitive and consistent
- [ ] Loading states provide appropriate feedback
- [ ] Error states are informative but not alarming
- [ ] Performance remains smooth with large datasets

## Completion Checklist

- [ ] All quickstart scenarios completed successfully
- [ ] Performance validation criteria met
- [ ] Error scenarios tested and handled appropriately
- [ ] Success criteria verified
- [ ] Any issues documented with reproduction steps

## Troubleshooting

### Common Issues

**Login fails with valid credentials**:
- Verify backend is running on `http://localhost:8000`
- Check browser console for CORS errors
- Verify user exists in backend database

**No data appears in visualizations**:
- Verify test data exists in backend database
- Check `/api/test-runs` endpoint returns data
- Verify filters are not excluding all data

**Charts not rendering**:
- Check browser console for JavaScript errors
- Verify Chart.js dependencies loaded correctly
- Test with different browser

**Filters not working**:
- Verify `/api/filters` endpoint returns valid data
- Check network tab for API calls
- Verify filter state management in browser dev tools

For additional troubleshooting, check:
1. Browser developer console for errors
2. Network tab for failed API requests
3. Vue DevTools for component state issues
4. Backend logs for server-side errors