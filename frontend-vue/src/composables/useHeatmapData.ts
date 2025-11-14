import type { TestRun, MetricType } from '../types/testRun'

export interface HeatmapCell {
  row: string
  col: string
  value: number | null
  rawData: TestRun
}

export interface HeatmapData {
  rows: string[]
  cols: string[]
  cells: HeatmapCell[]
  min: number
  max: number
}

export function useHeatmapData() {
  // Create heatmap: rows = configs, cols = hosts
  function createHostHeatmap(
    testRuns: TestRun[],
    metric: MetricType
  ): HeatmapData {
    const rowSet = new Set<string>()
    const colSet = new Set<string>()
    const cells: HeatmapCell[] = []
    let min = Infinity
    let max = -Infinity

    // Build cells
    testRuns.forEach((run) => {
      if (!run.hostname || run[metric] === null) return

      const row = getConfigKey(run)
      const col = run.hostname
      const value = run[metric]!

      rowSet.add(row)
      colSet.add(col)
      cells.push({ row, col, value, rawData: run })

      if (value < min) min = value
      if (value > max) max = value
    })

    return {
      rows: Array.from(rowSet).sort(),
      cols: Array.from(colSet).sort(),
      cells,
      min: min === Infinity ? 0 : min,
      max: max === -Infinity ? 100 : max
    }
  }

  // Create heatmap: rows = block sizes, cols = patterns
  function createMatrixHeatmap(
    testRuns: TestRun[],
    metric: MetricType,
    rowDimension: 'block_size' | 'queue_depth' | 'protocol',
    colDimension: 'read_write_pattern' | 'drive_type' | 'protocol'
  ): HeatmapData {
    const rowSet = new Set<string>()
    const colSet = new Set<string>()
    const cellMap = new Map<string, { value: number; count: number; rawData: TestRun[] }>()
    let min = Infinity
    let max = -Infinity

    // Aggregate cells (average if multiple tests match)
    testRuns.forEach((run) => {
      if (run[metric] === null) return

      const row = String(run[rowDimension])
      const col = String(run[colDimension])
      const value = run[metric]!
      const key = `${row}|${col}`

      rowSet.add(row)
      colSet.add(col)

      if (!cellMap.has(key)) {
        cellMap.set(key, { value: 0, count: 0, rawData: [] })
      }

      const cell = cellMap.get(key)!
      cell.value += value
      cell.count += 1
      cell.rawData.push(run)
    })

    // Build cells with averages
    const cells: HeatmapCell[] = []
    cellMap.forEach((data, key) => {
      const [row, col] = key.split('|')
      const avgValue = data.value / data.count

      cells.push({
        row,
        col,
        value: avgValue,
        rawData: data.rawData[0] // Use first as representative
      })

      if (avgValue < min) min = avgValue
      if (avgValue > max) max = avgValue
    })

    return {
      rows: sortDimension(Array.from(rowSet), rowDimension),
      cols: sortDimension(Array.from(colSet), colDimension),
      cells,
      min: min === Infinity ? 0 : min,
      max: max === -Infinity ? 100 : max
    }
  }

  // Get color based on value (min-max normalization)
  function getHeatmapColor(value: number, min: number, max: number): string {
    if (value === null) return '#f3f4f6' // gray-100

    const normalized = (value - min) / (max - min)

    // Color scale: red (0) -> yellow (0.5) -> green (1)
    if (normalized < 0.5) {
      // Red to yellow
      const r = 255
      const g = Math.round(255 * (normalized * 2))
      return `rgb(${r}, ${g}, 0)`
    } else {
      // Yellow to green
      const r = Math.round(255 * (1 - (normalized - 0.5) * 2))
      const g = 255
      return `rgb(${r}, ${g}, 0)`
    }
  }

  // Get configuration key for grouping
  function getConfigKey(run: TestRun): string {
    return `${run.read_write_pattern} ${run.block_size} QD${run.queue_depth}`
  }

  // Sort dimension values logically
  function sortDimension(values: string[], dimension: string): string[] {
    if (dimension === 'block_size') {
      // Sort by size: 4K, 8K, 16K, 64K, 1M, etc.
      return values.sort((a, b) => {
        const sizeA = parseBlockSize(a)
        const sizeB = parseBlockSize(b)
        return sizeA - sizeB
      })
    } else if (dimension === 'queue_depth') {
      // Sort numerically
      return values.sort((a, b) => Number(a) - Number(b))
    } else {
      // Alphabetical
      return values.sort()
    }
  }

  // Parse block size to bytes for sorting
  function parseBlockSize(size: string): number {
    const match = size.match(/^(\d+)([KM]?)$/)
    if (!match) return 0

    const num = parseInt(match[1])
    const unit = match[2]

    if (unit === 'K') return num * 1024
    if (unit === 'M') return num * 1024 * 1024
    return num
  }

  return {
    createHostHeatmap,
    createMatrixHeatmap,
    getHeatmapColor,
    getConfigKey
  }
}
