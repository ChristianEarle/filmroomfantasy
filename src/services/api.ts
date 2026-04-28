// Base API configuration and utilities

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Origin of the API server. In dev API_BASE_URL is the relative '/api', so
// this resolves to the same origin as the page (Vite proxy). In prod it's
// the worker origin, e.g. 'https://filmroom-api.earle2001.workers.dev'.
// Used by Yahoo OAuth postMessage validation since the popup runs on the
// API origin while the opener is on the app origin.
export const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL, typeof window !== 'undefined' ? window.location.href : 'http://localhost').origin;
  } catch {
    return typeof window !== 'undefined' ? window.location.origin : '';
  }
})();

// Auth token — fallback for browsers that block cross-origin cookies (Safari ITP, etc).
// The httpOnly cookie remains the primary auth mechanism; this supplements it and
// is persisted to localStorage so it survives page refresh when cookies are blocked.
// Hydration happens inside AuthContext's mount effect via hydrateAuthTokenFromStorage()
// — NOT at module init — so a bad storage state can't crash the whole bundle on load.
export const AUTH_TOKEN_STORAGE_KEY = 'filmroom_auth_token';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  try {
    if (typeof localStorage === 'undefined') return;
    if (token) {
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    }
  } catch {
    // localStorage may be unavailable (private mode, disabled, etc) — fall back to in-memory only
  }
}

export function hydrateAuthTokenFromStorage(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const stored = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (stored) authToken = stored;
  } catch {
    // localStorage unavailable — leave authToken as-is
  }
}

export function getAuthToken(): string | null {
  return authToken;
}

// Token refresh state — prevents concurrent refresh attempts
let refreshPromise: Promise<boolean> | null = null;

// Callback set by AuthContext to handle forced logout
let onAuthExpired: (() => void) | null = null;
export function setOnAuthExpired(callback: (() => void) | null) {
  onAuthExpired = callback;
}

async function tryRefreshToken(): Promise<boolean> {
  // If a refresh is already in flight, piggyback on it
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        credentials: 'include',
        body: '{}',
      });
      if (!res.ok) return false;
      const data = await res.json() as { token?: string };
      if (data.token) setAuthToken(data.token);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// API Error class
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Base fetch wrapper with auth via httpOnly cookies + Authorization header fallback
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Attach Bearer token as fallback for browsers blocking cross-origin cookies
  if (authToken && !(headers as Record<string, string>)['Authorization']) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${authToken}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include', // Send httpOnly cookies with every request
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    if (msg.includes('Failed to fetch') || msg.includes('ECONNREFUSED') || msg.includes('NetworkError')) {
      throw new ApiError(0, 'Backend server unavailable. Make sure the API is running on port 8787.', err);
    }
    throw err;
  }

  let data: unknown;
  try {
    const text = await response.text();
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(response.status, 'Invalid response from server', undefined);
  }

  if (!response.ok) {
    // On 401, attempt a silent token refresh and retry the original request once.
    // Skip refresh for auth endpoints to avoid infinite loops.
    if (response.status === 401 && !endpoint.startsWith('/auth/')) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        // Retry the original request with the fresh token
        const retryHeaders: HeadersInit = {
          'Content-Type': 'application/json',
          ...options.headers,
        };
        if (authToken) {
          (retryHeaders as Record<string, string>)['Authorization'] = `Bearer ${authToken}`;
        }
        const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...options,
          headers: retryHeaders,
          credentials: 'include',
        });
        if (retryResponse.ok) {
          const retryText = await retryResponse.text();
          return (retryText ? JSON.parse(retryText) : {}) as T;
        }
      }
      // Refresh failed or retry still 401 — session is truly expired
      if (onAuthExpired) onAuthExpired();
    }

    const errorObj = data as { error?: string };
    throw new ApiError(response.status, errorObj.error || 'An error occurred', data);
  }

  return data as T;
}

// HTTP method helpers
export const api = {
  get: <T>(endpoint: string, options?: { signal?: AbortSignal }) =>
    apiFetch<T>(endpoint, { method: 'GET', signal: options?.signal }),

  post: <T>(endpoint: string, body?: unknown) =>
    apiFetch<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: unknown) =>
    apiFetch<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(endpoint: string, body?: unknown) =>
    apiFetch<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string) => apiFetch<T>(endpoint, { method: 'DELETE' }),
};

export default api;
