// Authentication API services
import { api, setToken, removeToken } from './api';

// Types
export type ScoringFormat = 'ppr' | 'half_ppr' | 'standard';

export interface User {
  id: string;
  email: string;
  username: string;
  avatarUrl?: string;
  createdAt?: string;
  preferredScoring?: ScoringFormat;
  darkMode?: boolean;
  notificationsEnabled?: boolean;
  hasGoogle?: boolean;
  hasPassword?: boolean;
  subscriptionTier?: 'free' | 'pro';
  subscriptionExpiresAt?: string;
}

export interface UpdateProfileData {
  username?: string;
  email?: string;
  avatarUrl?: string;
  preferredScoring?: ScoringFormat;
  darkMode?: boolean;
  notificationsEnabled?: boolean;
}

export interface League {
  id: string;
  name: string;
  scoringFormat: string;
  teamCount: number;
  currentWeek: number;
  seasonYear: number;
  role?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface GoogleAuthResponse {
  user?: User;
  token?: string;
  needsUsername?: boolean;
  email?: string;
}

export interface MeResponse {
  user: User;
  leagues: League[];
}

// Auth API functions
export const authService = {
  // Register a new user
  register: async (email: string, password: string, username: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/register', {
      email,
      password,
      username,
    });
    setToken(response.token);
    return response;
  },

  // Login user
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', {
      email,
      password,
    });
    setToken(response.token);
    return response;
  },

  // Logout user — revoke session server-side, then clear local token
  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout', {});
    } catch {
      // If server call fails (e.g. token already expired), still clear locally
    }
    removeToken();
  },

  // Get current user
  me: async (): Promise<MeResponse> => {
    return api.get<MeResponse>('/auth/me');
  },

  // Update profile (includes preferences)
  updateProfile: async (data: UpdateProfileData): Promise<{ user: User }> => {
    return api.put<{ user: User }>('/auth/profile', data);
  },

  // Change password
  changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
    return api.post<{ message: string }>('/auth/change-password', {
      currentPassword,
      newPassword,
    });
  },

  // Google OAuth login/register
  // Returns GoogleAuthResponse — if needsUsername is true, call again with a username
  googleLogin: async (credential: string, username?: string): Promise<GoogleAuthResponse> => {
    const body: Record<string, string> = { credential };
    if (username) body.username = username;
    const response = await api.post<GoogleAuthResponse>('/auth/google', body);
    if (response.token) {
      setToken(response.token);
    }
    return response;
  },

  // Forgot password — request a reset link
  forgotPassword: async (email: string): Promise<{ message: string }> => {
    return api.post<{ message: string }>('/auth/forgot-password', { email });
  },

  // Reset password — use token from email to set new password
  resetPassword: async (token: string, newPassword: string): Promise<{ message: string }> => {
    return api.post<{ message: string }>('/auth/reset-password', { token, newPassword });
  },

};

export default authService;
