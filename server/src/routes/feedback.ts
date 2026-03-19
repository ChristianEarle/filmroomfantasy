import { Hono } from 'hono';
import * as schema from '../db/schema';
import { optionalAuthMiddleware } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { generateId } from '../utils/id';
import type { Env, Variables } from '../index';

export const feedbackRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Rate limit feedback: 5 submissions per 15 minutes per IP
const feedbackRateLimit = rateLimit(5, 15 * 60 * 1000);

// Submit feedback (works for both authenticated and anonymous users)
feedbackRoutes.post('/', feedbackRateLimit, optionalAuthMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { type, message, email, page } = body;

    // Validation
    if (!type || !message) {
      return c.json({ error: 'Type and message are required' }, 400);
    }

    const validTypes = ['bug', 'feature', 'general'];
    if (!validTypes.includes(type)) {
      return c.json({ error: 'Invalid feedback type' }, 400);
    }

    if (message.length < 10) {
      return c.json({ error: 'Message must be at least 10 characters' }, 400);
    }

    if (message.length > 5000) {
      return c.json({ error: 'Message must be less than 5000 characters' }, 400);
    }

    const db = c.get('db');
    const userAgent = c.req.header('User-Agent') || null;

    const feedbackId = generateId();
    const trimmedMessage = message.trim();
    const trimmedEmail = email?.trim() || null;

    await db.insert(schema.userFeedback).values({
      id: feedbackId,
      userId: user?.id || null,
      type,
      message: trimmedMessage,
      email: trimmedEmail,
      page: page || null,
      userAgent,
      status: 'new',
    });

    // Send email notification (non-blocking — don't fail the request if email fails)
    const resendKey = c.env.RESEND_API_KEY;
    const feedbackEmail = c.env.FEEDBACK_EMAIL;
    if (resendKey && feedbackEmail) {
      // Escape HTML entities to prevent XSS in email content
      const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const safeType = esc(type);
      const safeUsername = esc(user?.username || 'Anonymous');
      const safeEmail = trimmedEmail ? esc(trimmedEmail) : '';
      const safePage = esc(page || 'N/A');
      const safeMessage = esc(trimmedMessage);

      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'FilmRoom <noreply@filmroomfantasy.com>',
            to: feedbackEmail,
            subject: `[FilmRoom Feedback] ${type.charAt(0).toUpperCase() + type.slice(1)} — ${trimmedMessage.slice(0, 60).replace(/[<>"]/g, '')}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px;">
                <h2 style="color: #2563eb;">New Feedback Received</h2>
                <table style="border-collapse: collapse; width: 100%;">
                  <tr><td style="padding: 8px; font-weight: bold; color: #64748b;">Type</td><td style="padding: 8px;">${safeType}</td></tr>
                  <tr><td style="padding: 8px; font-weight: bold; color: #64748b;">From</td><td style="padding: 8px;">${safeUsername}${safeEmail ? ` (${safeEmail})` : ''}</td></tr>
                  <tr><td style="padding: 8px; font-weight: bold; color: #64748b;">Page</td><td style="padding: 8px;">${safePage}</td></tr>
                </table>
                <div style="margin-top: 16px; padding: 16px; background: #f1f5f9; border-radius: 8px;">
                  <p style="margin: 0; white-space: pre-wrap;">${safeMessage}</p>
                </div>
                <p style="margin-top: 16px; color: #94a3b8; font-size: 12px;">Feedback ID: ${feedbackId}</p>
              </div>
            `,
          }),
        });
      } catch (emailErr) {
        console.error('[Feedback] Failed to send email notification:', emailErr);
      }
    }

    return c.json({
      success: true,
      message: 'Thank you for your feedback!',
      feedbackId,
    }, 201);
  } catch {
    return c.json({ error: 'Failed to submit feedback' }, 500);
  }
});
