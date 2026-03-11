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
  | 'plan_confirmed'
  | 'plan_maps_directions_clicked'
  | 'safety_setup_completed'
  | 'plan_checkin_prompt_shown'
  | 'plan_checkin_confirmed'
  | 'plan_checkin_timeout'
  | 'venue_rating_submitted'
  | 'venue_rating_prompt_shown'
  | 'explainable_matching_shown'
  | 'explainable_matching_expanded'
  | 'explainable_matching_applied'
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
  | 'streak_freeze_used'
  | 'coach_insights_generated'
  | 'coach_insights_viewed'
  | 'blind_chat_started'
  | 'blind_chat_message_qualifies'
  | 'blind_chat_threshold_reached'
  | 'blind_chat_revealed'
  | 'integrity_score_changed'
  | 'integrity_visibility_tier_assigned'
  | 'integrity_visibility_restored'
  | 'integrity_score_viewed'
  | 'vibe_recommendation_shown'
  | 'vibe_recommendation_tapped'
  | 'spotify_connect_started'
  | 'spotify_track_search'
  | 'spotify_track_selected'
  | 'store_purchase_prompt_shown'
  | 'store_purchase_completed'
  | 'song_share_sent'
  | 'song_share_opened'
  | 'venue_quality_score_updated'
  | 'preference_model_updated'
  | 'activity_opened'
  | 'activity_selected'
  | 'activity_suggestions_shown'
  | 'activity_match_invite_sent'
  | 'group_created'
  | 'group_invited'
  | 'group_joined'
  | 'group_plan_generated'
  | 'group_vote_cast'
  | 'group_checkin_confirmed'
  | 'ritual_enabled'
  | 'ritual_weekly_pack_shown'
  | 'ritual_plan_started'
  | 'ritual_attended'
  | 'ritual_skipped'
  | 'plan_fairness_explainer_opened'
  | 'pledge.shown'
  | 'pledge.accepted'
  | 'bond.lock_attempt'
  | 'bond.locked'
  | 'bond.active'
  | 'bond.checkin_prompt_shown'
  | 'bond.checkin_submitted'
  | 'bond.resolved';
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
