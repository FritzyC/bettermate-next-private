import { getSupabase } from '@/lib/supabaseClient';
import { trackEvent } from '@/lib/bm/track';

export type PreferenceWeights = {
  preferred_tags: Record<string, number>;
  preferred_categories: Record<string, number>;
  avg_rating_given: number;
  total_ratings: number;
};

export async function updatePreferences(
  userId: string,
  rating: number,
  tags: string[],
  category: string,
  matchId: string
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const { data: existing } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existing) {
    const newTotal = existing.total_ratings + 1;
    const newAvg = ((existing.avg_rating_given * existing.total_ratings) + rating) / newTotal;

    // Update tag weights — positive ratings boost, negative dampen
    const tagWeights = { ...(existing.preferred_tags || {}) };
    const delta = rating >= 4 ? 1 : rating <= 2 ? -0.5 : 0;
    tags.forEach(tag => {
      tagWeights[tag] = Math.max(0, (tagWeights[tag] || 0) + delta);
    });

    // Update category weights
    const catWeights = { ...(existing.preferred_categories || {}) };
    if (category) {
      catWeights[category] = Math.max(0, (catWeights[category] || 0) + (rating >= 4 ? 1 : rating <= 2 ? -0.5 : 0.2));
    }

    const { error } = await supabase.from('user_preferences').update({
      preferred_tags: tagWeights,
      preferred_categories: catWeights,
      avg_rating_given: Math.round(newAvg * 10) / 10,
      total_ratings: newTotal,
      last_updated: new Date().toISOString(),
    }).eq('user_id', userId);

    if (!error) {
      await trackEvent('preference_model_updated', {
        deltas: { tags, category, rating, delta },
      }, matchId);
    }
  } else {
    const tagWeights: Record<string, number> = {};
    const catWeights: Record<string, number> = {};
    const delta = rating >= 4 ? 1 : rating <= 2 ? -0.5 : 0.2;
    tags.forEach(tag => { tagWeights[tag] = Math.max(0, delta); });
    if (category) catWeights[category] = Math.max(0, delta);

    await supabase.from('user_preferences').insert({
      user_id: userId,
      preferred_tags: tagWeights,
      preferred_categories: catWeights,
      avg_rating_given: rating,
      total_ratings: 1,
    });

    await trackEvent('preference_model_updated', {
      deltas: { tags, category, rating, delta },
    }, matchId);
  }
}

export async function getPreferences(userId: string): Promise<PreferenceWeights | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data || null;
}

export function getTopPreferences(prefs: PreferenceWeights, n = 3): string[] {
  const tags = Object.entries(prefs.preferred_tags || {})
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([tag]) => tag);
  return tags;
}

export function getPreferenceExplanation(prefs: PreferenceWeights): string | null {
  if (!prefs || prefs.total_ratings < 2) return null;
  const top = getTopPreferences(prefs, 2);
  if (top.length === 0) return null;
  const tagLabels: Record<string, string> = {
    safe: 'safe spots',
    romantic: 'romantic settings',
    good_for_talking: 'quiet places good for conversation',
    great_music: 'venues with great music',
    loud: 'lively venues',
    crowded: 'busy social scenes',
    overpriced: 'value-for-money spots',
  };
  const readable = top.map(t => tagLabels[t] || t).join(' and ');
  return `Suggested because you tend to enjoy ${readable}.`;
}
