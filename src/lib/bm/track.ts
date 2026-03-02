import { getSupabase } from '@/lib/supabaseClient';

export type EventType =
  | 'onboarding_completed'
  | 'match_opened'
  | 'message_sent'
  | 'invite_created'
  | 'invite_accepted'
  | 'snapshot_viewed'
  | 'snapshot_expanded';

export async function trackEvent(
  eventType: EventType,
  payload: Record<string, any> = {},
  matchId?: string
) {
  try {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await supabase.from('behavior_events').insert({
      user_id: session.user.id,
      match_id: matchId ?? null,
      event_type: eventType,
      payload,
    });
  } catch (_) {
    // never block UI for tracking
  }
}
