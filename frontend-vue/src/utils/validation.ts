import type { TestRun, UserAccount, LoginCredentials, FilterState } from '@/types'

// TestRun validation
export function validateTestRun(testRun: any): testRun is TestRun {
  if (!testRun || typeof testRun !== 'object') return false

  // Required fields validation
  const requiredFields = [
    'id', 'timestamp', 'hostname', 'drive_model', 'drive_type',
    'test_name', 'block_size', 'read_write_pattern', 'queue_depth',
    'duration', 'iops', 'avg_latency', 'bandwidth'
  ]

  for (const field of requiredFields) {
    if (!(field in testRun) || testRun[field] === null || testRun[field] === undefined) {
      return false
    }
  }

  // Type validation
  if (typeof testRun.id !== 'number' || testRun.id <= 0) return false
  if (typeof testRun.timestamp !== 'string') return false
  if (typeof testRun.hostname !== 'string' || testRun.hostname.trim() === '') return false
  if (typeof testRun.drive_model !== 'string' || testRun.drive_model.trim() === '') return false
  if (typeof testRun.drive_type !== 'string' || testRun.drive_type.trim() === '') return false
  if (typeof testRun.test_name !== 'string' || testRun.test_name.trim() === '') return false
  if (typeof testRun.block_size !== 'string' || testRun.block_size.trim() === '') return false
  if (typeof testRun.read_write_pattern !== 'string' || testRun.read_write_pattern.trim() === '') return false
  if (typeof testRun.queue_depth !== 'number' || testRun.queue_depth <= 0) return false
  if (typeof testRun.duration !== 'number' || testRun.duration <= 0) return false
  if (typeof testRun.iops !== 'number' || testRun.iops < 0) return false
  if (typeof testRun.avg_latency !== 'number' || testRun.avg_latency < 0) return false
  if (typeof testRun.bandwidth !== 'number' || testRun.bandwidth < 0) return false

  // Value range validation
  const validBlockSizes = ['1K', '2K', '4K', '8K', '16K', '32K', '64K', '128K', '1M', '2M', '4M']
  if (!validBlockSizes.includes(testRun.block_size)) return false

  const validPatterns = ['randread', 'randwrite', 'read', 'write', 'rw', 'randrw']
  if (!validPatterns.includes(testRun.read_write_pattern)) return false

  const validDriveTypes = ['NVMe', 'SATA', 'SAS', 'SCSI']
  if (!validDriveTypes.includes(testRun.drive_type)) return false

  const validProtocols = ['Local', 'iSCSI', 'NFS', 'SMB', 'Fiber Channel']
  if (testRun.protocol && !validProtocols.includes(testRun.protocol)) return false

  return true
}

// User account validation
export function validateUserAccount(user: any): user is UserAccount {
  if (!user || typeof user !== 'object') return false

  // Required fields
  if (typeof user.username !== 'string' || user.username.trim() === '') return false
  if (!['admin', 'uploader'].includes(user.role)) return false

  // Optional fields
  if (user.permissions && !Array.isArray(user.permissions)) return false
  if (user.created_at && typeof user.created_at !== 'string') return false
  if (user.last_login && typeof user.last_login !== 'string') return false

  // Validate permissions structure
  if (user.permissions) {
    for (const permission of user.permissions) {
      if (!permission || typeof permission !== 'object') return false
      if (typeof permission.resource !== 'string') return false
      if (!Array.isArray(permission.actions)) return false
      if (!permission.actions.every((action: any) => typeof action === 'string')) return false
    }
  }

  return true
}

// Login credentials validation
export function validateLoginCredentials(credentials: any): credentials is LoginCredentials {
  if (!credentials || typeof credentials !== 'object') return false

  if (typeof credentials.username !== 'string' || credentials.username.trim() === '') return false
  if (typeof credentials.password !== 'string' || credentials.password.trim() === '') return false

  // Basic length validation
  if (credentials.username.length < 3) return false
  if (credentials.password.length < 6) return false

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
