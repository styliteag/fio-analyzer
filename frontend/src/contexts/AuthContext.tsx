import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is already authenticated on app load
  useEffect(() => {
    const storedAuth = localStorage.getItem('fio-auth');
    if (storedAuth) {
      try {
        const { username: storedUsername, credentials } = JSON.parse(storedAuth);
        // Verify credentials are still valid by making a test API call
        verifyCredentials(credentials)
          .then((valid) => {
            if (valid) {
              setIsAuthenticated(true);
              setUsername(storedUsername);
            } else {
              localStorage.removeItem('fio-auth');
            }
          })
          .finally(() => setLoading(false));
      } catch {
        localStorage.removeItem('fio-auth');
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const verifyCredentials = async (credentials: string): Promise<boolean> => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || '.'}/api/test-runs`, {
        headers: {
          'Authorization': `Basic ${credentials}`
        }
      });
      return response.ok;
    } catch (error) {
      console.warn('Network error during credential verification:', error);
      return false;
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      // Create base64 encoded credentials
      const credentials = btoa(`${username}:${password}`);
      
      // Test the credentials
      const response = await fetch(`${import.meta.env.VITE_API_URL || '.'}/api/test-runs`, {
        headers: {
          'Authorization': `Basic ${credentials}`
        }
      });

      if (response.ok) {
        // Store credentials in localStorage
        localStorage.setItem('fio-auth', JSON.stringify({
          username,
          credentials
        }));
        
        setIsAuthenticated(true);
        setUsername(username);
        setLoading(false);
        return true;
      } else if (response.status === 401) {
        setError('Invalid username or password');
        setLoading(false);
        return false;
      } else {
        setError('Login failed. Please try again.');
        setLoading(false);
        return false;
      }
    } catch (err) {
      console.error('Login network error:', err);
      setError('Cannot connect to server. Please check if the backend is running.');
      setLoading(false);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('fio-auth');
    setIsAuthenticated(false);
    setUsername(null);
    setError(null);
  };

  const value: AuthContextType = {
    isAuthenticated,
    username,
    login,
    logout,
    loading,
    error
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};