import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { SignJWT, jwtVerify, createRemoteJWKSet } from 'jose';
import { eq, and, isNull, gt } from 'drizzle-orm';
import * as schema from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { hashPassword, verifyPassword } from '../utils/password';
import { generateId } from '../utils/id';
import type { Env, Variables } from '../index';

// Cookie configuration for auth token
const AUTH_COOKIE_NAME = 'auth_token';
const AUTH_COOKIE_MAX_AGE = 24 * 60 * 60; // 24h in seconds

function setAuthCookie(c: any, token: string) {
  // Detect HTTPS from the request itself rather than relying on ENVIRONMENT var.
  // Cloudflare Workers always serve HTTPS in production; local dev uses HTTP.
  const isSecure = c.req.url.startsWith('https://');
  setCookie(c, AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecure,
    // Cross-site cookies (frontend ≠ API domain) require SameSite=None + Secure.
    // Local dev uses same-origin via Vite proxy, so Lax is fine over HTTP.
    sameSite: isSecure ? 'None' : 'Lax',
    path: '/api',
    maxAge: AUTH_COOKIE_MAX_AGE,
  });
}

function clearAuthCookie(c: any) {
  const isSecure = c.req.url.startsWith('https://');
  deleteCookie(c, AUTH_COOKIE_NAME, {
    path: '/api',
    secure: isSecure,
    sameSite: isSecure ? 'None' : 'Lax',
  });
}

export const authRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Rate limit auth endpoints: 10 attempts per 15 minutes for login/register, 5 for password reset
const authRateLimit = rateLimit(10, 15 * 60 * 1000);
const passwordResetRateLimit = rateLimit(5, 15 * 60 * 1000);

// Generate JWT token
const generateToken = async (userId: string, secret: string): Promise<string> => {
  const secretKey = new TextEncoder().encode(secret);
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secretKey);
};

// Hash a token with SHA-256 (for password reset tokens)
async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Send password reset email via Resend (or log to console if no API key)
async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  resendApiKey?: string
): Promise<void> {
  if (!resendApiKey) {
    console.warn('[Password Reset] No RESEND_API_KEY configured — email not sent.');
    return;
  }

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'FilmRoom <noreply@filmroomfantasy.com>',
      to: [to],
      subject: 'Reset your FilmRoom password',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #1e293b; margin-bottom: 16px;">Reset your password</h2>
          <p style="color: #475569; line-height: 1.6;">
            We received a request to reset your FilmRoom password. Click the button below to choose a new password.
          </p>
          <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 24px 0;">
            Reset Password
          </a>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.5;">
            This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
          </p>
        </div>
      `,
    }),
  });
}

// Google OAuth: JWKS endpoint for verifying Google ID tokens
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs')
);

interface GoogleIdTokenPayload {
  sub: string;           // Google user ID (stable, unique)
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  aud: string;
  iss: string;
}

async function verifyGoogleIdToken(
  idToken: string,
  clientId: string
): Promise<GoogleIdTokenPayload> {
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: clientId,
  });
  return payload as unknown as GoogleIdTokenPayload;
}

// Register
authRoutes.post('/register', authRateLimit, async (c) => {
  try {
    const { email, password, username } = await c.req.json();

    // Validation
    if (!email || !password || !username) {
      return c.json({ error: 'Email, password, and username are required' }, 400);
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({ error: 'Invalid email format' }, 400);
    }

    // Username validation
    if (username.length < 3 || username.length > 30) {
      return c.json({ error: 'Username must be between 3 and 30 characters' }, 400);
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return c.json({ error: 'Username can only contain letters, numbers, hyphens, and underscores' }, 400);
    }

    if (password.length < 8) {
      return c.json({ error: 'Password must be at least 8 characters' }, 400);
    }

    const db = c.get('db');

    // Check if email or username already exists (use generic message to prevent enumeration)
    const existingEmail = await db.query.users.findFirst({
      where: eq(schema.users.email, email.toLowerCase()),
    });

    const existingUsername = await db.query.users.findFirst({
      where: eq(schema.users.username, username),
    });

    if (existingEmail || existingUsername) {
      return c.json({ error: 'Email or username already taken' }, 400);
    }

    // Hash password using Workers-compatible PBKDF2
    const passwordHash = await hashPassword(password);

    // Create user
    const userId = generateId();
    await db.insert(schema.users).values({
      id: userId,
      email: email.toLowerCase(),
      passwordHash,
      username,
    });

    // Generate token
    const token = await generateToken(userId, c.env.JWT_SECRET);

    // Create session for token revocation support
    const sessionId = generateId();
    await db.insert(schema.sessions).values({
      id: sessionId,
      userId,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    });

    // Set httpOnly cookie (primary auth) + return token in body (fallback for
    // browsers that block cross-origin cookies)
    setAuthCookie(c, token);

    return c.json({
      token,
      user: {
        id: userId,
        email: email.toLowerCase(),
        username,
      },
    }, 201);
  } catch (error) {
    console.error('Registration error:', error);
    return c.json({ error: 'Registration failed' }, 500);
  }
});

// Login
authRoutes.post('/login', authRateLimit, async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    const db = c.get('db');

    // Find user
    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, email.toLowerCase()),
    });

    if (!user) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Guard: Google-only users can't login with password — return same error to prevent auth method enumeration
    if (!user.passwordHash) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Verify password using Workers-compatible PBKDF2
    const validPassword = await verifyPassword(password, user.passwordHash);

    if (!validPassword) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Generate token
    const token = await generateToken(user.id, c.env.JWT_SECRET);

    // Create session for token revocation support
    const sessionId = generateId();
    await db.insert(schema.sessions).values({
      id: sessionId,
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    });

    // Set httpOnly cookie (primary auth) + return token in body (fallback for
    // browsers that block cross-origin cookies)
    setAuthCookie(c, token);

    return c.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Login failed' }, 500);
  }
});

// Get current user
authRoutes.get('/me', authMiddleware, async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  // Get user's leagues
  const db = c.get('db');
  const memberships = await db.query.leagueMembers.findMany({
    where: eq(schema.leagueMembers.userId, user.id),
    with: {
      league: true,
    },
  });

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      preferredScoring: user.preferredScoring ?? 'ppr',
      darkMode: user.darkMode ?? true,
      notificationsEnabled: user.notificationsEnabled ?? true,
      hasGoogle: !!user.googleId,
      hasPassword: !!user.passwordHash,
      subscriptionTier: user.subscriptionTier ?? 'free',
      subscriptionExpiresAt: user.subscriptionExpiresAt ?? null,
      role: user.role ?? 'user',
    },
    leagues: memberships.map(m => ({
      ...m.league,
      role: m.role,
    })),
  });
});

// Rate limit profile and password changes: 10 req/15 min
const profileRateLimit = rateLimit(10, 15 * 60 * 1000);

// Update profile (includes preferences)
authRoutes.put('/profile', profileRateLimit, authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { username, email: newEmail, avatarUrl, preferredScoring, darkMode, notificationsEnabled } = body;

    if (!user) {
      return c.json({ error: 'Not authenticated' }, 401);
    }

    const db = c.get('db');

    // Check if new username is taken
    if (username && username !== user.username) {
      if (username.length < 3 || username.length > 30) {
        return c.json({ error: 'Username must be between 3 and 30 characters' }, 400);
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        return c.json({ error: 'Username can only contain letters, numbers, hyphens, and underscores' }, 400);
      }

      const existingUsername = await db.query.users.findFirst({
        where: eq(schema.users.username, username),
      });

      if (existingUsername) {
        return c.json({ error: 'Username already taken' }, 400);
      }
    }

    // Validate and check email uniqueness
    if (newEmail && newEmail.toLowerCase() !== user.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        return c.json({ error: 'Invalid email format' }, 400);
      }

      const existingEmail = await db.query.users.findFirst({
        where: eq(schema.users.email, newEmail.toLowerCase()),
      });

      if (existingEmail) {
        return c.json({ error: 'Email already taken' }, 400);
      }
    }

    const updates: Record<string, unknown> = {
      username: username ?? user.username,
      avatarUrl: avatarUrl !== undefined ? avatarUrl : user.avatarUrl,
      updatedAt: new Date(),
    };
    if (newEmail && newEmail.toLowerCase() !== user.email) updates.email = newEmail.toLowerCase();
    if (preferredScoring !== undefined) updates.preferredScoring = preferredScoring;
    if (darkMode !== undefined) updates.darkMode = darkMode;
    if (notificationsEnabled !== undefined) updates.notificationsEnabled = notificationsEnabled;

    await db
      .update(schema.users)
      .set(updates as any)
      .where(eq(schema.users.id, user.id));

    const updated = await db.query.users.findFirst({
      where: eq(schema.users.id, user.id),
      columns: { id: true, email: true, username: true, avatarUrl: true, preferredScoring: true, darkMode: true, notificationsEnabled: true },
    });

    return c.json({
      user: {
        id: updated!.id,
        email: updated!.email,
        username: updated!.username,
        avatarUrl: updated!.avatarUrl,
        preferredScoring: updated!.preferredScoring ?? 'ppr',
        darkMode: updated!.darkMode ?? true,
        notificationsEnabled: updated!.notificationsEnabled ?? true,
      },
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return c.json({ error: 'Profile update failed' }, 500);
  }
});

// Change password
authRoutes.post('/change-password', profileRateLimit, authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { currentPassword, newPassword } = await c.req.json();

    if (!user) {
      return c.json({ error: 'Not authenticated' }, 401);
    }

    if (!newPassword) {
      return c.json({ error: 'New password is required' }, 400);
    }

    if (newPassword.length < 8) {
      return c.json({ error: 'New password must be at least 8 characters' }, 400);
    }

    const db = c.get('db');

    // If user has a password, verify current password before changing
    if (user.passwordHash) {
      if (!currentPassword) {
        return c.json({ error: 'Current password is required' }, 400);
      }
      const validPassword = await verifyPassword(currentPassword, user.passwordHash);
      if (!validPassword) {
        return c.json({ error: 'Current password is incorrect' }, 401);
      }
    }
    // If user has no password (Google-only), they can set one without currentPassword

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password
    await db
      .update(schema.users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, user.id));

    return c.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    return c.json({ error: 'Password change failed' }, 500);
  }
});

// Google OAuth login/register
authRoutes.post('/google', authRateLimit, async (c) => {
  try {
    const { credential, username } = await c.req.json();

    if (!credential) {
      return c.json({ error: 'Google credential is required' }, 400);
    }

    if (!c.env.GOOGLE_CLIENT_ID) {
      return c.json({ error: 'Google login is not configured' }, 503);
    }

    // Verify the Google ID token against Google's JWKS
    let googlePayload: GoogleIdTokenPayload;
    try {
      googlePayload = await verifyGoogleIdToken(credential, c.env.GOOGLE_CLIENT_ID);
    } catch (err) {
      console.error('Google token verification failed:', err);
      return c.json({ error: 'Invalid Google credential' }, 401);
    }

    if (!googlePayload.email_verified) {
      return c.json({ error: 'Google email is not verified' }, 400);
    }

    const db = c.get('db');
    const email = googlePayload.email.toLowerCase();
    const googleId = googlePayload.sub;

    // 1. Check if user already exists by google_id (returning Google user)
    let user = await db.query.users.findFirst({
      where: eq(schema.users.googleId, googleId),
    });

    if (!user) {
      // 2. Check if user exists by email (link Google to existing email/password account)
      user = await db.query.users.findFirst({
        where: eq(schema.users.email, email),
      });

      if (user) {
        // Link Google account to existing user
        await db.update(schema.users).set({
          googleId: googleId,
          avatarUrl: user.avatarUrl || googlePayload.picture || null,
          updatedAt: new Date(),
        }).where(eq(schema.users.id, user.id));

        // Re-fetch updated user
        user = await db.query.users.findFirst({
          where: eq(schema.users.id, user.id),
        });
      } else {
        // 3. New user — require the client to provide a username
        if (!username) {
          return c.json({ needsUsername: true, email }, 200);
        }

        // Validate username (same rules as registration)
        if (username.length < 3 || username.length > 30) {
          return c.json({ error: 'Username must be between 3 and 30 characters' }, 400);
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
          return c.json({ error: 'Username can only contain letters, numbers, hyphens, and underscores' }, 400);
        }

        const existingUsername = await db.query.users.findFirst({
          where: eq(schema.users.username, username),
        });
        if (existingUsername) {
          return c.json({ error: 'Username already taken' }, 400);
        }

        const userId = generateId();

        await db.insert(schema.users).values({
          id: userId,
          email: email,
          passwordHash: null,
          username: username,
          googleId: googleId,
          avatarUrl: googlePayload.picture || null,
        });

        user = await db.query.users.findFirst({
          where: eq(schema.users.id, userId),
        });
      }
    }

    if (!user) {
      return c.json({ error: 'Failed to create or find user' }, 500);
    }

    // Generate app JWT
    const token = await generateToken(user.id, c.env.JWT_SECRET);

    // Create session for token revocation support
    const sessionId = generateId();
    await db.insert(schema.sessions).values({
      id: sessionId,
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    });

    // Set httpOnly cookie (primary auth) + return token in body (fallback for
    // browsers that block cross-origin cookies)
    setAuthCookie(c, token);

    return c.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    console.error('Google auth error:', error);
    return c.json({ error: 'Google authentication failed' }, 500);
  }
});

// Logout — revoke the current session token
authRoutes.post('/logout', authMiddleware, async (c) => {
  try {
    // Read token from cookie (primary) or Authorization header (fallback for migration)
    const cookieToken = getCookie(c, AUTH_COOKIE_NAME);
    const authHeader = c.req.header('Authorization');
    const token = cookieToken || authHeader?.substring(7);

    if (!token) {
      return c.json({ error: 'No token provided' }, 400);
    }

    const db = c.get('db');

    // Delete the session matching this token
    await db.delete(schema.sessions).where(eq(schema.sessions.token, token));

    // Clear the httpOnly auth cookie
    clearAuthCookie(c);

    return c.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return c.json({ error: 'Logout failed' }, 500);
  }
});

// Forgot password — request a password reset link
authRoutes.post('/forgot-password', passwordResetRateLimit, async (c) => {
  try {
    const { email } = await c.req.json();

    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    // If email service isn't configured, tell the user upfront
    if (!c.env.RESEND_API_KEY) {
      return c.json({ error: 'Password reset is not available yet. Please contact support.' }, 503);
    }

    const db = c.get('db');

    // Always return success to prevent email enumeration
    const successResponse = { message: 'If an account with that email exists, a password reset link has been sent.' };

    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, email.toLowerCase()),
    });

    if (!user) {
      return c.json(successResponse);
    }

    // Google-only users can still reset — they'll set a password
    // Generate a secure random token
    const rawToken = crypto.randomUUID() + '-' + crypto.randomUUID();
    const tokenHash = await sha256(rawToken);

    // Store the hashed token (expires in 1 hour)
    await db.insert(schema.passwordResetTokens).values({
      id: generateId(),
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    });

    // Build reset URL
    const appUrl = c.env.APP_URL || 'http://localhost:5173';
    const resetUrl = `${appUrl}/#reset_token=${encodeURIComponent(rawToken)}`;

    // Send the email (or log to console if no API key)
    await sendPasswordResetEmail(user.email, resetUrl, c.env.RESEND_API_KEY);

    return c.json(successResponse);
  } catch (error) {
    console.error('Forgot password error:', error);
    return c.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
  }
});

// Reset password — use a token to set a new password
authRoutes.post('/reset-password', passwordResetRateLimit, async (c) => {
  try {
    const { token, newPassword } = await c.req.json();

    if (!token || !newPassword) {
      return c.json({ error: 'Token and new password are required' }, 400);
    }

    if (newPassword.length < 8) {
      return c.json({ error: 'Password must be at least 8 characters' }, 400);
    }

    const db = c.get('db');

    // Hash the provided token to look up in the database
    const tokenHash = await sha256(token);

    // Find unused, unexpired token
    const resetToken = await db.query.passwordResetTokens.findFirst({
      where: and(
        eq(schema.passwordResetTokens.tokenHash, tokenHash),
        isNull(schema.passwordResetTokens.usedAt),
        gt(schema.passwordResetTokens.expiresAt, new Date()),
      ),
    });

    if (!resetToken) {
      return c.json({ error: 'Invalid or expired reset link. Please request a new one.' }, 400);
    }

    // Hash the new password
    const passwordHash = await hashPassword(newPassword);

    // Update the user's password
    await db.update(schema.users).set({
      passwordHash,
      updatedAt: new Date(),
    }).where(eq(schema.users.id, resetToken.userId));

    // Mark token as used
    await db.update(schema.passwordResetTokens).set({
      usedAt: new Date(),
    }).where(eq(schema.passwordResetTokens.id, resetToken.id));

    // Revoke all existing sessions for security
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, resetToken.userId));

    return c.json({ message: 'Password has been reset successfully. Please sign in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return c.json({ error: 'Password reset failed' }, 500);
  }
});

