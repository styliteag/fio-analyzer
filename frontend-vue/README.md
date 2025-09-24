# FIO Analyzer - Vue Frontend

A modern Vue.js 3 frontend dashboard for FIO performance analysis, providing comprehensive storage performance visualization and analysis capabilities.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Backend API server running on `http://localhost:8000`

### Installation & Setup
```bash
# Navigate to frontend directory
cd frontend-vue

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173` with API requests proxied to the backend.

## 🛠️ Development

### Available Scripts
```bash
# Development
npm run dev              # Start dev server with hot reload
npm run build            # Production build
npm run preview          # Preview production build

# Code Quality
npm run lint             # ESLint with Vue 3 + TypeScript rules
npm run lint:fix         # Auto-fix ESLint issues
npx tsc --noEmit         # TypeScript type checking

# Testing
npm run test             # Run unit tests
npm run test:ui          # Run tests with UI
npm run test:coverage    # Run tests with coverage report
```

### Project Structure
```
src/
├── components/          # Reusable Vue components
│   ├── ui/             # Basic UI components (Button, Input, etc.)
│   ├── charts/         # Chart components (Heatmap, Graphs, etc.)
│   ├── dashboard/      # Dashboard-specific components
│   ├── filters/        # Filter-related components
│   └── users/          # User management components
├── pages/              # Route components
├── composables/        # Vue composables for business logic
├── stores/             # Pinia stores for state management
├── services/           # API services and HTTP client
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── router.ts           # Vue Router configuration
```

## 🏗️ Architecture

### Technology Stack
- **Framework**: Vue 3 with Composition API
- **Language**: TypeScript 5.4+
- **State Management**: Pinia 2.1
- **Styling**: TailwindCSS 3.4
- **Charts**: Chart.js 4.4 + Vue-ChartJs 5.3
- **Icons**: Lucide Vue Next
- **Testing**: Vitest 3.2+ + Vue Test Utils 2.4+
- **Build Tool**: Vite 5.4+

### Key Features
- **Authentication**: HTTP Basic Auth with role-based access control
- **Data Visualization**: Interactive charts and heatmaps with relative color scaling
- **Filtering System**: OR logic within categories, AND logic between categories
- **Host Selection**: Multi-host selection with persistence across pages
- **Real-time Updates**: Live data refresh and error handling
- **Responsive Design**: Mobile-first responsive layout
- **Dark Theme**: Complete dark/light theme support

## 📱 Pages & Routes

| Route | Component | Description | Auth Required |
|-------|-----------|-------------|---------------|
| `/` | Dashboard | Main dashboard with statistics and quick links | ✅ |
| `/login` | LoginForm | Authentication page | ❌ |
| `/host-analysis` | HostAnalysis | Multi-host performance analysis | ✅ |
| `/test-history` | TestHistory | Historical test run data | ✅ |
| `/performance-analytics` | PerformanceAnalytics | Advanced performance metrics | ✅ |
| `/user-manager` | UserManager | User administration (admin only) | ✅ Admin |
| `/upload` | UploadData | Data upload interface | ✅ |

## 🔧 Configuration

### Environment Variables
- `VITE_API_URL`: API base URL (build-time)
  - Development: `""` (empty) - uses Vite proxy
  - Production: `"/api"` - nginx proxy configuration

### API Integration
The frontend integrates with the FastAPI backend using these endpoints:
- `GET /api/test-runs/` - Retrieve test run data with filtering
- `GET /api/filters/` - Get available filter options
- `GET /api/users/` - User management (admin only)
- `GET /health` - Health check

**Note**: The frontend does NOT use `/api/time-series` endpoints per specification requirements.

## 🎨 Component Development

### Component Structure
```vue
<template>
  <!-- Template with TailwindCSS classes -->
</template>

<script setup lang="ts">
// TypeScript with Composition API
import { ref, computed, onMounted } from 'vue'
import type { ComponentProps } from '@/types'

// Props with TypeScript interfaces
interface Props {
  title: string
  data: TestRun[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  update: [value: string]
}>()

// Reactive state
const isLoading = ref(false)

// Computed properties
const filteredData = computed(() => {
  return props.data.filter(/* logic */)
})

// Lifecycle
onMounted(() => {
  // Initialization
})
</script>

<style scoped>
/* Component-specific styles if needed */
</style>
```

### Composable Pattern
```typescript
// composables/useExample.ts
import { ref, computed } from 'vue'
import type { ExampleData } from '@/types'

export function useExample() {
  const data = ref<ExampleData[]>([])
  const loading = ref(false)
  
  const processedData = computed(() => {
    return data.value.map(/* processing */)
  })
  
  async function fetchData() {
    loading.value = true
    try {
      // API call
    } finally {
      loading.value = false
    }
  }
  
  return {
    data: readonly(data),
    loading: readonly(loading),
    processedData,
    fetchData
  }
}
```

## 🧪 Testing

### Test Structure
```
src/
├── components/__tests__/     # Component unit tests
├── composables/__tests__/    # Composable unit tests
├── pages/__tests__/          # Page integration tests
├── utils/__tests__/          # Utility function tests
└── test/                     # Contract and integration tests
```

### Running Tests
```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm run test -- FilterSidebar.spec.ts
```

### Test Examples
```typescript
// Component test
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import FilterSidebar from '@/components/filters/FilterSidebar.vue'

describe('FilterSidebar', () => {
  it('renders filter options correctly', () => {
    const wrapper = mount(FilterSidebar, {
      props: {
        options: ['option1', 'option2']
      }
    })
    
    expect(wrapper.text()).toContain('option1')
  })
})
```

## 🚀 Deployment

### Production Build
```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Docker Deployment
The frontend is containerized and deployed with the backend using Docker Compose:

```bash
# Build and start all services
docker compose up --build -d

# Access application
open http://localhost
```

### Build Optimization
- **Code Splitting**: Automatic route-based code splitting
- **Tree Shaking**: Unused code elimination
- **Asset Optimization**: Image and CSS optimization
- **Bundle Analysis**: Use `npm run build -- --analyze` for bundle analysis

## 🔍 Performance

### Performance Targets
- **Initial Load**: < 2 seconds
- **Dashboard Render**: < 200ms after API response
- **Chart Rendering**: < 100ms for typical datasets
- **Filter Application**: < 50ms response time
- **Memory Usage**: Stable during extended usage

### Optimization Strategies
- **Lazy Loading**: Route-based component lazy loading
- **Request Deduplication**: Prevent duplicate API calls
- **Data Caching**: Client-side caching with TTL
- **Chart Optimization**: Efficient rendering for 1000+ data points
- **Bundle Splitting**: Vendor and route-based splitting

## 🐛 Troubleshooting

### Common Issues

**Build Errors**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check TypeScript errors
npx tsc --noEmit
```

**API Connection Issues**
- Verify backend is running on `http://localhost:8000`
- Check CORS configuration in backend
- Verify API endpoints are accessible

**Chart Rendering Issues**
- Check Chart.js dependencies
- Verify data format matches expected schema
- Test with different browsers

**Authentication Issues**
- Verify user credentials in backend
- Check authentication headers
- Clear browser storage and retry

### Debug Mode
```bash
# Enable Vue DevTools
npm run dev

# Enable detailed logging
VITE_DEBUG=true npm run dev
```

## 📚 Additional Resources

- [Vue 3 Documentation](https://vuejs.org/)
- [Pinia State Management](https://pinia.vuejs.org/)
- [Chart.js Documentation](https://www.chartjs.org/)
- [TailwindCSS Documentation](https://tailwindcss.com/)
- [Vitest Testing Guide](https://vitest.dev/)

## 🤝 Contributing

1. Follow the existing code style and patterns
2. Write tests for new components and features
3. Ensure TypeScript compilation passes
4. Run ESLint and fix all violations
5. Test across different browsers and screen sizes

## 📄 License

This project is part of the FIO Analyzer system. See the main project LICENSE for details.
