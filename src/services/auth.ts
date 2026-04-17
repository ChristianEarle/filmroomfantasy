// Authentication API services
import { api, setAuthToken } from './api';

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
  subscriptionTier?: 'free' | 'pro' | 'elite';
  subscriptionExpiresAt?: string;
  role?: 'user' | 'admin';
  /** ISO timestamp; null/undefined means email not yet verified. */
  emailVerifiedAt?: string | null;
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
  token?: string;
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
    const res = await api.post<AuthResponse>('/auth/register', {
      email,
      password,
      username,
    });
    if (res.token) setAuthToken(res.token);
    return res;
  },

  // Login user
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>('/auth/login', {
      email,
      password,
    });
    if (res.token) setAuthToken(res.token);
    return res;
  },

  // Logout user — revoke session server-side; server clears the cookie
  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout', {});
    } catch {
      // If server call fails (e.g. token already expired), cookie is already gone
    }
    setAuthToken(null);
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
    const res = await api.post<GoogleAuthResponse>('/auth/google', body);
    if (res.token) setAuthToken(res.token);
    return res;
  },

  // Refresh token — extend session with a new JWT
  refresh: async (): Promise<{ token: string }> => {
    const res = await api.post<{ token: string }>('/auth/refresh', {});
    if (res.token) setAuthToken(res.token);
    return res;
  },

  // Forgot password — request a reset link
  forgotPassword: async (email: string): Promise<{ message: string }> => {
    return api.post<{ message: string }>('/auth/forgot-password', { email });
  },

  // Reset password — use token from email to set new password
  resetPassword: async (token: string, newPassword: string): Promise<{ message: string }> => {
    return api.post<{ message: string }>('/auth/reset-password', { token, newPassword });
  },

  // Verify an email address with a token from the verification email.
  verifyEmail: async (token: string): Promise<{ message: string }> => {
    return api.post<{ message: string }>('/auth/verify-email', { token });
  },

  // Resend the verification email to the currently signed-in user.
  resendVerification: async (): Promise<{ message: string; alreadyVerified?: boolean }> => {
    return api.post<{ message: string; alreadyVerified?: boolean }>('/auth/resend-verification', {});
  },
};

export default authService;
