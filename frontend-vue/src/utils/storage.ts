// Local storage utilities with error handling and type safety

export interface StorageOptions {
  prefix?: string
  ttl?: number // Time to live in milliseconds
  compress?: boolean
}

export interface StoredItem<T> {
  data: T
  timestamp: number
  ttl?: number
}

class StorageManager {
  protected prefix: string

  constructor(prefix = 'fio') {
    this.prefix = prefix
  }

  protected getKey(key: string): string {
    return `${this.prefix}:${key}`
  }

  protected isExpired(item: StoredItem<unknown>): boolean {
    if (!item.ttl) return false
    return Date.now() - item.timestamp > item.ttl
  }

  set<T>(key: string, value: T, options: StorageOptions = {}): boolean {
    try {
      const item: StoredItem<T> = {
        data: value,
        timestamp: Date.now(),
        ttl: options.ttl,
      }

      const serialized = JSON.stringify(item)
      const storageKey = this.getKey(key)

      localStorage.setItem(storageKey, serialized)
      return true
    } catch (error) {
      console.warn('Failed to save to localStorage:', error)
      return false
    }
  }

  get<T>(key: string, defaultValue?: T): T | null {
    try {
      const storageKey = this.getKey(key)
      const stored = localStorage.getItem(storageKey)

      if (!stored) return defaultValue || null

      const item: StoredItem<T> = JSON.parse(stored)

      if (this.isExpired(item)) {
        this.remove(key)
        return defaultValue || null
      }

      return item.data
    } catch (error) {
      console.warn('Failed to read from localStorage:', error)
      return defaultValue || null
    }
  }

  has(key: string): boolean {
    try {
      const storageKey = this.getKey(key)
      const stored = localStorage.getItem(storageKey)

      if (!stored) return false

      const item = JSON.parse(stored)
      return !this.isExpired(item)
    } catch {
      return false
    }
  }

  remove(key: string): boolean {
    try {
      const storageKey = this.getKey(key)
      localStorage.removeItem(storageKey)
      return true
    } catch (error) {
      console.warn('Failed to remove from localStorage:', error)
      return false
    }
  }

  clear(): boolean {
    try {
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith(`${this.prefix}:`)) {
          localStorage.removeItem(key)
        }
      })
      return true
    } catch (error) {
      console.warn('Failed to clear localStorage:', error)
      return false
    }
  }

  getAllKeys(): string[] {
    try {
      const keys = Object.keys(localStorage)
      return keys
        .filter(key => key.startsWith(`${this.prefix}:`))
        .map(key => key.replace(`${this.prefix}:`, ''))
    } catch {
      return []
    }
  }

  getStorageInfo(): {
    totalKeys: number
    appKeys: number
    estimatedSize: string
  } {
    try {
      const allKeys = Object.keys(localStorage)
      const appKeys = allKeys.filter(key => key.startsWith(`${this.prefix}:`))

      // Rough estimation of storage size
      let totalSize = 0
      allKeys.forEach(key => {
        const value = localStorage.getItem(key)
        if (value) {
          totalSize += key.length + value.length
        }
      })

      const sizeInKB = (totalSize * 2) / 1024 // Rough UTF-16 estimation

      return {
        totalKeys: allKeys.length,
        appKeys: appKeys.length,
        estimatedSize: `${sizeInKB.toFixed(2)} KB`,
      }
    } catch {
      return {
        totalKeys: 0,
        appKeys: 0,
        estimatedSize: '0 KB',
      }
    }
  }
}

// Create default storage manager
export const storage = new StorageManager()

// Specialized storage utilities for different data types

// Session storage (alternative to localStorage)
export class SessionStorageManager extends StorageManager {
  set<T>(key: string, value: T, options: StorageOptions = {}): boolean {
    try {
      const item: StoredItem<T> = {
        data: value,
        timestamp: Date.now(),
        ttl: options.ttl,
      }

      const serialized = JSON.stringify(item)
      const storageKey = this.getKey(key)

      window.sessionStorage.setItem(storageKey, serialized)
      return true
    } catch (error) {
      console.warn('Failed to save to sessionStorage:', error)
      return false
    }
  }

  get<T>(key: string, defaultValue?: T): T | null {
    try {
      const storageKey = this.getKey(key)
      const stored = window.sessionStorage.getItem(storageKey)

      if (!stored) return defaultValue || null

      const item: StoredItem<T> = JSON.parse(stored)

      if (this.isExpired(item)) {
        this.remove(key)
        return defaultValue || null
      }

      return item.data
    } catch (error) {
      console.warn('Failed to read from sessionStorage:', error)
      return defaultValue || null
    }
  }

  remove(key: string): boolean {
    try {
      const storageKey = this.getKey(key)
      window.sessionStorage.removeItem(storageKey)
      return true
    } catch (error) {
      console.warn('Failed to remove from sessionStorage:', error)
      return false
    }
  }

  clear(): boolean {
    try {
      const keys = Object.keys(sessionStorage)
      keys.forEach(key => {
        if (key.startsWith(`${this.prefix}:`)) {
          window.sessionStorage.removeItem(key)
        }
      })
      return true
    } catch (error) {
      console.warn('Failed to clear sessionStorage:', error)
      return false
    }
  }
}

// Create session storage manager
export const sessionStorage = new SessionStorageManager()

// Specialized storage for different app areas

// Theme storage
export const themeStorage = {
  set: (theme: string) => storage.set('theme', theme),
  get: () => storage.get('theme', 'system'),
  remove: () => storage.remove('theme'),
}

// Auth storage
export const authStorage = {
  set: (data: { user: unknown; token: string }) => storage.set('auth', data, { ttl: 24 * 60 * 60 * 1000 }), // 24 hours
  get: () => storage.get('auth'),
  remove: () => storage.remove('auth'),
  isValid: () => {
    const auth = storage.get('auth') as { token?: string } | null
    return auth && auth.token
  },
}

// Filter storage
export const filterStorage = {
  set: (filters: unknown) => storage.set('filters', filters),
  get: () => storage.get('filters', {}),
  remove: () => storage.remove('filters'),
}

// Host selection storage
export const hostSelectionStorage = {
  set: (selection: unknown) => storage.set('host-selection', selection),
  get: () => storage.get('host-selection'),
  remove: () => storage.remove('host-selection'),
}

// User preferences storage
export const preferencesStorage = {
  set: (prefs: unknown) => storage.set('preferences', prefs),
  get: () => storage.get('preferences', {}),
  update: (updates: unknown) => {
    const current = preferencesStorage.get() || {}
    const updated = { ...(current as Record<string, unknown>), ...(updates as Record<string, unknown>) }
    preferencesStorage.set(updated)
    return updated
  },
  remove: () => storage.remove('preferences'),
}

// Cache storage with TTL
export const cacheStorage = {
  set: <T>(key: string, data: T, ttlMs = 5 * 60 * 1000) => // 5 minutes default
    storage.set(`cache:${key}`, data, { ttl: ttlMs }),
  get: <T>(key: string) => storage.get<T>(`cache:${key}`),
  has: (key: string) => storage.has(`cache:${key}`),
  remove: (key: string) => storage.remove(`cache:${key}`),
  clear: () => {
    const keys = storage.getAllKeys().filter(key => key.startsWith('cache:'))
    keys.forEach(key => storage.remove(key))
  },
}

// Migration utilities for storage schema changes
export const storageMigrations = {
  // Migrate old storage format to new format
  migrateFromOldFormat: () => {
    try {
      // Check for old format keys and migrate them
      const oldKeys = ['fio-theme', 'fio-auth', 'fio-filters', 'fio-host-selection']

      oldKeys.forEach(oldKey => {
        const value = localStorage.getItem(oldKey)
        if (value) {
          // Migrate to new prefixed format
          const newKey = `fio:${oldKey.replace('fio-', '')}`
          localStorage.setItem(newKey, value)
          localStorage.removeItem(oldKey)
        }
      })

      return true
    } catch (error) {
      console.warn('Storage migration failed:', error)
      return false
    }
  },

  // Clean up expired items
  cleanupExpired: () => {
    try {
      const keys = Object.keys(localStorage)
      let cleaned = 0

      keys.forEach(key => {
        if (key.startsWith('fio:')) {
          try {
            const stored = localStorage.getItem(key)
            if (stored) {
              const item = JSON.parse(stored)
              if (item.ttl && Date.now() - item.timestamp > item.ttl) {
                localStorage.removeItem(key)
                cleaned++
              }
            }
          } catch {
            // Invalid stored data, remove it
            localStorage.removeItem(key)
            cleaned++
          }
        }
      })

      return cleaned
    } catch (error) {
      console.warn('Storage cleanup failed:', error)
      return 0
    }
  },
}

// Initialize storage on app start
export function initializeStorage(): void {
  // Run migrations
  storageMigrations.migrateFromOldFormat()

  // Clean up expired items
  const cleaned = storageMigrations.cleanupExpired()
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} expired storage items`)
  }
}

// Auto-initialize
if (typeof window !== 'undefined') {
  initializeStorage()
}
