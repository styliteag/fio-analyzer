import type { TestRun, UserAccount, LoginCredentials, FilterState } from '@/types'

// TestRun validation
export function validateTestRun(testRun: unknown): testRun is TestRun {
  if (!testRun || typeof testRun !== 'object') return false

  const data = testRun as Record<string, unknown>

  // Required fields validation
  const requiredFields = [
    'id', 'timestamp', 'hostname', 'drive_model', 'drive_type',
    'test_name', 'block_size', 'read_write_pattern', 'queue_depth',
    'duration', 'iops', 'avg_latency', 'bandwidth'
  ]

  for (const field of requiredFields) {
    if (!(field in data) || data[field] === null || data[field] === undefined) {
      return false
    }
  }

  // Type validation
  if (typeof data.id !== 'number' || data.id <= 0) return false
  if (typeof data.timestamp !== 'string') return false
  if (typeof data.hostname !== 'string' || data.hostname.trim() === '') return false
  if (typeof data.drive_model !== 'string' || data.drive_model.trim() === '') return false
  if (typeof data.drive_type !== 'string' || data.drive_type.trim() === '') return false
  if (typeof data.test_name !== 'string' || data.test_name.trim() === '') return false
  if (typeof data.block_size !== 'string' || data.block_size.trim() === '') return false
  if (typeof data.read_write_pattern !== 'string' || data.read_write_pattern.trim() === '') return false
  if (typeof data.queue_depth !== 'number' || data.queue_depth <= 0) return false
  if (typeof data.duration !== 'number' || data.duration <= 0) return false
  if (typeof data.iops !== 'number' || data.iops < 0) return false
  if (typeof data.avg_latency !== 'number' || data.avg_latency < 0) return false
  if (typeof data.bandwidth !== 'number' || data.bandwidth < 0) return false

  // Value range validation
  const validBlockSizes = ['1K', '2K', '4K', '8K', '16K', '32K', '64K', '128K', '1M', '2M', '4M']
  if (!validBlockSizes.includes(data.block_size as string)) return false

  const validPatterns = ['randread', 'randwrite', 'read', 'write', 'rw', 'randrw']
  if (!validPatterns.includes(data.read_write_pattern as string)) return false

  const validDriveTypes = ['NVMe', 'SATA', 'SAS', 'SCSI']
  if (!validDriveTypes.includes(data.drive_type as string)) return false

  const validProtocols = ['Local', 'iSCSI', 'NFS', 'SMB', 'Fiber Channel']
  if (data.protocol && typeof data.protocol === 'string' && !validProtocols.includes(data.protocol)) return false

  return true
}

// User account validation
export function validateUserAccount(user: unknown): user is UserAccount {
  if (!user || typeof user !== 'object') return false

  const data = user as Record<string, unknown>

  // Required fields
  if (typeof data.username !== 'string' || data.username.trim() === '') return false
  if (!['admin', 'uploader'].includes(data.role as string)) return false

  // Optional fields
  if (data.permissions && !Array.isArray(data.permissions)) return false
  if (data.created_at && typeof data.created_at !== 'string') return false
  if (data.last_login && typeof data.last_login !== 'string') return false

  // Validate permissions structure
  if (data.permissions) {
    for (const permission of data.permissions as unknown[]) {
      if (!permission || typeof permission !== 'object') return false
      const perm = permission as Record<string, unknown>
      if (typeof perm.resource !== 'string') return false
      if (!Array.isArray(perm.actions)) return false
      if (!perm.actions.every((action: unknown) => typeof action === 'string')) return false
    }
  }

  return true
}

// Login credentials validation
export function validateLoginCredentials(credentials: unknown): credentials is LoginCredentials {
  if (!credentials || typeof credentials !== 'object') return false

  const data = credentials as Record<string, unknown>

  if (typeof data.username !== 'string' || data.username.trim() === '') return false
  if (typeof data.password !== 'string' || data.password.trim() === '') return false

  // Basic length validation
  if ((data.username as string).length < 3) return false
  if ((data.password as string).length < 6) return false

  return true
}

// Filter state validation
export function validateFilterState(filters: any): filters is FilterState {
  if (!filters || typeof filters !== 'object') return false

  const filterKeys = [
    'selectedBlockSizes', 'selectedPatterns', 'selectedQueueDepths',
    'selectedNumJobs', 'selectedProtocols', 'selectedHostDiskCombinations'
  ]

  for (const key of filterKeys) {
    if (filters[key] !== undefined) {
      if (!Array.isArray(filters[key])) return false
      if (!filters[key].every((item: any) => typeof item === 'string' || typeof item === 'number')) return false
    }
  }

  return true
}

// API response validation
export function validateApiResponse<T>(
  data: any,
  validator: (item: any) => item is T
): data is T[] {
  if (!Array.isArray(data)) return false
  return data.every(validator)
}

// Form validation helpers
export interface ValidationResult {
  isValid: boolean
  errors: Record<string, string>
}

export function validateRequired(value: any, fieldName: string): ValidationResult {
  const isValid = value !== null && value !== undefined && String(value).trim() !== ''

  return {
    isValid,
    errors: isValid ? {} : { [fieldName]: `${fieldName} is required` }
  }
}

export function validateMinLength(value: string, minLength: number, fieldName: string): ValidationResult {
  const isValid = typeof value === 'string' && value.length >= minLength

  return {
    isValid,
    errors: isValid ? {} : { [fieldName]: `${fieldName} must be at least ${minLength} characters` }
  }
}

export function validateMaxLength(value: string, maxLength: number, fieldName: string): ValidationResult {
  const isValid = typeof value === 'string' && value.length <= maxLength

  return {
    isValid,
    errors: isValid ? {} : { [fieldName]: `${fieldName} must be no more than ${maxLength} characters` }
  }
}

export function validateEmail(value: string, fieldName: string): ValidationResult {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const isValid = typeof value === 'string' && emailRegex.test(value)

  return {
    isValid,
    errors: isValid ? {} : { [fieldName]: `${fieldName} must be a valid email address` }
  }
}

export function validateNumeric(value: any, fieldName: string): ValidationResult {
  const num = Number(value)
  const isValid = !isNaN(num) && isFinite(num)

  return {
    isValid,
    errors: isValid ? {} : { [fieldName]: `${fieldName} must be a valid number` }
  }
}

export function validateRange(value: number, min: number, max: number, fieldName: string): ValidationResult {
  const isValid = typeof value === 'number' && value >= min && value <= max

  return {
    isValid,
    errors: isValid ? {} : { [fieldName]: `${fieldName} must be between ${min} and ${max}` }
  }
}

export function validateInList<T>(value: T, allowedValues: T[], fieldName: string): ValidationResult {
  const isValid = allowedValues.includes(value)

  return {
    isValid,
    errors: isValid ? {} : { [fieldName]: `${fieldName} must be one of: ${allowedValues.join(', ')}` }
  }
}

// Combine multiple validations
export function combineValidations(...validations: ValidationResult[]): ValidationResult {
  const combined: ValidationResult = {
    isValid: true,
    errors: {}
  }

  for (const validation of validations) {
    combined.isValid = combined.isValid && validation.isValid
    Object.assign(combined.errors, validation.errors)
  }

  return combined
}

// User creation validation
export function validateUserCreation(data: {
  username: string
  password: string
  role: string
}): ValidationResult {
  return combineValidations(
    validateRequired(data.username, 'Username'),
    validateMinLength(data.username, 3, 'Username'),
    validateMaxLength(data.username, 50, 'Username'),
    validateRequired(data.password, 'Password'),
    validateMinLength(data.password, 8, 'Password'),
    validateRequired(data.role, 'Role'),
    validateInList(data.role, ['admin', 'uploader'], 'Role')
  )
}

// Test run upload validation
export function validateTestRunUpload(data: {
  file?: File
  content?: string
}): ValidationResult {
  const validations: ValidationResult[] = []

  if (data.file) {
    // File validation
    if (data.file.size > 50 * 1024 * 1024) { // 50MB limit
      validations.push({
        isValid: false,
        errors: { file: 'File size must be less than 50MB' }
      })
    }

    if (!data.file.name.endsWith('.json')) {
      validations.push({
        isValid: false,
        errors: { file: 'File must be a JSON file' }
      })
    }
  } else if (data.content) {
    // Content validation
    try {
      JSON.parse(data.content)
    } catch {
      validations.push({
        isValid: false,
        errors: { content: 'Content must be valid JSON' }
      })
    }
  } else {
    validations.push({
      isValid: false,
      errors: { file: 'Either file or content is required' }
    })
  }

  return combineValidations(...validations)
}

// Filter parameters validation
export function validateFilterParams(params: Record<string, any>): ValidationResult {
  const validations: ValidationResult[] = []

  // Validate limit
  if (params.limit !== undefined) {
    validations.push(validateNumeric(params.limit, 'Limit'))
    if (typeof params.limit === 'number') {
      validations.push(validateRange(params.limit, 1, 10000, 'Limit'))
    }
  }

  // Validate offset
  if (params.offset !== undefined) {
    validations.push(validateNumeric(params.offset, 'Offset'))
    if (typeof params.offset === 'number') {
      validations.push(validateRange(params.offset, 0, 1000000, 'Offset'))
    }
  }

  return combineValidations(...validations)
}

// Sanitize input data
export function sanitizeString(input: string): string {
  return input.trim().replace(/[<>]/g, '')
}

export function sanitizeNumeric(input: any): number | null {
  const num = Number(input)
  return isNaN(num) ? null : num
}

// Deep validation for complex objects
export function validateTestRuns(testRuns: any[]): { valid: TestRun[], invalid: any[] } {
  const valid: TestRun[] = []
  const invalid: any[] = []

  testRuns.forEach(item => {
    if (validateTestRun(item)) {
      valid.push(item)
    } else {
      invalid.push(item)
    }
  })

  return { valid, invalid }
}

// Performance validation
export function validatePerformanceMetrics(metrics: {
  iops?: number
  avg_latency?: number
  bandwidth?: number
  p95_latency?: number
  p99_latency?: number
}): ValidationResult {
  const validations: ValidationResult[] = []

  if (metrics.iops !== undefined) {
    validations.push(validateNumeric(metrics.iops, 'IOPS'))
    if (typeof metrics.iops === 'number') {
      validations.push(validateRange(metrics.iops, 0, 10000000, 'IOPS'))
    }
  }

  if (metrics.avg_latency !== undefined) {
    validations.push(validateNumeric(metrics.avg_latency, 'Average Latency'))
    if (typeof metrics.avg_latency === 'number') {
      validations.push(validateRange(metrics.avg_latency, 0, 1000, 'Average Latency'))
    }
  }

  if (metrics.bandwidth !== undefined) {
    validations.push(validateNumeric(metrics.bandwidth, 'Bandwidth'))
    if (typeof metrics.bandwidth === 'number') {
      validations.push(validateRange(metrics.bandwidth, 0, 100000, 'Bandwidth'))
    }
  }

  if (metrics.p95_latency !== undefined) {
    validations.push(validateNumeric(metrics.p95_latency, 'P95 Latency'))
    if (typeof metrics.p95_latency === 'number') {
      validations.push(validateRange(metrics.p95_latency, 0, 10000, 'P95 Latency'))
    }
  }

  if (metrics.p99_latency !== undefined) {
    validations.push(validateNumeric(metrics.p99_latency, 'P99 Latency'))
    if (typeof metrics.p99_latency === 'number') {
      validations.push(validateRange(metrics.p99_latency, 0, 10000, 'P99 Latency'))
    }
  }

  return combineValidations(...validations)
}
