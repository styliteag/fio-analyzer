// User authentication and authorization types
export interface UserAccount {
  username: string
  role: 'admin' | 'uploader'
  permissions: Permission[]
  created_at?: string
  last_login?: string
}

export interface Permission {
  resource: string // 'test-runs', 'users', 'upload', 'filters'
  actions: ('read' | 'write' | 'delete')[]
}

export interface AuthState {
  isAuthenticated: boolean
  user: UserAccount | null
  token?: string
  expires_at?: string
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface AuthResponse {
  user: UserAccount
  token?: string
  expires_at?: string
}