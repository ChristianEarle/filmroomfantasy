import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export interface NotificationItem {
  id: string;
  type: string; // 'injury' | 'news' | 'waiver' | 'trade' | 'system'
  title: string;
  body: string | null;
  playerId: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string; // ISO timestamp
}

const POLL_INTERVAL_MS = 60_000;

/** Compact relative timestamp for notification rows ("5m ago", "3h ago"). */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'just now';
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * The authenticated user's in-app notifications. Fetches once when auth
 * resolves, then polls every 60s while the tab is visible (and refetches
 * immediately when the tab becomes visible again). markRead/markAllRead
 * update optimistically and revert on API failure. For logged-out users
 * everything is empty and the mutators are no-ops.
 */
export function useNotifications() {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Keep the latest state available to revert handlers without re-binding them.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const unreadCountRef = useRef(unreadCount);
  unreadCountRef.current = unreadCount;

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setItems([]);
      setUnreadCount(0);
      return;
    }
    try {
      const data = await api.get<{ notifications: NotificationItem[]; unreadCount: number }>(
        '/notifications',
      );
      setItems(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // Non-fatal — keep whatever we have.
    }
  }, [isAuthenticated]);

  // Initial load on mount / auth change.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refresh().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // Poll while the tab is visible; refetch immediately on return to the tab.
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isAuthenticated, refresh]);

  const markRead = useCallback(
    async (id: string) => {
      if (!isAuthenticated) return;
      const target = itemsRef.current.find((n) => n.id === id);
      if (!target || target.isRead) return;

      // Optimistic update.
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        await api.post(`/notifications/${encodeURIComponent(id)}/read`);
      } catch {
        // Revert on failure.
        setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: false } : n)));
        setUnreadCount((prev) => prev + 1);
      }
    },
    [isAuthenticated],
  );

  const markAllRead = useCallback(async () => {
    if (!isAuthenticated) return;
    const prevItems = itemsRef.current;
    const prevCount = unreadCountRef.current;
    if (prevCount === 0) return;

    // Optimistic update.
    setItems((prev) => prev.map((n) => (n.isRead ? n : { ...n, isRead: true })));
    setUnreadCount(0);

    try {
      await api.post('/notifications/read-all');
    } catch {
      // Revert to the pre-optimistic snapshot.
      setItems(prevItems);
      setUnreadCount(prevCount);
    }
  }, [isAuthenticated]);

  return { items, unreadCount, loading, refresh, markRead, markAllRead };
}
