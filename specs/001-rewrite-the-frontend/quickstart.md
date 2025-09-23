# Quickstart Validation

1. Start backend (unchanged):
   - `uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000`
2. Start Vue app (in `frontend-vue/`):
   - `npm install && npm run dev`
3. Log in as admin and verify:
   - Navigate: Home, Performance, Compare, History, Host, Upload, Admin, UserManager
   - Filters and sorting operate correctly
   - Charts render and interact smoothly
   - **PRIORITY**: Radar chart renders with proper legend controls
   - Export PNG/CSV works
   - 3D chart renders with expected controls
4. Upload a FIO JSON file and confirm data appears in lists and charts.
5. Verify role restrictions with an uploader account.
6. Performance check: initial chart render < 500ms (typical dataset).
