import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from '@/composables/useApi';
import { setBasicAuth, clearAuth } from '@/services/api/client';
const authState = ref({
    isAuthenticated: false,
    user: null,
    token: undefined,
    expires_at: undefined,
    lastActivity: undefined
});
const isInitialized = ref(false);
const isInitializing = ref(false);
const authError = ref(null);
// Constants
const AUTH_STORAGE_KEY = 'fio-auth-v2';
const AUTH_VERSION = '2.0';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const ACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
export function useAuth() {
    const router = useRouter();
    const { fetchWithErrorHandling } = useApi();
    // Enhanced storage functions
    const saveAuthToStorage = (authData) => {
        try {
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
            console.log('💾 Auth data saved to storage successfully');
            return true;
        }
        catch (error) {
            console.error('❌ Failed to save auth data to storage:', error);
            authError.value = 'Failed to save authentication data';
            return false;
        }
    };
    const loadAuthFromStorage = () => {
        try {
            const stored = localStorage.getItem(AUTH_STORAGE_KEY);
            if (!stored) {
                console.log('📭 No auth data found in storage');
                return null;
            }
            const authData = JSON.parse(stored);
            console.log('📖 Loaded auth data from storage:', {
                username: authData.user.username,
                role: authData.user.role,
                version: authData.version,
                expires_at: authData.expires_at,
                lastActivity: authData.lastActivity
            });
            // Check version compatibility
            if (authData.version !== AUTH_VERSION) {
                console.warn('⚠️ Auth data version mismatch, clearing storage');
                localStorage.removeItem(AUTH_STORAGE_KEY);
                return null;
            }
            // Check if session is expired
            if (authData.expires_at && new Date(authData.expires_at) < new Date()) {
                console.log('⏰ Stored auth session expired');
                localStorage.removeItem(AUTH_STORAGE_KEY);
                return null;
            }
            // Check if session is inactive too long
            if (authData.lastActivity) {
                const lastActivity = new Date(authData.lastActivity);
                const now = new Date();
                if (now.getTime() - lastActivity.getTime() > ACTIVITY_TIMEOUT) {
                    console.log('😴 Stored auth session inactive too long');
                    localStorage.removeItem(AUTH_STORAGE_KEY);
                    return null;
                }
            }
            console.log('✅ Auth data validation passed');
            return authData;
        }
        catch (error) {
            console.error('❌ Failed to load auth data from storage:', error);
            localStorage.removeItem(AUTH_STORAGE_KEY);
            authError.value = 'Failed to load authentication data';
            return null;
        }
    };
    const clearAuthFromStorage = () => {
        try {
            localStorage.removeItem(AUTH_STORAGE_KEY);
            // Also clear old version keys for migration
            localStorage.removeItem('fio-auth');
            console.log('Auth data cleared from storage');
        }
        catch (error) {
            console.error('Failed to clear auth data from storage:', error);
        }
    };
    // Session validation
    const validateSession = async () => {
        if (!authState.value.isAuthenticated || !authState.value.token) {
            console.log('🔍 Session validation: No auth state or token');
            return false;
        }
        try {
            console.log('🔍 Session validation: Testing with backend...');
            // Try to make an authenticated request to validate the session
            const userInfo = await fetchWithErrorHandling('/api/users/me');
            console.log('🔍 Session validation: Backend accepted credentials, user:', userInfo);
            updateLastActivity();
            return true;
        }
        catch (error) {
            console.warn('🔍 Session validation: Backend rejected credentials:', error);
            return false;
        }
    };
    // Computed properties
    const isAuthenticated = computed(() => authState.value.isAuthenticated);
    const user = computed(() => authState.value.user);
    const userRole = computed(() => authState.value.user?.role ?? null);
    // Authentication methods
    const login = async (credentials) => {
        try {
            authError.value = null;
            // Set global auth credentials
            setBasicAuth(credentials.username, credentials.password);
            // Verify credentials by checking if we can access a protected endpoint
            let userData;
            try {
                // Try to get user info from backend (if available)
                const response = await fetchWithErrorHandling('/api/users/me');
                if (response) {
                    userData = response;
                }
                else {
                    // Fallback: create user data from credentials for basic auth
                    userData = {
                        username: credentials.username,
                        role: credentials.username === 'admin' ? 'admin' : 'uploader',
                        permissions: credentials.username === 'admin'
                            ? [{ resource: 'all', actions: ['read', 'write', 'delete'] }]
                            : [{ resource: 'upload', actions: ['read', 'write'] }],
                        created_at: new Date().toISOString(),
                        last_login: new Date().toISOString()
                    };
                }
            }
            catch (error) {
                // If /api/users/me doesn't exist, try a simple health check with auth
                try {
                    await fetchWithErrorHandling('/health');
                    // If health check succeeds with auth, create basic user data
                    userData = {
                        username: credentials.username,
                        role: credentials.username === 'admin' ? 'admin' : 'uploader',
                        permissions: credentials.username === 'admin'
                            ? [{ resource: 'all', actions: ['read', 'write', 'delete'] }]
                            : [{ resource: 'upload', actions: ['read', 'write'] }],
                        created_at: new Date().toISOString(),
                        last_login: new Date().toISOString()
                    };
                }
                catch {
                    throw new Error('Invalid username or password');
                }
            }
            // Update auth state
            const now = new Date().toISOString();
            const encodedCredentials = btoa(`${credentials.username}:${credentials.password}`);
            authState.value = {
                isAuthenticated: true,
                user: userData,
                token: encodedCredentials,
                expires_at: new Date(Date.now() + SESSION_DURATION).toISOString(),
                lastActivity: now
            };
            // Save to storage with enhanced error handling
            const authData = {
                credentials: encodedCredentials,
                user: userData,
                expires_at: authState.value.expires_at || '',
                lastActivity: now,
                version: AUTH_VERSION
            };
            console.log('💾 Saving auth data to storage:', {
                username: userData.username,
                role: userData.role,
                expires_at: authData.expires_at,
                version: authData.version
            });
            if (!saveAuthToStorage(authData)) {
                console.warn('❌ Failed to save auth data, but login succeeded');
            }
            else {
                console.log('✅ Auth data saved successfully');
            }
            return userData;
        }
        catch (error) {
            console.error('Login error:', error);
            clearAuthState();
            throw error;
        }
    };
    const logout = () => {
        clearAuthState();
        // Navigate to login page
        router.push('/login').catch(() => {
            // Handle navigation errors silently
            console.warn('Navigation to login failed during logout');
        });
    };
    const initialize = async () => {
        if (isInitialized.value || isInitializing.value)
            return;
        isInitializing.value = true;
        authError.value = null;
        try {
            console.log('🔐 Initializing authentication...');
            const authData = loadAuthFromStorage();
            if (!authData) {
                console.log('❌ No stored auth data found');
                isInitialized.value = true;
                return;
            }
            console.log('✅ Found stored auth data, restoring session...', {
                username: authData.user.username,
                role: authData.user.role,
                expires_at: authData.expires_at,
                lastActivity: authData.lastActivity
            });
            // Restore auth state
            authState.value = {
                isAuthenticated: true,
                user: authData.user,
                token: authData.credentials,
                expires_at: authData.expires_at,
                lastActivity: authData.lastActivity
            };
            // Set global auth credentials
            console.log('🔑 Decoding stored credentials:', authData.credentials);
            const [username, password] = atob(authData.credentials).split(':');
            console.log('🔑 Setting global auth credentials for:', username, '(password length:', password.length, ')');
            setBasicAuth(username, password);
            console.log('🔑 Global auth credentials set');
            // Validate the session
            console.log('🔍 Validating session...');
            const isValid = await validateSession();
            if (!isValid) {
                console.warn('❌ Stored auth session is no longer valid - clearing auth state');
                clearAuthState();
                isInitialized.value = true;
                return;
            }
            console.log('🔍 Session validation passed');
            console.log('✅ Authentication restored successfully');
            updateLastActivity();
        }
        catch (error) {
            console.error('❌ Auth initialization error:', error);
            authError.value = 'Failed to restore authentication session';
            clearAuthState();
        }
        finally {
            isInitializing.value = false;
            isInitialized.value = true;
            console.log('🏁 Auth initialization complete');
        }
    };
    const hasPermission = (permission) => {
        if (!isAuthenticated.value || !authState.value.user)
            return false;
        // Simple role-based permissions
        if (permission === 'admin') {
            return authState.value.user.role === 'admin';
        }
        if (permission === 'upload') {
            return ['admin', 'uploader'].includes(authState.value.user.role);
        }
        // Check specific permissions array
        if (authState.value.user.permissions) {
            return authState.value.user.permissions.some(p => p.resource === permission ||
                p.resource === 'all' ||
                (permission === 'read' && p.actions.includes('read')) ||
                (permission === 'write' && p.actions.includes('write')) ||
                (permission === 'delete' && p.actions.includes('delete')));
        }
        return false;
    };
    const updateLastActivity = () => {
        if (authState.value.isAuthenticated) {
            const now = new Date().toISOString();
            authState.value.lastActivity = now;
            // Update localStorage
            const authData = loadAuthFromStorage();
            if (authData) {
                authData.lastActivity = now;
                saveAuthToStorage(authData);
            }
        }
    };
    const clearAuthState = () => {
        authState.value = {
            isAuthenticated: false,
            user: null,
            token: undefined,
            expires_at: undefined,
            lastActivity: undefined
        };
        clearAuthFromStorage();
        clearAuth(); // Clear global auth credentials
    };
    const refreshSession = async () => {
        if (!authState.value.isAuthenticated || !authState.value.token) {
            throw new Error('No active session to refresh');
        }
        try {
            // Extend session by making an authenticated request
            await fetchWithErrorHandling('/api/users/me');
            // Update expiration time
            const newExpiresAt = new Date(Date.now() + SESSION_DURATION).toISOString();
            authState.value.expires_at = newExpiresAt;
            updateLastActivity();
            // Update localStorage
            const authData = loadAuthFromStorage();
            if (authData) {
                authData.expires_at = newExpiresAt;
                authData.lastActivity = authState.value.lastActivity || '';
                saveAuthToStorage(authData);
            }
        }
        catch (error) {
            console.error('Session refresh failed:', error);
            clearAuthState();
            throw error;
        }
    };
    // Debug function to check current auth state
    const debugAuthState = () => {
        console.log('🔍 DEBUG: Current auth state:', {
            isAuthenticated: authState.value.isAuthenticated,
            user: authState.value.user,
            token: authState.value.token ? `${authState.value.token.substring(0, 20)}...` : null,
            expires_at: authState.value.expires_at,
            lastActivity: authState.value.lastActivity,
            isInitialized: isInitialized.value,
            isInitializing: isInitializing.value
        });
    };
    return {
        // State
        user,
        isAuthenticated,
        userRole,
        isInitialized: computed(() => isInitialized.value),
        isInitializing: computed(() => isInitializing.value),
        authError: computed(() => authError.value),
        // Methods
        login,
        logout,
        initialize,
        hasPermission,
        updateLastActivity,
        refreshSession,
        validateSession,
        debugAuthState,
        // Legacy compatibility
        initializeAuth: initialize
    };
}
