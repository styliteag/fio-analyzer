# FIO Analyzer - Vue.js Frontend

A clean, focused Vue 3 + TypeScript frontend for comparing FIO (Flexible I/O Tester) benchmark results with interactive charts.

## Features

- **Test Comparison** - Compare multiple hosts with stacked and grouped bar charts
- **Interactive Filters** - Filter by drive type, I/O pattern, block size, queue depth, protocol, and drive model
- **Host Selection** - Multi-select dropdown with search for selecting hosts to compare
- **Multiple Metrics** - Visualize IOPS, latency, bandwidth, P95/P99 latency
- **Data Upload** - Upload new FIO test data with metadata
- **Authentication** - HTTP Basic Auth with htpasswd

## Tech Stack

- **Vue 3** - Composition API with `<script setup>`
- **TypeScript** - Full type safety
- **Vite** - Fast build tool and dev server
- **Pinia** - State management
- **Vue Router** - Client-side routing
- **TailwindCSS** - Utility-first CSS framework
- **Chart.js + vue-chartjs** - Interactive charts
- **Lucide Vue** - Icon library

## Project Structure

```
frontend-vue/
├── src/
│   ├── components/
│   │   ├── charts/          # BarChart components
│   │   ├── filters/         # FilterSidebar, HostSelector
│   │   └── ui/              # MultiSelect and other UI components
│   ├── pages/
│   │   ├── Login.vue        # Authentication page
│   │   ├── Comparison.vue   # Main comparison view with charts
│   │   └── Upload.vue       # Data upload page
│   ├── stores/
│   │   ├── auth.ts          # Authentication state
│   │   ├── filters.ts       # Filter state
│   │   └── testRuns.ts      # Test data state
│   ├── composables/
│   │   ├── useApi.ts        # API client with auth
│   │   └── useChartData.ts  # Chart data utilities
│   ├── types/
│   │   └── testRun.ts       # TypeScript interfaces
│   ├── router/
│   │   └── index.ts         # Vue Router config
│   ├── App.vue
│   └── main.ts
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## Setup

### Prerequisites

- Node.js 18+ and npm
- Backend API running on http://localhost:8000

### Installation

```bash
cd frontend-vue
npm install
```

### Development

```bash
npm run dev
```

The app will be available at http://localhost:5173

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

### Type Checking

```bash
npx tsc --noEmit
```

## Usage

### Login

1. Navigate to http://localhost:5173
2. Enter your username and password (configured in backend .htpasswd file)
3. Click "Sign in"

### Compare Hosts

1. Use the Filter Sidebar to filter tests by:
   - Drive Type (NVMe, SATA, SAS)
   - I/O Pattern (randread, randwrite, read, write)
   - Block Size (4K, 8K, 64K, 1M, etc.)
   - Queue Depth (1, 8, 32, 64, etc.)
   - Protocol (Local, iSCSI, NFS)
   - Drive Model

2. Select hosts using the Host Selector dropdown

3. Choose metrics to compare:
   - IOPS
   - Average Latency
   - Bandwidth
   - P95 Latency
   - P99 Latency

4. Toggle between Grouped or Stacked chart types

5. Charts are grouped by test configuration (same block size, pattern, queue depth, etc.)

### Upload Data

1. Click "Upload Data" button in the header
2. Select FIO JSON output file
3. Fill in metadata:
   - Hostname (required)
   - Drive Model (required)
   - Drive Type (required)
   - Protocol (required)
   - Description (optional)
   - Test Date (optional, defaults to current time)
4. Click "Upload Test Data"

## API Configuration

The frontend expects the backend API at http://localhost:8000

To change the API URL, update `vite.config.ts`:

```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://your-api-server:8000',
        changeOrigin: true
      }
    }
  }
})
```

## Comparison Logic

- **Only comparable tests are grouped together**: Tests must have matching block_size, read_write_pattern, queue_depth, num_jobs, direct, sync, and duration
- **Multi-host comparison**: Compare the same test configuration across different hosts
- **Multi-metric visualization**: View multiple metrics side-by-side in grouped or stacked mode

## State Management

### Pinia Stores

**Auth Store** (`stores/auth.ts`)
- Manages authentication state
- Stores credentials in localStorage
- Provides auth header for API requests

**Filters Store** (`stores/filters.ts`)
- Manages active filter selections
- Tracks available filter options from API
- Generates query parameters for API requests

**Test Runs Store** (`stores/testRuns.ts`)
- Fetches and caches test run data
- Provides filtering and grouping utilities
- Manages loading and error states

## Development

### Adding New Filters

1. Add the filter to `ActiveFilters` interface in `types/testRun.ts`
2. Add corresponding logic in `stores/filters.ts`
3. Add UI component in `FilterSidebar.vue`

### Adding New Chart Types

1. Create new chart component in `components/charts/`
2. Add data transformation function in `composables/useChartData.ts`
3. Use in `Comparison.vue` page

### Adding New Pages

1. Create page component in `pages/`
2. Add route in `router/index.ts`
3. Add navigation link in appropriate component

## Troubleshooting

### Authentication Fails
- Verify backend is running on http://localhost:8000
- Check that user exists in backend .htpasswd file
- Clear browser localStorage and try again

### Charts Not Displaying
- Check browser console for errors
- Verify test data exists for selected hosts
- Ensure filters aren't too restrictive

### API Requests Failing
- Check Vite proxy configuration in `vite.config.ts`
- Verify backend API is accessible
- Check browser Network tab for request details

## License

Same as parent project
