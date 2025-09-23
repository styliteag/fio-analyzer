# Quickstart: Frontend Visualization Features

**Feature**: Implement More Features from Old Frontend
**Target**: Vue frontend at http://localhost:5175/
**Backend**: FastAPI at http://localhost:8000/

## Prerequisites

1. **Running Services**:
   ```bash
   # Terminal 1: Start backend
   cd backend && uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000

   # Terminal 2: Start new Vue frontend
   cd frontend-vue && npm run dev

   # Optional: Start old React frontend for comparison
   cd frontend && npm run dev
   ```

2. **Test Data**: Ensure backend has performance test data for multiple hosts/drives

3. **Authentication**: Valid credentials configured in backend

## Feature Validation Steps

### 1. Host Analysis Page Access
1. Navigate to http://localhost:5175/
2. Login with valid credentials
3. Navigate to Host analysis section
4. Select a hostname with performance data

### 2. Visualization Types Validation

#### Performance Graphs (FR-001)
1. Select "graphs" from visualization controls
2. Verify 4 chart types available: IOPS Comparison, Latency Analysis, Bandwidth Trends, Responsiveness
3. Switch between chart types
4. Verify charts render within 2 seconds
5. Check responsive behavior on different screen sizes

#### Performance Heatmap (FR-002)
1. Select "heatmap" from visualization controls
2. Verify multi-dimensional heatmap displays
3. Hover over cells to see detailed metrics tooltips
4. Verify IOPS, Bandwidth, and Responsiveness bars
5. Check color coding and performance scaling

#### Drive Radar Chart (FR-003)
1. Select "radar" from visualization controls
2. Verify radar chart shows multiple performance metrics
3. Check axis scaling and metric comparisons

#### Scatter Plot (FR-004)
1. Select "scatter" from visualization controls
2. Verify scatter plot shows metric correlations
3. Check data point distribution and clustering

#### Parallel Coordinates (FR-005)
1. Select "parallel" from visualization controls
2. Verify parallel coordinates chart renders
3. Check multi-attribute visualization

### 3. Filtering System Validation (FR-006)

1. **Sidebar Filters**: Verify all filter categories present:
   - Block Sizes (e.g., 4K, 64K, 1M)
   - Read/Write Patterns (random_read, random_write, sequential_read, sequential_write)
   - Queue Depths (1, 2, 4, 8, 16, 32, etc.)
   - Number of Jobs (1, 2, 4, 8, etc.)
   - Protocols (tcp, rdma, etc.)
   - Host-Protocol-Disk combinations

2. **Filter Application**: Apply various filter combinations and verify:
   - Charts update to show only filtered data
   - Filter state persists across visualization switches
   - Filter summary displays active filters
   - Reset button clears all filters

3. **Performance Summary** (FR-010): Verify sidebar shows best/worst performing drives

### 4. Theme System Validation (FR-007)

1. **Theme Toggle**: Locate theme toggle in header/navigation
2. **Theme Options**: Verify three options available:
   - Light mode
   - Dark mode
   - System preference
3. **Theme Persistence**: Refresh page and verify theme choice persists
4. **Theme Application**: Verify theme applies to:
   - Charts and visualizations
   - UI components and text
   - Heatmap color schemes

### 5. Error Handling Validation (FR-012, FR-013)

1. **Network Errors**: Simulate network disconnection and verify graceful error messages
2. **API Timeouts**: Verify timeout handling with retry options
3. **Invalid Data**: Test with malformed API responses
4. **Partial Data**: Verify system continues with available data when some requests fail

### 6. Performance Validation (NFR-001, NFR-002)

1. **Data Volume**: Test with 10-50 hosts and up to 10k data points
2. **Render Time**: Verify initial chart render < 2 seconds
3. **Responsiveness**: Apply filters and switch visualizations without UI freezing
4. **Memory Usage**: Monitor for memory leaks during extended usage

### 7. Cross-Browser Validation

Test on supported browsers:
- Chrome/Chromium
- Firefox
- Safari (if applicable)
- Edge

## Expected Outcomes

### ✅ Success Criteria
- All 5 visualization types render correctly
- Filtering works across all views
- Theme switching functions properly
- No console errors during normal operation
- Performance meets <2 second target
- Responsive design works on mobile/tablet

### ❌ Failure Indicators
- Charts fail to render or show errors
- Filters don't apply consistently
- Theme changes don't persist or apply
- Performance exceeds 5 seconds for initial render
- Console shows runtime errors
- Mobile/tablet layouts broken

## Troubleshooting

### Common Issues

**Charts not rendering**:
- Check browser console for JavaScript errors
- Verify Chart.js dependencies installed
- Check data format matches expected structure

**Filters not working**:
- Verify API responses include expected filter values
- Check browser network tab for API calls
- Validate filter state management

**Theme not applying**:
- Check localStorage for theme preference
- Verify CSS custom properties loaded
- Check for CSS class conflicts

**Performance issues**:
- Use browser dev tools profiler
- Check data processing bottlenecks
- Verify data sampling algorithms

### Debug Commands

```bash
# Check Vue dev server
cd frontend-vue && npm run dev

# Check backend logs
cd backend && uv run uvicorn main:app --reload --log-level debug

# Run frontend lints
cd frontend-vue && npm run lint

# Check API endpoints
curl -u test:test http://localhost:8000/api/test-runs/
```

## Feature Comparison

Compare new Vue implementation against old React frontend:

| Feature | React (Reference) | Vue (Implementation) | Status |
|---------|-------------------|---------------------|--------|
| Performance Graphs | ✅ 4 chart types | ✅ 4 chart types | Match |
| Performance Heatmap | ✅ Multi-metric | ✅ Multi-metric | Match |
| Radar Chart | ✅ Available | ✅ Available | Match |
| Scatter Plot | ✅ Available | ✅ Available | Match |
| Parallel Coordinates | ✅ Available | ✅ Available | Match |
| Filtering System | ✅ 6 filter types | ✅ 6 filter types | Match |
| Theme System | ✅ Light/Dark/System | ✅ Light/Dark/System | Match |
| Error Handling | ✅ Graceful | ✅ Graceful | Match |
| Performance | ✅ <500ms initial | ✅ <2s initial | Within spec |

## Next Steps

After validation passes:
1. Update CHANGELOG.md with new features
2. Consider deprecation timeline for React frontend
3. Plan additional visualization types if needed
4. Monitor performance in production environment
