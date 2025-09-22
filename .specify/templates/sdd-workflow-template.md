# Spec-Driven Development (SDD) Workflow Template

This template documents the proven workflow for implementing features using Spec-Driven Development in the FIO Analyzer project.

## Prerequisites ✅

- [ ] Project constitution exists and is up-to-date
- [ ] Required scripts are available in `.specify/scripts/`
- [ ] Templates are available in `.specify/templates/`
- [ ] Working git repository with clean state

## Phase 1: Feature Initiation 🚀

### 1.1 Create Feature Branch
```bash
# Use the automated script
./.specify/scripts/bash/create-new-feature.sh "feature-name"

# Or manually:
git checkout -b feature/feature-name
git push -u origin feature/feature-name
```

### 1.2 Generate Feature Specification
```bash
# Copy spec template
cp .specify/templates/spec-template.md .specify/specs/feature-name-$(date +%Y%m%d-%H%M%S).md

# Edit specification with:
# - Clear overview and requirements
# - Functional requirements (FR-1, FR-2, etc.)
# - Non-functional requirements (NFR-1, NFR-2, etc.)
# - User stories (US-1, US-2, etc.)
# - Technical design and architecture
# - Acceptance criteria
```

### 1.3 Create Implementation Plan
```bash
# Generate comprehensive plan
./.specify/scripts/bash/setup-plan.sh

# This creates:
# - research.md (technical research)
# - data-model.md (data structures)
# - contracts/ (API contracts)
# - quickstart.md (implementation guide)
# - tasks.md (detailed task breakdown)
```

## Phase 2: Implementation Execution 🛠️

### 2.1 Constitutional Compliance Check
Before starting implementation, verify adherence to:

- **Performance-First Development**: Plan for performance optimization
- **API-First Architecture**: Ensure API contracts are stable
- **Type Safety**: Plan TypeScript strict mode compliance
- **Authentication**: Verify security requirements
- **Test Coverage**: Plan testing approach

### 2.2 Execute Implementation
Use Claude Code with systematic execution:

```markdown
# In Claude Code conversation:
/implement

# Or break into phases:
/implement --phase=1  # Foundation
/implement --phase=2  # Core functionality
/implement --phase=3  # Polish and optimization
```

### 2.3 Quality Assurance
```bash
# TypeScript compilation
cd frontend && npx tsc --noEmit

# Linting
cd frontend && npm run lint

# Production build test
cd frontend && npm run build

# Backend tests (if applicable)
cd backend && python -m pytest
```

## Phase 3: Feature Completion 📋

### 3.1 Update Documentation
- [ ] Update `CHANGELOG.md` with feature description
- [ ] Mark specification as completed with status header
- [ ] Update tasks.md with completion status
- [ ] Add any necessary README updates

### 3.2 Create Pull Request
```bash
# Push latest changes
git push origin feature/feature-name

# Create comprehensive PR
gh pr create --title "feat: Feature Title" --body "$(cat <<'EOF'
## Summary
- Brief description of the feature

## Features Added
- Detailed list of functionality

## Technical Implementation
- Architecture decisions
- Key technical details

## Constitutional Compliance
✅ Performance-First Development: [details]
✅ Type Safety: [details]
✅ API-First Architecture: [details]
✅ Quality Assurance: [details]

## Test Plan
- [x] TypeScript compilation passes
- [x] ESLint validation passes
- [x] Production build successful
- [x] Manual testing completed

🤖 Generated with [Claude Code](https://claude.ai/code)
EOF
)"
```

### 3.3 Post-Merge Cleanup
```bash
# After PR is approved and merged:
git checkout main
git pull origin main
git branch -d feature/feature-name
git push origin --delete feature/feature-name
```

## Constitutional Compliance Checklist ⚖️

### Performance-First Development ✅
- [ ] Performance impact assessed
- [ ] Large dataset handling optimized
- [ ] Bundle size impact considered
- [ ] Rendering performance verified

### API-First Architecture ✅
- [ ] API contracts documented
- [ ] Backward compatibility maintained
- [ ] OpenAPI documentation updated
- [ ] Endpoint authentication verified

### Type Safety and Data Integrity ✅
- [ ] Zero 'any' types used
- [ ] Strict TypeScript mode compliance
- [ ] Data validation implemented
- [ ] Error handling comprehensive

### Authentication and Security ✅
- [ ] Proper authentication required
- [ ] Role-based access enforced
- [ ] Sensitive data protected
- [ ] Security best practices followed

### Test Coverage and Quality Assurance ✅
- [ ] ESLint validation passes
- [ ] TypeScript compilation successful
- [ ] Production build successful
- [ ] Manual testing completed
- [ ] Performance requirements met

## Next Feature Recommendations 💡

Based on project needs and user feedback:

1. **Chart Export Functionality** - PNG/CSV export for performance graphs
2. **Advanced Filtering UI** - Enhanced filtering controls with saved presets
3. **Performance Optimization** - Address bundle size and loading performance
4. **Mobile Responsiveness** - Improved mobile and tablet experience
5. **Real-time Updates** - Live data updates and notifications
6. **Custom Dashboards** - User-configurable dashboard layouts

## SDD Best Practices 📚

### Specification Quality
- Write clear, testable requirements
- Include concrete acceptance criteria
- Define measurable performance targets
- Specify error handling requirements

### Implementation Approach
- Follow constitutional principles strictly
- Break large features into phases
- Maintain clean git history
- Write descriptive commit messages

### Quality Standards
- Zero TypeScript errors tolerated
- All ESLint rules must pass
- Production builds must succeed
- Performance benchmarks must be met

### Documentation Standards
- Update CHANGELOG.md for all features
- Maintain accurate specifications
- Document architectural decisions
- Include setup and usage instructions

## Troubleshooting Common Issues 🔧

### TypeScript Compilation Errors
```bash
# Check for implicit any types
npx tsc --noEmit --strict

# Fix common issues:
# - Add explicit type annotations
# - Use type assertions carefully
# - Ensure proper imports/exports
```

### Build Failures
```bash
# Check bundle size
npm run build

# Common solutions:
# - Use dynamic imports for code splitting
# - Optimize dependencies
# - Remove unused code
```

### Constitutional Violations
- Review each principle systematically
- Use ESLint disable sparingly and with justification
- Ensure security practices are followed
- Maintain API backward compatibility

---

**Template Version**: 1.0.0
**Last Updated**: 2025-09-22
**Based on**: Performance Graphs Visualization implementation