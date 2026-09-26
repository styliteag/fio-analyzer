# Infrastructure Notes

Facts and history moved out of agent instructions. Agent rules live in [AGENTS.md](./AGENTS.md).

## History

### Frontend refactoring milestones (2024)
Moved verbatim from the former `CLAUDE.md` section "Recent Improvements (2024)" on 2026-09-26:
- Refactored frontend with reusable components (MetricsCard, TestRunFormFields)
- Optimized filter hooks from O(n²) to O(n) complexity
- Enhanced TypeScript type safety (eliminated all 'any' types)
- Added comprehensive request cancellation support
- Broke down large components (Host.tsx: 632 → 204 lines)
- Removed 700+ lines of unused code
- Enhanced API documentation with Swagger/OpenAPI
