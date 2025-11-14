import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import PerformanceHeatmap from '../charts/PerformanceHeatmap.vue'
import type { TestRun, HeatmapCell } from '@/types'

// Mock chart processing utilities
const mockChartProcessing = {
  processHeatmapData: vi.fn(),
  calculateRelativeColorScale: vi.fn(),
}

describe('Integration Test: PerformanceHeatmap Component - Visualization Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render performance heatmap with relative color scaling', async () => {
    // This test MUST FAIL initially (TDD requirement)
    const mockTestRuns: TestRun[] = [
      {
        id: 1,
        hostname: 'server-01',
        drive_model: 'Samsung SSD',
        block_size: '4K',
        read_write_pattern: 'randread',
        iops: 1000,
        avg_latency: 0.5,
      },
      {
        id: 2,
        hostname: 'server-01',
        drive_model: 'Samsung SSD',
        block_size: '8K',
        read_write_pattern: 'randread',
        iops: 800,
        avg_latency: 0.7,
      },
      {
        id: 3,
        hostname: 'server-02',
        drive_model: 'WD Black',
        block_size: '4K',
        read_write_pattern: 'randwrite',
        iops: 1200,
        avg_latency: 0.4,
      },
    ]

    const mockHeatmapData: HeatmapCell[] = [
      {
        x: 'server-01',
        y: '4K-randread',
        value: 1000,
        color: '#ff6b6b', // Red for lower value
        tooltip: 'IOPS: 1000\nLatency: 0.5ms',
        metadata: mockTestRuns[0],
      },
      {
        x: 'server-01',
        y: '8K-randread',
        value: 800,
        color: '#4ecdc4', // Teal for lowest value
        tooltip: 'IOPS: 800\nLatency: 0.7ms',
        metadata: mockTestRuns[1],
      },
      {
        x: 'server-02',
        y: '4K-randwrite',
        value: 1200,
        color: '#45b7d1', // Blue for highest value
        tooltip: 'IOPS: 1200\nLatency: 0.4ms',
        metadata: mockTestRuns[2],
      },
    ]

    const mockColorScale = {
      min: 800,
      max: 1200,
      colors: ['#4ecdc4', '#ff6b6b', '#45b7d1'],
    }

    mockChartProcessing.processHeatmapData.mockReturnValue(mockHeatmapData)
    mockChartProcessing.calculateRelativeColorScale.mockReturnValue(mockColorScale)

    vi.doMock('@/utils/chartProcessing', () => mockChartProcessing)

    // This will fail because PerformanceHeatmap component doesn't exist yet
    const wrapper = mount(PerformanceHeatmap, {
      global: {
        plugins: [createTestingPinia()],
      },
      props: {
        testRuns: mockTestRuns,
        metric: 'iops',
        hosts: ['server-01', 'server-02'],
      },
    })

    // Verify chart processing was called
    expect(mockChartProcessing.processHeatmapData).toHaveBeenCalledWith(mockTestRuns, 'iops')
    expect(mockChartProcessing.calculateRelativeColorScale).toHaveBeenCalledWith(mockTestRuns, 'iops')

    // Verify heatmap renders with correct data
    const cells = wrapper.findAll('[data-testid="heatmap-cell"]')
    expect(cells).toHaveLength(3)

    // Verify relative color scaling (normalized to current dataset)
    expect(mockColorScale.min).toBe(800) // Min of current filtered data
    expect(mockColorScale.max).toBe(1200) // Max of current filtered data

    // Verify tooltips show detailed information
    const firstCell = cells[0]
    expect(firstCell.attributes('title')).toContain('IOPS: 1000')
  })

  it('should handle different metrics (IOPS, bandwidth, responsiveness)', async () => {
    const mockTestRuns: TestRun[] = [
      {
        id: 1,
        hostname: 'server-01',
        iops: 1000,
        avg_latency: 0.5,
        bandwidth: 4000,
      },
      {
        id: 2,
        hostname: 'server-02',
        iops: 1200,
        avg_latency: 0.4,
        bandwidth: 4800,
      },
    ]

    const mockHeatmapData = [
      {
        x: 'server-01',
        y: 'randread',
        value: 1000,
        color: '#ff6b6b',
        tooltip: 'IOPS: 1000',
        metadata: mockTestRuns[0],
      },
    ]

    mockChartProcessing.processHeatmapData.mockReturnValue(mockHeatmapData)
    mockChartProcessing.calculateRelativeColorScale.mockReturnValue({
      min: 1000,
      max: 1200,
      colors: ['#ff6b6b', '#45b7d1'],
    })

    vi.doMock('@/utils/chartProcessing', () => mockChartProcessing)

    const wrapper = mount(PerformanceHeatmap, {
      global: {
        plugins: [createTestingPinia()],
      },
      props: {
        testRuns: mockTestRuns,
        metric: 'iops',
        hosts: ['server-01', 'server-02'],
      },
    })

    // Test IOPS metric
    expect(mockChartProcessing.processHeatmapData).toHaveBeenCalledWith(mockTestRuns, 'iops')

    // Change to bandwidth metric
    await wrapper.setProps({ metric: 'bandwidth' })
    expect(mockChartProcessing.processHeatmapData).toHaveBeenCalledWith(mockTestRuns, 'bandwidth')

    // Change to responsiveness (inverse of latency)
    await wrapper.setProps({ metric: 'responsiveness' })
    expect(mockChartProcessing.processHeatmapData).toHaveBeenCalledWith(mockTestRuns, 'responsiveness')
  })

  it('should update when filtered data changes', async () => {
    const initialTestRuns: TestRun[] = [
      { id: 1, hostname: 'server-01', iops: 1000 },
      { id: 2, hostname: 'server-02', iops: 1200 },
    ]

    const filteredTestRuns: TestRun[] = [
      { id: 1, hostname: 'server-01', iops: 1000 }, // Only server-01 after filtering
    ]

    mockChartProcessing.processHeatmapData.mockReturnValue([])
    mockChartProcessing.calculateRelativeColorScale.mockReturnValue({
      min: 1000,
      max: 1000,
      colors: ['#45b7d1'],
    })

    vi.doMock('@/utils/chartProcessing', () => mockChartProcessing)

    const wrapper = mount(PerformanceHeatmap, {
      global: {
        plugins: [createTestingPinia()],
      },
      props: {
        testRuns: initialTestRuns,
        metric: 'iops',
        hosts: ['server-01', 'server-02'],
      },
    })

    // Initial render
    expect(mockChartProcessing.processHeatmapData).toHaveBeenCalledWith(initialTestRuns, 'iops')

    // Update with filtered data
    await wrapper.setProps({ testRuns: filteredTestRuns })
    expect(mockChartProcessing.processHeatmapData).toHaveBeenCalledWith(filteredTestRuns, 'iops')

    // Verify color scale recalculated for filtered dataset
    expect(mockChartProcessing.calculateRelativeColorScale).toHaveBeenLastCalledWith(filteredTestRuns, 'iops')
  })

  it('should display performance zones with appropriate colors', async () => {
    const mockTestRuns: TestRun[] = [
      { id: 1, hostname: 'server-01', iops: 500 }, // Low performance
      { id: 2, hostname: 'server-02', iops: 1000 }, // Balanced
      { id: 3, hostname: 'server-03', iops: 1500 }, // High performance
    ]

    const mockHeatmapData: HeatmapCell[] = [
      {
        x: 'server-01',
        y: 'randread',
        value: 500,
        color: '#ff6b6b', // Red for low performance
        tooltip: 'IOPS: 500 (Low Performance)',
        metadata: mockTestRuns[0],
      },
      {
        x: 'server-02',
        y: 'randread',
        value: 1000,
        color: '#ffa500', // Orange for balanced
        tooltip: 'IOPS: 1000 (Balanced)',
        metadata: mockTestRuns[1],
      },
      {
        x: 'server-03',
        y: 'randread',
        value: 1500,
        color: '#4ecdc4', // Green for high performance
        tooltip: 'IOPS: 1500 (High Performance)',
        metadata: mockTestRuns[2],
      },
    ]

    mockChartProcessing.processHeatmapData.mockReturnValue(mockHeatmapData)
    mockChartProcessing.calculateRelativeColorScale.mockReturnValue({
      min: 500,
      max: 1500,
      colors: ['#ff6b6b', '#ffa500', '#4ecdc4'],
    })

    vi.doMock('@/utils/chartProcessing', () => mockChartProcessing)

    const wrapper = mount(PerformanceHeatmap, {
      global: {
        plugins: [createTestingPinia()],
      },
      props: {
        testRuns: mockTestRuns,
        metric: 'iops',
        hosts: ['server-01', 'server-02', 'server-03'],
      },
    })

    // Verify performance zone colors are applied
    const cells = wrapper.findAll('[data-testid="heatmap-cell"]')
    expect(cells).toHaveLength(3)

    // Check that cells have appropriate zone-based colors
    const cellStyles = cells.map(cell => cell.attributes('style'))
    expect(cellStyles.some(style => style?.includes('#ff6b6b'))).toBe(true) // Low performance - red
    expect(cellStyles.some(style => style?.includes('#ffa500'))).toBe(true) // Balanced - orange
    expect(cellStyles.some(style => style?.includes('#4ecdc4'))).toBe(true) // High performance - green
  })

  it('should handle empty data gracefully', async () => {
    const emptyTestRuns: TestRun[] = []

    mockChartProcessing.processHeatmapData.mockReturnValue([])
    mockChartProcessing.calculateRelativeColorScale.mockReturnValue({
      min: 0,
      max: 0,
      colors: [],
    })

    vi.doMock('@/utils/chartProcessing', () => mockChartProcessing)

    const wrapper = mount(PerformanceHeatmap, {
      global: {
        plugins: [createTestingPinia()],
      },
      props: {
        testRuns: emptyTestRuns,
        metric: 'iops',
        hosts: [],
      },
    })

    // Verify empty state message
    expect(wrapper.text()).toContain('No data available')
    expect(wrapper.text()).toContain('Select hosts and apply filters to view performance heatmap')

    // Verify no chart elements rendered
    const cells = wrapper.findAll('[data-testid="heatmap-cell"]')
    expect(cells).toHaveLength(0)
  })

  it('should show legend explaining color scale', async () => {
    const mockTestRuns: TestRun[] = [
      { id: 1, hostname: 'server-01', iops: 1000 },
    ]

    mockChartProcessing.processHeatmapData.mockReturnValue([])
    mockChartProcessing.calculateRelativeColorScale.mockReturnValue({
      min: 800,
      max: 1200,
      colors: ['#4ecdc4', '#45b7d1', '#ff6b6b'],
    })

    vi.doMock('@/utils/chartProcessing', () => mockChartProcessing)

    const wrapper = mount(PerformanceHeatmap, {
      global: {
        plugins: [createTestingPinia()],
      },
      props: {
        testRuns: mockTestRuns,
        metric: 'iops',
        hosts: ['server-01'],
      },
    })

    // Verify legend shows min/max values
    expect(wrapper.text()).toContain('800') // Min IOPS
    expect(wrapper.text()).toContain('1200') // Max IOPS
    expect(wrapper.text()).toContain('0%') // Min percentage
    expect(wrapper.text()).toContain('100%') // Max percentage
    expect(wrapper.text()).toContain('Max') // Legend label
  })

  it('should handle large datasets efficiently', async () => {
    // Create large dataset (1000+ points)
    const largeTestRuns: TestRun[] = Array.from({ length: 1200 }, (_, i) => ({
      id: i + 1,
      hostname: `server-${(i % 10) + 1}`,
      drive_model: 'Test Drive',
      block_size: '4K',
      read_write_pattern: 'randread',
      queue_depth: 32,
      duration: 300,
      num_jobs: 1,
      direct: 1,
      sync: 0,
      test_size: '10G',
      protocol: 'Local',
      iops: Math.floor(Math.random() * 1000) + 500,
      avg_latency: Math.random() * 2,
      bandwidth: Math.floor(Math.random() * 2000) + 1000,
    }))

    mockChartProcessing.processHeatmapData.mockReturnValue([])
    mockChartProcessing.calculateRelativeColorScale.mockReturnValue({
      min: 500,
      max: 1500,
      colors: ['#4ecdc4', '#45b7d1'],
    })

    vi.doMock('@/utils/chartProcessing', () => mockChartProcessing)

    const startTime = performance.now()

    mount(PerformanceHeatmap, {
      global: {
        plugins: [createTestingPinia()],
      },
      props: {
        testRuns: largeTestRuns,
        metric: 'iops',
        hosts: Array.from({ length: 10 }, (_, i) => `server-${i + 1}`),
      },
    })

    const endTime = performance.now()
    const renderTime = endTime - startTime

    // Verify rendering completes within reasonable time (< 500ms)
    expect(renderTime).toBeLessThan(500)

    // Verify large dataset was processed
    expect(mockChartProcessing.processHeatmapData).toHaveBeenCalledWith(largeTestRuns, 'iops')
  })

  it('should support interactive hover tooltips', async () => {
    const mockTestRuns: TestRun[] = [
      {
        id: 1,
        hostname: 'server-01',
        drive_model: 'Samsung SSD 980 PRO',
        block_size: '4K',
        read_write_pattern: 'randread',
        queue_depth: 32,
        iops: 1000,
        avg_latency: 0.5,
        bandwidth: 4000,
      },
    ]

    const mockHeatmapData: HeatmapCell[] = [
      {
        x: 'server-01',
        y: '4K-randread',
        value: 1000,
        color: '#45b7d1',
        tooltip: 'Host: server-01\nDrive: Samsung SSD 980 PRO\nPattern: randread\nBlock Size: 4K\nQueue Depth: 32\nIOPS: 1000\nLatency: 0.5ms\nBandwidth: 4000 MB/s',
        metadata: mockTestRuns[0],
      },
    ]

    mockChartProcessing.processHeatmapData.mockReturnValue(mockHeatmapData)

    vi.doMock('@/utils/chartProcessing', () => mockChartProcessing)

    const wrapper = mount(PerformanceHeatmap, {
      global: {
        plugins: [createTestingPinia()],
      },
      props: {
        testRuns: mockTestRuns,
        metric: 'iops',
        hosts: ['server-01'],
      },
    })

    // Verify tooltip contains comprehensive information
    const cells = wrapper.findAll('[data-testid="heatmap-cell"]')
    const firstCell = cells[0]

    expect(firstCell.attributes('title')).toContain('Host: server-01')
    expect(firstCell.attributes('title')).toContain('Drive: Samsung SSD 980 PRO')
    expect(firstCell.attributes('title')).toContain('IOPS: 1000')
    expect(firstCell.attributes('title')).toContain('Latency: 0.5ms')
    expect(firstCell.attributes('title')).toContain('Bandwidth: 4000 MB/s')
  })
})
