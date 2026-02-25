/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/messageUtils.ts
// Utility functions for the messages feature.

export type MessageRow = {
  id: string;
  match_id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

/**
 * Fetch message history for a match, sorted oldest-first.
 * @param client  A configured Supabase JS client.
 * @param matchId UUID of the match.
 * @param limit   How many messages to load (default 50).
 */
export async function fetchMessages(
  client: any,
  matchId: string,
  limit = 50
): Promise<{ data: MessageRow[]; error: string | null }> {
  const { data, error } = await client
    .from('messages')
    .select('id,match_id,sender_user_id,body,created_at')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) return { data: [], error: error.message || 'fetch_error' };
  return { data: (data ?? []) as MessageRow[], error: null };
}

/**
 * Subscribe to new INSERT events on the messages table for a match.
 * Returns a cleanup function that removes the channel.
 */
export function subscribeToMessages(
  client: any,
  matchId: string,
  onMessage: (msg: MessageRow) => void
): () => void {
  const channel = client
    .channel(`messages:${matchId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `match_id=eq.${matchId}`,
      },
      (payload: any) => {
        onMessage(payload.new as MessageRow);
      }
    )
    .subscribe();

  return () => {
    try {
      client.removeChannel(channel);
    } catch {
      // ignore
    }
  };
}

/**
 * Format a message timestamp for display.
 * Returns a locale-aware string like "2:34 PM" for today, or "Jan 3, 2:34 PM" for older.
 */
export function formatMessageTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();

    if (sameDay) {
      return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    }
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Fetch a single message by its ID.
 */
export async function getMessage(
  client: any,
  messageId: string
): Promise<{ data: MessageRow | null; error: string | null }> {
  const { data, error } = await client
    .from('messages')
    .select('id,match_id,sender_user_id,body,created_at')
    .eq('id', messageId)
    .maybeSingle();

  if (error) return { data: null, error: error.message || 'fetch_error' };
  return { data: data as MessageRow | null, error: null };
}
