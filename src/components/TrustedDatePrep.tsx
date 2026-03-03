'use client';

import React, { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';
import { trackEvent } from '@/lib/bm/track';

const SURFACE = '#2A1648';
const ELEVATED = '#342058';
const BORDER = '#5A3A8A';
const TEXT = '#EDE8F5';
const TEXT2 = '#B8A8D4';
const MUTED = '#7A6A96';
const GOLD = '#C9A96E';
const GOLD2 = '#E2C488';
const BRAND = 'linear-gradient(135deg, #7B1C4A, #4A0F2E)';
const SUCCESS = '#4CAF7D';
const ACCENT = '#8452B8';

const PACKS = [
  {
    id: 'date_prep',
    name: 'Date Prep Pack',
    emoji: '🎯',
    tagline: 'Show up with clarity and intention',
    credits: 50,
    usd: '$0.50',
    benefits: [
      'Guided pre-date prompts to reduce nerves',
      'Mutual boundary clarifier — know what you both want',
      'Date checklist so nothing is forgotten',
    ],
    color: '#8452B8',
    bg: 'rgba(132,82,184,0.1)',
    border: 'rgba(132,82,184,0.3)',
  },
  {
    id: 'convo_boost',
    name: 'Conversation Booster',
    emoji: '✨',
    tagline: '5 AI icebreakers from your shared fingerprint',
    credits: 25,
    usd: '$0.25',
    benefits: [
      'AI reads both your fingerprints',
      'Generates 5 conversation starters specific to you two',
      'Unlocks inside the chat before the date',
    ],
    color: GOLD,
    bg: 'rgba(201,169,110,0.1)',
    border: 'rgba(201,169,110,0.3)',
  },
  {
    id: 'plan_confidence',
    name: 'Plan Confidence',
    emoji: '🤝',
    tagline: 'A mutual intent moment — no pressure, full clarity',
    credits: 35,
    usd: '$0.35',
    benefits: [
      'Send a "mutual intent" confirmation to your match',
      'Both see each other stated intention for the date',
      'Reduces uncertainty and second-guessing',
    ],
    color: '#4CAF7D',
    bg: 'rgba(76,175,125,0.08)',
    border: 'rgba(76,175,125,0.25)',
  },
  {
    id: 'event_finder',
    name: 'Event Finder',
    emoji: '🎵',
    tagline: '5 extra curated event suggestions near you',
    credits: 75,
    usd: '$0.75',
    benefits: [
      'Expands beyond the 3 default venue suggestions',
      'Finds concerts, comedy shows, events you both like',
      'Pulled from live event data near your area',
    ],
    color: '#6BA3F5',
    bg: 'rgba(107,163,245,0.08)',
    border: 'rgba(107,163,245,0.25)',
  },
  {
    id: 'match_extension',
    name: 'Match Extension',
    emoji: '⏳',
    tagline: '+24hrs on your commitment window',
    credits: 100,
    usd: '$1.00',
    benefits: [
      'Adds 24 hours to your 72-hour commitment window',
      'Both users must purchase to activate',
      'Credits returned if extension is not mutually confirmed',
    ],
    color: '#D4A843',
    bg: 'rgba(212,168,67,0.08)',
    border: 'rgba(212,168,67,0.25)',
  },
];

type ActiveContent = {
  prompts?: string[];
  checklist?: string[];
  boundary?: string;
  icebreakers?: string[];
  intent?: string;
};

export default function TrustedDatePrep({ matchId, userId, inline = false }: { matchId: string; userId: string; inline?: boolean }) {
  const [open, setOpen] = useState(false);
  const [balance, setBalance] = useState(0);
  const [appliedPacks, setAppliedPacks] = useState<string[]>([]);
  const [activePack, setActivePack] = useState<string | null>(null);
  const [activeContent, setActiveContent] = useState<ActiveContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [intentText, setIntentText] = useState('');
  const [intentSent, setIntentSent] = useState(false);

  useEffect(() => { load(); }, [userId, matchId]);

  async function load() {
    const supabase = getSupabase();
    if (!supabase) return;
    const [{ data: credits }, { data: packs }] = await Promise.all([
      supabase.from('user_credits').select('balance').eq('user_id', userId).single(),
      supabase.from('applied_packs').select('pack_id').eq('user_id', userId).eq('match_id', matchId),
    ]);
    setBalance(credits?.balance ?? 0);
    setAppliedPacks((packs ?? []).map((p: any) => p.pack_id));
    setLoading(false);
  }

  async function purchase(pack: typeof PACKS[0]) {
    if (balance < pack.credits) return;
    setPurchasing(pack.id);
    const supabase = getSupabase();
    if (!supabase) return;

    await supabase.from('user_credits').update({ balance: balance - pack.credits, updated_at: new Date().toISOString() }).eq('user_id', userId);
    await supabase.from('credit_purchases').insert({ user_id: userId, match_id: matchId, pack_id: pack.id, pack_name: pack.name, credits_spent: pack.credits });
    await supabase.from('applied_packs').upsert({ user_id: userId, match_id: matchId, pack_id: pack.id });

    setBalance(b => b - pack.credits);
    setAppliedPacks(p => [...p, pack.id]);
    await trackEvent('pack_purchased', { pack_id: pack.id, credits: pack.credits }, matchId);

    await applyPack(pack.id);
    setPurchasing(null);
  }

  async function applyPack(packId: string) {
    setGenerating(true);
    setActivePack(packId);

    const supabase = getSupabase();
    if (!supabase) { setGenerating(false); return; }

    if (packId === 'date_prep') {
      const content: ActiveContent = {
        prompts: [
          'What is one thing you are genuinely curious about in this person?',
          'What would make this date feel successful to you — in your own words?',
          'What is one thing you hope they notice about you?',
        ],
        checklist: [
          'Know the venue address and have directions ready',
          'Charge your phone before leaving',
          'Tell someone you trust where you are going',
          'Arrive 5 minutes early — it shows intention',
          'Put your phone away when they are talking',
        ],
        boundary: 'Think about one boundary you want to honor tonight. You do not need to say it out loud — just know it.',
      };
      setActiveContent(content);
    }

    if (packId === 'convo_boost') {
      const { data: myFP } = await supabase.from('user_fingerprint').select('*').eq('id', userId).single();
      const { data: match } = await supabase.from('matches').select('user1_id, user2_id').eq('id', matchId).single();
      const otherId = match?.user1_id === userId ? match?.user2_id : match?.user1_id;
      const { data: theirFP } = await supabase.from('user_fingerprint').select('*').eq('id', otherId).single();

      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 800,
            messages: [{
              role: 'user',
              content: `Generate 5 warm, specific conversation starters for a first date between two people.

Person A: hobbies=${myFP?.hobbies?.join(', ')}, music=${myFP?.music_genres?.join(', ')}, narrative=${myFP?.narrative_themes?.join(', ')}, about=${myFP?.about_self || 'not provided'}, ideal sunday=${myFP?.ideal_sunday || 'not provided'}
Person B: hobbies=${theirFP?.hobbies?.join(', ')}, music=${theirFP?.music_genres?.join(', ')}, narrative=${theirFP?.narrative_themes?.join(', ')}, about=${theirFP?.about_self || 'not provided'}, ideal sunday=${theirFP?.ideal_sunday || 'not provided'}

Rules:
- Each starter must reference something specific from their actual shared or complementary interests
- Warm, curious, not cheesy
- Open-ended questions that invite a real story
- Max 20 words each

Respond with JSON only: { "icebreakers": ["...", "...", "...", "...", "..."] }`
            }],
          }),
        });
        const data = await res.json();
        const text = data.content?.[0]?.text ?? '';
        const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
        setActiveContent({ icebreakers: parsed.icebreakers });
      } catch (_) {
        setActiveContent({ icebreakers: ['What is something you discovered recently that surprised you?', 'What does a perfect weekend look like for you?', 'What is something most people do not know about you?', 'What has been on your mind lately?', 'What made you smile this week?'] });
      }
    }

    if (packId === 'plan_confidence') {
      setActiveContent({ intent: '' });
    }

    if (packId === 'event_finder') {
      setActiveContent({ prompts: ['Event Finder is active. When you generate venues in the Date Plan, you will now see up to 8 suggestions instead of 3.'] });
    }

    if (packId === 'match_extension') {
      const supabase2 = getSupabase();
      if (supabase2) {
        await supabase2.from('date_plans').update({
          commitment_deadline_at: new Date(Date.now() + 24 * 3600000).toISOString(),
        }).eq('match_id', matchId);
        setActiveContent({ prompts: ['Your commitment window has been extended by 24 hours. Both users must purchase this pack to activate the full extension.'] });
      }
    }

    await trackEvent('pack_applied', { pack_id: packId }, matchId);
    setGenerating(false);
  }

  async function sendIntent() {
    if (!intentText.trim()) return;
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.from('messages').insert({
      match_id: matchId,
      sender_user_id: userId,
      body: '🤝 My intention for our date: ' + intentText,
    });
    setIntentSent(true);
    await trackEvent('pack_applied', { pack_id: 'plan_confidence', intent: intentText }, matchId);
  }

  if (loading) return null;

  return (
    <div style={{ borderBottom: inline ? 'none' : '1px solid ' + BORDER }}>
      <button onClick={() => { setOpen(!open); if (!open) trackEvent('shop_opened', {}, matchId); }}
        style={{ width: '100%', padding: '13px 20px', background: open ? SURFACE : 'transparent', border: 'none', borderTop: '1px solid ' + BORDER, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>🎁</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: GOLD }}>Trusted Date Prep</div>
            <div style={{ fontSize: 11, color: MUTED }}>
              {appliedPacks.length > 0 ? appliedPacks.length + ' pack' + (appliedPacks.length > 1 ? 's' : '') + ' active' : 'Optional upgrades for a better date'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: GOLD }}>${(balance / 100).toFixed(2)}</span>
          <span style={{ fontSize: 12, color: MUTED }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div style={{ background: SURFACE, padding: '20px' }}>

          {/* Active pack content */}
          {activePack && activeContent && (
            <div style={{ marginBottom: 20, padding: '16px', background: ELEVATED, borderRadius: 14, border: '1px solid ' + BORDER }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 12, color: GOLD, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {PACKS.find(p => p.id === activePack)?.name}
                </span>
                <button onClick={() => { setActivePack(null); setActiveContent(null); }}
                  style={{ background: 'none', border: 'none', color: MUTED, fontSize: 12, cursor: 'pointer' }}>close</button>
              </div>

              {generating && <p style={{ color: MUTED, fontSize: 13 }}>Generating...</p>}

              {activeContent.prompts && activeContent.prompts.map((p, i) => (
                <div key={i} style={{ padding: '10px 14px', background: SURFACE, borderRadius: 10, marginBottom: 8, fontSize: 13, color: TEXT2, lineHeight: 1.6 }}>
                  {p}
                </div>
              ))}

              {activeContent.checklist && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ margin: '0 0 10px', fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Checklist</p>
                  {activeContent.checklist.map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < activeContent.checklist!.length - 1 ? '1px solid ' + BORDER : 'none' }}>
                      <span style={{ color: SUCCESS, flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: 13, color: TEXT2 }}>{item}</span>
                    </div>
                  ))}
                </div>
              )}

              {activeContent.boundary && (
                <div style={{ marginTop: 14, padding: '12px', background: 'rgba(132,82,184,0.1)', borderRadius: 10, border: '1px solid rgba(132,82,184,0.2)', fontSize: 13, color: TEXT2, lineHeight: 1.6 }}>
                  💜 {activeContent.boundary}
                </div>
              )}

              {activeContent.icebreakers && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {activeContent.icebreakers.map((ice, i) => (
                    <div key={i} style={{ padding: '12px 14px', background: SURFACE, borderRadius: 10, border: '1px solid ' + BORDER, fontSize: 13, color: TEXT, lineHeight: 1.5 }}>
                      <span style={{ color: GOLD, marginRight: 6 }}>{i + 1}.</span>{ice}
                    </div>
                  ))}
                </div>
              )}

              {activeContent.intent !== undefined && !intentSent && (
                <div>
                  <p style={{ margin: '0 0 10px', fontSize: 13, color: TEXT2, lineHeight: 1.6 }}>What is your intention for this date? Your match will see it.</p>
                  <textarea value={intentText} onChange={e => setIntentText(e.target.value)}
                    placeholder="I am showing up open, curious, and ready to be present..."
                    rows={3} style={{ width: '100%', padding: '12px', background: SURFACE, border: '1px solid ' + BORDER, borderRadius: 10, color: TEXT, fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'system-ui', boxSizing: 'border-box', marginBottom: 10 }} />
                  <button onClick={sendIntent} disabled={!intentText.trim()}
                    style={{ width: '100%', padding: '12px', background: intentText.trim() ? BRAND : ELEVATED, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: intentText.trim() ? 'pointer' : 'not-allowed' }}>
                    Send My Intention
                  </button>
                </div>
              )}

              {intentSent && (
                <div style={{ padding: '12px', background: 'rgba(76,175,125,0.1)', borderRadius: 10, border: '1px solid rgba(76,175,125,0.3)', textAlign: 'center', fontSize: 13, color: SUCCESS }}>
                  ✓ Intention sent to your match
                </div>
              )}
            </div>
          )}

          {/* Pack catalog */}
          <p style={{ margin: '0 0 14px', fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
            Every pack is optional. Your date can happen without them. These are quality upgrades — not requirements.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {PACKS.map(pack => {
              const owned = appliedPacks.includes(pack.id);
              const canAfford = balance >= pack.credits;
              const isActive = activePack === pack.id;
              const isBuying = purchasing === pack.id;

              return (
                <div key={pack.id} style={{ background: owned ? pack.bg : ELEVATED, border: '1px solid ' + (owned ? pack.border : BORDER), borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 20 }}>{pack.emoji}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: owned ? pack.color : TEXT }}>{pack.name}</div>
                          <div style={{ fontSize: 11, color: MUTED }}>{pack.tagline}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: owned ? pack.color : GOLD }}>{pack.usd}</div>
                        <div style={{ fontSize: 10, color: MUTED }}>{pack.credits} cr</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                      {pack.benefits.map((b, i) => (
                        <div key={i} style={{ fontSize: 12, color: TEXT2, display: 'flex', gap: 6 }}>
                          <span style={{ color: owned ? pack.color : ACCENT, flexShrink: 0 }}>·</span>{b}
                        </div>
                      ))}
                    </div>

                    {owned ? (
                      <button onClick={() => isActive ? setActivePack(null) : applyPack(pack.id)}
                        style={{ width: '100%', padding: '10px', background: isActive ? pack.bg : 'transparent', border: '1px solid ' + pack.border, borderRadius: 10, color: pack.color, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        {generating && activePack === pack.id ? 'Loading...' : isActive ? 'Hide Content' : 'View Pack'}
                      </button>
                    ) : (
                      <button onClick={() => canAfford && !isBuying && purchase(pack)}
                        disabled={!canAfford || !!isBuying}
                        style={{ width: '100%', padding: '10px', background: canAfford ? BRAND : ELEVATED, border: 'none', borderRadius: 10, color: canAfford ? '#fff' : MUTED, fontSize: 13, fontWeight: 600, cursor: canAfford ? 'pointer' : 'not-allowed' }}>
                        {isBuying ? 'Purchasing...' : canAfford ? 'Add to Date — ' + pack.usd : 'Need ' + Math.ceil((pack.credits - balance) / 100 * 100) / 100 + ' more credits'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 16, padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, fontSize: 11, color: MUTED, lineHeight: 1.6, textAlign: 'center' }}>
            All purchases are in Bond Wallet credits. No recurring charges. No hidden fees.
          </div>
        </div>
      )}
    </div>
  );
}
