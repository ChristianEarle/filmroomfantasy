import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services';
import { setOnAuthExpired } from '../services/api';
import type { User, League, UpdateProfileData, GoogleAuthResponse } from '../services/auth';

interface AuthContextType {
  user: User | null;
  leagues: League[];
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  loginWithGoogle: (credential: string, username?: string) => Promise<GoogleAuthResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (data: UpdateProfileData) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Check for existing session on mount by calling /auth/me
  // The httpOnly cookie is sent automatically — no localStorage check needed
  useEffect(() => {
    const initAuth = async () => {
      try {
        const response = await authService.me();
        setUser(response.user);
        setLeagues(response.leagues);
      } catch {
        // No valid session — user stays null
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await authService.login(email, password);
    // Fetch full user with preferences and leagues (cookie already set by server)
    try {
      const meResponse = await authService.me();
      setUser(meResponse.user);
      setLeagues(meResponse.leagues);
    } catch {
      setUser(response.user);
      setLeagues([]);
    }
  }, []);

  const register = useCallback(async (email: string, password: string, username: string) => {
    const response = await authService.register(email, password, username);
    // Fetch full user with preferences (cookie already set by server)
    try {
      const meResponse = await authService.me();
      setUser(meResponse.user);
      setLeagues(meResponse.leagues);
    } catch {
      setUser(response.user);
      setLeagues([]);
    }
  }, []);

  const loginWithGoogle = useCallback(async (credential: string, username?: string): Promise<GoogleAuthResponse> => {
    const response = await authService.googleLogin(credential, username);

    // If the backend asks for a username, return early so the caller can prompt the user
    if (response.needsUsername) {
      return response;
    }

    // Fetch full user with preferences and leagues (cookie already set by server)
    if (response.user) {
      try {
        const meResponse = await authService.me();
        setUser(meResponse.user);
        setLeagues(meResponse.leagues);
      } catch {
        setUser(response.user);
        setLeagues([]);
      }
    }
    return response;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    setLeagues([]);
  }, []);

  // Register the auth-expired callback so the API layer can force logout
  useEffect(() => {
    setOnAuthExpired(() => {
      setUser(null);
      setLeagues([]);
    });
    return () => setOnAuthExpired(null);
  }, []);

  // Proactively refresh the token every hour while the user is authenticated
  useEffect(() => {
    if (!user) return;

    const REFRESH_INTERVAL = 60 * 60 * 1000; // 1 hour
    const intervalId = setInterval(() => {
      authService.refresh().catch(() => {
        // Refresh failed — session likely expired, force logout
        setUser(null);
        setLeagues([]);
      });
    }, REFRESH_INTERVAL);

    return () => clearInterval(intervalId);
  }, [user]);

  const refreshUser = useCallback(async () => {
    try {
      const response = await authService.me();
      setUser(response.user);
      setLeagues(response.leagues);
    } catch {
      logout();
    }
  }, [logout]);

  const updateProfile = useCallback(async (data: UpdateProfileData) => {
    const response = await authService.updateProfile(data);
    // Merge with existing user to preserve fields not returned by /auth/profile
    // (e.g. subscriptionTier, role, hasGoogle, hasPassword, createdAt)
    setUser(prev => prev ? { ...prev, ...response.user } : response.user);
  }, []);

  const value: AuthContextType = {
    user,
    leagues,
    isLoading,
    isAuthenticated,
    login,
    register,
    loginWithGoogle,
    logout,
    refreshUser,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
