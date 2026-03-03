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
  | 'plan_cancelled'
  | 'plan_maps_clicked'
  | 'safety_contact_added'
  | 'safety_checkin_timer_set'
  | 'safety_checkin_completed'
  | 'safety_panic_opened'
  | 'safety_panic_sms_sent'
  | 'shop_opened'
  | 'pack_purchased'
  | 'pack_applied'
  | 'compat_graph_computed'  | 'compat_explanation_viewed'
  | 'vibe_opened'
  | 'vibe_closed'
  | 'vibe_section_opened'
  | 'why_this_works_opened'
  | 'streak_viewed'
  | 'streak_freeze_used';

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
