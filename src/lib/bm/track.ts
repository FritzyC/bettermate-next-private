import { getSupabase } from '@/lib/supabaseClient';

export type EventType =
  | 'onboarding_completed'
  | 'match_opened'
  | 'message_sent'
  | 'invite_created'
  | 'invite_accepted'
  | 'snapshot_viewed'
  | 'snapshot_expanded'
  | 'bond_proposed'
  | 'bond_accepted'
  | 'bond_declined'
  | 'date_pact_deposit'
  | 'date_pact_confirmed'
  | 'plan_started'
  | 'plan_venues_presented'
  | 'plan_venue_selected'
  | 'plan_venue_confirmed'
  | 'plan_venue_mismatch'
  | 'plan_time_selected'
  | 'plan_time_confirmed'
  | 'plan_checkin_confirmed'
  | 'plan_cancelled';

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
