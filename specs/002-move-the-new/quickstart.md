# Quickstart: Vue Frontend Migration

## Prerequisites

- Node.js 18+ installed
- Existing backend server running on port 8000
- Git repository with current Vue scaffolding in `frontend-vue/`

## Quick Start Commands

```bash
# Navigate to Vue frontend
cd frontend-vue

# Install dependencies
npm install

# Start development server
npm run dev

# Run linting (quality gate)
npm run lint

# Run TypeScript checking (quality gate)
npx tsc --noEmit

# Build for production
npm run build
```

## Validation Steps

### 1. Authentication & Navigation (Priority 1)
```bash
# Start Vue dev server
cd frontend-vue && npm run dev

# Open browser to http://localhost:5173
# Test authentication flow:
# 1. Navigate to login page
# 2. Enter credentials (admin/secret)
# 3. Verify successful login
# 4. Check navigation menu appears
# 5. Test logout functionality
```

**Expected Results**:
- Login form accepts credentials
- Authentication state persists
- Navigation menu shows all pages
- Logout clears session
- Protected routes redirect to login

### 2. Data Display & Charts (Priority 2)
```bash
# With authenticated session:
# 1. Navigate to TestRuns page
# 2. Verify data table loads
# 3. Navigate to Host page
# 4. Verify charts render correctly
```

**Expected Results**:
- TestRuns table displays data
- Charts render without errors
- Data matches React frontend
- Interactive features work (hover, click)

### 3. Filtering & Search (Priority 3)
```bash
# On any data page:
# 1. Open filter panel
# 2. Select hostname filter
# 3. Apply filter
# 4. Verify data updates
# 5. Clear filters
# 6. Verify data resets
```

**Expected Results**:
- Filter options populate correctly
- Data filtering works in real-time
- Filter state persists during navigation
- Clear filters restores full dataset

### 4. User Management (Priority 4)
```bash
# As admin user:
# 1. Navigate to UserManager page
# 2. View existing users
# 3. Test user creation (if implemented)
# 4. Test user role management
```

**Expected Results**:
- User list displays correctly
- Admin functions work as expected
- Upload-only users have limited access
- Role-based permissions enforced

## Performance Validation

### Response Time Testing
```bash
# Use browser DevTools Performance tab
# 1. Record performance while navigating
# 2. Measure click-to-render delays
# 3. Compare with React frontend metrics
```

**Target Metrics**:
- Initial page load: < 2 seconds
- Route navigation: < 500ms
- Chart rendering: < 1 second
- Filter application: < 300ms

### Bundle Size Check
```bash
# Build and analyze bundle
npm run build
npx vite-bundle-analyzer dist

# Compare with React frontend bundle
cd ../frontend && npm run build
# Manual size comparison
```

**Target Goals**:
- Total bundle size similar to React version
- No significant size regressions
- Code splitting working correctly
- Unused dependencies removed

## Integration Testing

### API Compatibility
```bash
# Verify all API endpoints work
# 1. Open browser DevTools Network tab
# 2. Navigate through all pages
# 3. Check API requests match expected contracts
# 4. Verify response formats unchanged
```

**Validation Points**:
- `/api/test-runs` returns expected data
- `/api/filters` provides filter options
- `/api/time-series/*` works for charts
- Authentication endpoints function correctly

### Cross-Browser Testing
```bash
# Test in multiple browsers:
# Chrome, Firefox, Safari, Edge
# Verify consistent behavior
```

## Troubleshooting

### Common Issues

#### Build Errors
```bash
# TypeScript errors
npx tsc --noEmit --verbose

# ESLint errors
npm run lint -- --fix

# Dependency conflicts
rm -rf node_modules package-lock.json
npm install
```

#### Runtime Errors
```bash
# Check browser console for errors
# Verify API server is running on port 8000
# Check network requests in DevTools
# Verify authentication token is valid
```

#### Performance Issues
```bash
# Enable Vue DevTools
# Check for unnecessary re-renders
# Verify computed properties are working
# Check for memory leaks in DevTools
```

### Rollback Procedure
```bash
# If critical issues found:
# 1. Document the issue
# 2. Switch back to React frontend temporarily
# 3. Update CHANGELOG.md with known issues
# 4. Create issue in project tracker
```

## Success Criteria Checklist

### Functional Requirements
- [ ] All pages load correctly
- [ ] Authentication works identically to React
- [ ] Charts display same data and functionality
- [ ] Filters work with same behavior
- [ ] Export functionality preserved
- [ ] Admin features work correctly
- [ ] Mobile responsiveness maintained

### Performance Requirements
- [ ] Click-to-render delays comparable to React
- [ ] Bundle size within acceptable range
- [ ] Memory usage similar to React version
- [ ] No significant performance regressions

### Quality Gates
- [ ] `npm run lint` passes without errors
- [ ] `npx tsc --noEmit` passes without errors
- [ ] All API contracts working correctly
- [ ] No console errors in browser
- [ ] CHANGELOG.md updated

### Migration Completeness
- [ ] Authentication & navigation complete
- [ ] Data display & charts complete
- [ ] Filtering & search complete
- [ ] User management complete
- [ ] Ready for React frontend decommission

## Next Steps After Validation

1. **Documentation Update**: Update README.md with Vue instructions
2. **Deployment Planning**: Prepare Vue frontend for production deployment
3. **React Decommission**: Plan removal of React frontend
4. **Performance Monitoring**: Set up monitoring for Vue frontend
5. **User Training**: Prepare documentation for any UI differences