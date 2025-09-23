/**
 * Chart Processing Utilities
 * Functions to process and prepare data for Chart.js visualizations
 */

import type { ChartData, ChartDataset } from 'chart.js'
import type { PerformanceData } from '@/types/performance'
import { normalizeValues, sortBlockSizes } from './dataTransform'

/**
 * Generate color palette for charts
 */
export function generateColorPalette(count: number, theme: 'light' | 'dark' = 'light'): string[] {
  const baseColors = theme === 'light'
    ? [
        '#3B82F6', // blue-500
        '#EF4444', // red-500
        '#10B981', // emerald-500
        '#F59E0B', // amber-500
        '#8B5CF6', // violet-500
        '#06B6D4', // cyan-500
        '#F97316', // orange-500
        '#84CC16', // lime-500
      ]
    : [
        '#60A5FA', // blue-400
        '#F87171', // red-400
        '#34D399', // emerald-400
        '#FBBF24', // amber-400
        '#A78BFA', // violet-400
        '#22D3EE', // cyan-400
        '#FB923C', // orange-400
        '#A3E635', // lime-400
      ]

  // Repeat colors if needed
  const colors: string[] = []
  for (let i = 0; i < count; i++) {
    colors.push(baseColors[i % baseColors.length])
  }

  return colors
}

/**
 * Create Chart.js dataset from performance data
 */
export function createChartDataset(
  label: string,
  data: (number | null)[],
  color: string,
  theme: 'light' | 'dark' = 'light'
): ChartDataset {
  const borderColor = color
  const backgroundColor = theme === 'light'
    ? color + '20' // Add transparency for light theme
    : color + '30' // Add transparency for dark theme

  return {
    label,
    data,
    borderColor,
    backgroundColor,
    borderWidth: 2,
    fill: false,
    tension: 0.1,
    pointRadius: 4,
    pointHoverRadius: 6,
  }
}

/**
 * Process IOPS comparison data for Chart.js
 */
export function processIOPSComparisonData(
  rawData: Array<{
    blockSize: string
    patterns: Array<{
      pattern: string
      iops: number | null
    }>
  }>,
  theme: 'light' | 'dark' = 'light'
): ChartData {
  const sortedBlockSizes = sortBlockSizes(rawData.map(d => d.blockSize))
  const colors = generateColorPalette(rawData.length, theme)

  // Get all unique patterns
  const allPatterns = new Set<string>()
  rawData.forEach(blockData => {
    blockData.patterns.forEach(p => allPatterns.add(p.pattern))
  })
  const patternArray = Array.from(allPatterns)

  const datasets: ChartDataset[] = patternArray.map((pattern, index) => {
    const data = sortedBlockSizes.map(blockSize => {
      const blockData = rawData.find(d => d.blockSize === blockSize)
      const patternData = blockData?.patterns.find(p => p.pattern === pattern)
      return patternData?.iops || null
    })

    return createChartDataset(
      pattern.replace('_', ' ').toUpperCase(),
      data,
      colors[index],
      theme
    )
  })

  return {
    labels: sortedBlockSizes,
    datasets
  }
}

/**
 * Process latency analysis data for Chart.js
 */
export function processLatencyAnalysisData(
  rawData: Array<{
    blockSize: string
    latency: number | null
    p95Latency: number | null
    p99Latency: number | null
  }>,
  theme: 'light' | 'dark' = 'light'
): ChartData {
  const sortedBlockSizes = sortBlockSizes(rawData.map(d => d.blockSize))
  const colors = generateColorPalette(3, theme)

  const datasets: ChartDataset[] = [
    {
      label: 'Average Latency (ms)',
      data: sortedBlockSizes.map(blockSize => {
        const data = rawData.find(d => d.blockSize === blockSize)
        return data?.latency || null
      }),
      borderColor: colors[0],
      backgroundColor: colors[0] + '20',
      borderWidth: 2,
      fill: false,
      tension: 0.1,
    },
    {
      label: '95th Percentile (ms)',
      data: sortedBlockSizes.map(blockSize => {
        const data = rawData.find(d => d.blockSize === blockSize)
        return data?.p95Latency || null
      }),
      borderColor: colors[1],
      backgroundColor: colors[1] + '20',
      borderWidth: 2,
      fill: false,
      tension: 0.1,
      borderDash: [5, 5],
    },
    {
      label: '99th Percentile (ms)',
      data: sortedBlockSizes.map(blockSize => {
        const data = rawData.find(d => d.blockSize === blockSize)
        return data?.p99Latency || null
      }),
      borderColor: colors[2],
      backgroundColor: colors[2] + '20',
      borderWidth: 2,
      fill: false,
      tension: 0.1,
      borderDash: [10, 5],
    }
  ]

  return {
    labels: sortedBlockSizes,
    datasets
  }
}

/**
 * Process bandwidth trends data for Chart.js
 */
export function processBandwidthTrendsData(
  rawData: Array<{
    blockSize: string
    bandwidth: number | null
  }>,
  theme: 'light' | 'dark' = 'light'
): ChartData {
  const sortedBlockSizes = sortBlockSizes(rawData.map(d => d.blockSize))
  const colors = generateColorPalette(1, theme)

  const datasets: ChartDataset[] = [{
    label: 'Bandwidth (MB/s)',
    data: sortedBlockSizes.map(blockSize => {
      const data = rawData.find(d => d.blockSize === blockSize)
      return data?.bandwidth || null
    }),
    borderColor: colors[0],
    backgroundColor: colors[0] + '20',
    borderWidth: 2,
    fill: true,
    tension: 0.1,
  }]

  return {
    labels: sortedBlockSizes,
    datasets
  }
}

/**
 * Process responsiveness data for Chart.js
 */
export function processResponsivenessData(
  rawData: Array<{
    blockSize: string
    responsiveness: number | null
  }>,
  theme: 'light' | 'dark' = 'light'
): ChartData {
  const sortedBlockSizes = sortBlockSizes(rawData.map(d => d.blockSize))
  const colors = generateColorPalette(1, theme)

  const datasets: ChartDataset[] = [{
    label: 'Responsiveness (ops/ms)',
    data: sortedBlockSizes.map(blockSize => {
      const data = rawData.find(d => d.blockSize === blockSize)
      return data?.responsiveness || null
    }),
    borderColor: colors[0],
    backgroundColor: colors[0] + '20',
    borderWidth: 2,
    fill: true,
    tension: 0.1,
  }]

  return {
    labels: sortedBlockSizes,
    datasets
  }
}

/**
 * Create heatmap data structure for visualization
 */
export function createHeatmapData(
  rawData: Array<{
    blockSize: string
    hostname: string
    pattern: string
    iops: number | null
    bandwidth: number | null
    responsiveness: number | null
  }>
): {
  blockSizes: string[]
  hostnames: string[]
  patterns: string[]
  data: Array<{
    blockSize: string
    hostname: string
    pattern: string
    iops: number | null
    bandwidth: number | null
    responsiveness: number | null
    normalizedIops: number
    normalizedBandwidth: number
    normalizedResponsiveness: number
  }>
} {
  const blockSizes = sortBlockSizes([...new Set(rawData.map(d => d.blockSize))])
  const hostnames = [...new Set(rawData.map(d => d.hostname))].sort()
  const patterns = [...new Set(rawData.map(d => d.pattern))].sort()

  // Normalize values for comparison
  const iopsValues = rawData.map(d => d.iops).filter(v => v !== null) as number[]
  const bandwidthValues = rawData.map(d => d.bandwidth).filter(v => v !== null) as number[]
  const responsivenessValues = rawData.map(d => d.responsiveness).filter(v => v !== null) as number[]

  const normalizedIops = normalizeValues(rawData.map(d => d.iops))
  const normalizedBandwidth = normalizeValues(rawData.map(d => d.bandwidth))
  const normalizedResponsiveness = normalizeValues(rawData.map(d => d.responsiveness))

  const processedData = rawData.map((item, index) => ({
    ...item,
    normalizedIops: normalizedIops[index] || 0,
    normalizedBandwidth: normalizedBandwidth[index] || 0,
    normalizedResponsiveness: normalizedResponsiveness[index] || 0,
  }))

  return {
    blockSizes,
    hostnames,
    patterns,
    data: processedData
  }
}

/**
 * Generate Chart.js options for performance charts
 */
export function createChartOptions(
  title: string,
  theme: 'light' | 'dark' = 'light',
  additionalOptions: any = {}
): any {
  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: title,
        color: theme === 'light' ? '#1F2937' : '#F9FAFB',
        font: {
          size: 16,
          weight: 'bold'
        }
      },
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: theme === 'light' ? '#374151' : '#D1D5DB',
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        enabled: true,
        backgroundColor: theme === 'light' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(31, 41, 55, 0.9)',
        titleColor: theme === 'light' ? '#1F2937' : '#F9FAFB',
        bodyColor: theme === 'light' ? '#374151' : '#D1D5DB',
        borderColor: theme === 'light' ? '#D1D5DB' : '#4B5563',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Block Size',
          color: theme === 'light' ? '#374151' : '#D1D5DB',
          font: {
            size: 14,
            weight: 'bold'
          }
        },
        ticks: {
          color: theme === 'light' ? '#6B7280' : '#9CA3AF',
          font: {
            size: 12
          }
        },
        grid: {
          color: theme === 'light' ? '#E5E7EB' : '#374151'
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Performance',
          color: theme === 'light' ? '#374151' : '#D1D5DB',
          font: {
            size: 14,
            weight: 'bold'
          }
        },
        ticks: {
          color: theme === 'light' ? '#6B7280' : '#9CA3AF',
          font: {
            size: 12
          }
        },
        grid: {
          color: theme === 'light' ? '#E5E7EB' : '#374151'
        }
      }
    }
  }

  return { ...baseOptions, ...additionalOptions }
}
