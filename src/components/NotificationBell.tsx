'use client';
import { useEffect, useState, useRef } from 'react';
import { getSupabase } from '@/lib/supabaseClient';

interface Notification {
  id: string; type: string; title: string; body: string;
  is_read: boolean; action_url: string | null; created_at: string;
}

export default function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function fetchNotifications() {
    const sb = getSupabase(); if (!sb) return;
    const { data } = await sb.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
    if (data) setNotifications(data);
  }

  async function markRead(id: string, actionUrl: string | null) {
    const sb = getSupabase(); if (!sb) return;
    await sb.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    if (actionUrl) window.location.href = actionUrl;
    setOpen(false);
  }

  async function markAllRead() {
    const sb = getSupabase(); if (!sb) return;
    await sb.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }

  useEffect(() => {
    fetchNotifications();
    const sb = getSupabase(); if (!sb) return;
    const channel = sb.channel('notif:' + userId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + userId },
        (payload) => { setNotifications(prev => [payload.new as Notification, ...prev]); })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [userId]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const unread = notifications.filter(n => !n.is_read).length;
  const icons: Record<string, string> = { new_match: '✶', blind_chat_ready: '💬', reveal_ready: '👁', date_planning_open: '📅', bond_required: '💎', meet_window_active: '📍', match_on_hold: '⏸', extended_chat_available: '↗' };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{ position: 'relative', background: 'transparent', border: 'none', cursor: 'pointer', padding: 8, color: '#9d84d0', fontSize: 20, lineHeight: 1 }}>
        🔔
        {unread > 0 && <span style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#db2777)', fontSize: 10, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '110%', width: 320, background: '#0e0720', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', zIndex: 200, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(124,58,237,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e8d8f8', fontFamily: 'Georgia, serif' }}>Notifications</span>
            {unread > 0 && <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#7A6A96', textDecoration: 'underline' }}>Mark all read</button>}
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 18px', textAlign: 'center', color: '#4a3a6a', fontSize: 13 }}>No notifications yet.</div>
            ) : notifications.map(n => (
              <div key={n.id} onClick={() => markRead(n.id, n.action_url)}
                style={{ padding: '14px 18px', borderBottom: '1px solid rgba(124,58,237,0.08)', cursor: n.action_url ? 'pointer' : 'default', background: n.is_read ? 'transparent' : 'rgba(124,58,237,0.06)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 2 }}>{icons[n.type] ?? '✶'}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: n.is_read ? 400 : 600, color: n.is_read ? '#7A6A96' : '#e8d8f8', lineHeight: 1.4, fontFamily: 'Georgia, serif' }}>{n.title}</p>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: '#4a3a6a', lineHeight: 1.5 }}>{n.body}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 10, color: '#2a1a45' }}>{new Date(n.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                {!n.is_read && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed', flexShrink: 0, marginTop: 6 }} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
