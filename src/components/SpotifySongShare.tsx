'use client';

import React, { useEffect, useState, useRef } from 'react';
import { getSupabase } from '@/lib/supabaseClient';
import { trackEvent } from '@/lib/bm/track';

const SURFACE = '#2A1648';
const ELEVATED = '#342058';
const BORDER = '#5A3A8A';
const TEXT = '#EDE8F5';
const TEXT2 = '#B8A8D4';
const MUTED = '#7A6A96';
const GOLD = '#C9A96E';
const BRAND = 'linear-gradient(135deg, #7B1C4A, #4A0F2E)';
const SUCCESS = '#4CAF7D';
const SPOTIFY_GREEN = '#1DB954';

const SONG_SHARE_COST = 99;
const DAILY_LIMIT = 999;

type Track = {
  id: string;
  name: string;
  artist: string;
  album: string;
  album_art: string;
  preview_url: string | null;
  external_url: string;
};

async function getSpotifyToken(userId: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase
    .from('user_integrations')
    .select('access_token, expires_at, refresh_token')
    .eq('user_id', userId)
    .eq('provider', 'spotify')
    .single();
  if (!data) return null;
  if (new Date(data.expires_at) > new Date()) return data.access_token;
  // Token expired — refresh
  try {
    const res = await fetch('/api/spotify/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: data.refresh_token, user_id: userId }),
    });
    const json = await res.json();
    return json.access_token || null;
  } catch {
    return null;
  }
}

async function searchTracks(query: string, token: string): Promise<Track[]> {
  const res = await fetch(
    'https://api.spotify.com/v1/search?q=' + encodeURIComponent(query) + '&type=track&limit=6',
    { headers: { Authorization: 'Bearer ' + token } }
  );
  const data = await res.json();
  return (data.tracks?.items || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    artist: t.artists.map((a: any) => a.name).join(', '),
    album: t.album.name,
    album_art: t.album.images?.[1]?.url || t.album.images?.[0]?.url || '',
    preview_url: t.preview_url,
    external_url: t.external_urls?.spotify || '',
  }));
}

export default function SpotifySongShare({
  matchId,
  userId,
  inline = false,
}: {
  matchId: string;
  userId: string;
  inline?: boolean;
}) {
  const [integration, setIntegration] = useState<any>(null);
  const [credits, setCredits] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'idle' | 'search' | 'confirm' | 'sent'>('idle');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [selected, setSelected] = useState<Track | null>(null);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [dailyCount, setDailyCount] = useState(0);
  const [open, setOpen] = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { load(); }, [userId, matchId]);

  async function load() {
    const supabase = getSupabase();
    if (!supabase) return;
    const [{ data: integ }, { data: wallet }, { data: logs }] = await Promise.all([
      supabase.from('user_integrations').select('*').eq('user_id', userId).eq('provider', 'spotify').single(),
      supabase.from('user_credits').select('balance').eq('user_id', userId).single(),
      supabase.from('song_share_log').select('id').eq('sender_id', userId).eq('match_id', matchId)
        .gte('sent_at', new Date(Date.now() - 86400000).toISOString()),
    ]);
    setIntegration(integ || null);
    setCredits(wallet?.balance || 0);
    setDailyCount(logs?.length || 0);
    setLoading(false);
  }

  function connectSpotify() {
    trackEvent('spotify_connect_started', {});
    const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || '';
    const redirect = encodeURIComponent(window.location.origin.replace('localhost', '127.0.0.1') + '/api/spotify/callback');
    const scopes = encodeURIComponent('user-read-private user-read-email');
    const state = encodeURIComponent(userId + '|' + matchId);
    window.location.href =
      'https://accounts.spotify.com/authorize?response_type=code&client_id=' + clientId +
      '&scope=' + scopes + '&redirect_uri=' + redirect + '&state=' + state;
  }

  async function doSearch(q: string) {
    if (!q.trim() || q.length < 2) { setResults([]); return; }
    setSearching(true);
    trackEvent('spotify_track_search', { query: q }, matchId);
    try {
      const token = await getSpotifyToken(userId);
      if (!token) { setResults([]); return; }
      const tracks = await searchTracks(q, token);
      setResults(tracks);
    } catch { setResults([]); }
    setSearching(false);
  }

  function handleQueryChange(val: string) {
    setQuery(val);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => doSearch(val), 400);
  }

  function selectTrack(track: Track) {
    setSelected(track);
    setStep('confirm');
    trackEvent('spotify_track_selected', { track_id: track.id }, matchId);
  }

  async function sendSong() {
    if (!selected) return;
    setSending(true);
    const supabase = getSupabase();
    if (!supabase) return;

    // Check credits
    if (credits < SONG_SHARE_COST) { setSending(false); return; }
    if (dailyCount >= DAILY_LIMIT) { setSending(false); return; }

    trackEvent('store_purchase_prompt_shown', { item: 'song_share', price_credits: SONG_SHARE_COST }, matchId);

    // Deduct credits
    const { error: creditErr } = await supabase
      .from('user_credits')
      .update({ balance: credits - SONG_SHARE_COST })
      .eq('user_id', userId);
    if (creditErr) { setSending(false); return; }

    // Insert message
    await supabase.from('messages').insert({
      match_id: matchId,
      sender_user_id: userId,
      body: 'Thinking of you — listening to this.',
      message_type: 'song_share',
      metadata: {
        track_id: selected.id,
        name: selected.name,
        artist: selected.artist,
        album_art: selected.album_art,
        preview_url: selected.preview_url,
        external_url: selected.external_url,
      },
    });

    // Log to song_share_log
    await supabase.from('song_share_log').insert({
      sender_id: userId,
      match_id: matchId,
      track_id: selected.id,
      track_name: selected.name,
      artist: selected.artist,
      credits_spent: SONG_SHARE_COST,
    });

    await trackEvent('store_purchase_completed', { item: 'song_share', price_credits: SONG_SHARE_COST }, matchId);
    await trackEvent('song_share_sent', { match_id: matchId, track_id: selected.id }, matchId);

    setStep('sent');
    setDailyCount(c => c + 1);
    setCredits(c => c - SONG_SHARE_COST);
    setSending(false);
  }

  if (loading) return null;

  // Not connected
  if (!integration) {
    return (
      <div style={{ padding: '16px', background: ELEVATED, border: '1px solid ' + BORDER, borderRadius: 14, marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 22 }}>🎵</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Send a Song</div>
            <div style={{ fontSize: 11, color: MUTED }}>Share what you are listening to — 99cr per send</div>
          </div>
        </div>
        <button onClick={connectSpotify}
          style={{ width: '100%', padding: '11px', background: SPOTIFY_GREEN, border: 'none', borderRadius: 10, color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>♪</span> Connect Spotify
        </button>
        <p style={{ margin: '10px 0 0', fontSize: 11, color: MUTED, textAlign: 'center', lineHeight: 1.5 }}>
          Search-only access. We never read your listening history without permission.
        </p>
      </div>
    );
  }

  // Sent confirmation
  if (step === 'sent') {
    return (
      <div style={{ padding: '16px', background: 'rgba(76,175,125,0.08)', border: '1px solid rgba(76,175,125,0.25)', borderRadius: 14, marginTop: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🎵</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: SUCCESS, marginBottom: 4 }}>Song sent</div>
        <div style={{ fontSize: 12, color: MUTED }}>{selected?.name} — {selected?.artist}</div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 8 }}>
          {DAILY_LIMIT - dailyCount} sends remaining today
        </div>
        {dailyCount < DAILY_LIMIT && (
          <button onClick={() => { setStep('search'); setQuery(''); setResults([]); setSelected(null); }}
            style={{ marginTop: 12, padding: '8px 20px', background: 'transparent', border: '1px solid ' + BORDER, borderRadius: 8, color: MUTED, fontSize: 11, cursor: 'pointer' }}>
            Send another
          </button>
        )}
      </div>
    );
  }

  // Main UI
  return (
    <div style={{ padding: '16px', background: ELEVATED, border: '1px solid ' + BORDER, borderRadius: 14, marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🎵</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Send a Song</div>
            <div style={{ fontSize: 11, color: MUTED }}>99cr · {DAILY_LIMIT - dailyCount} left today</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: credits >= SONG_SHARE_COST ? GOLD : MUTED }}>
          {credits}cr balance
        </div>
      </div>

      {dailyCount >= DAILY_LIMIT ? (
        <div style={{ padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: 12, color: MUTED, textAlign: 'center' }}>
          Daily limit reached (3/3). Come back tomorrow.
        </div>
      ) : credits < SONG_SHARE_COST ? (
        <div style={{ padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: 12, color: MUTED, textAlign: 'center' }}>
          Not enough credits. You need 99cr to send a song.
        </div>
      ) : step === 'idle' ? (
        <button onClick={() => setStep('search')}
          style={{ width: '100%', padding: '11px', background: BRAND, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Choose a song to send
        </button>
      ) : step === 'search' ? (
        <div>
          <input
            autoFocus
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            placeholder="Search for a song or artist..."
            style={{ width: '100%', padding: '10px 12px', background: SURFACE, border: '1px solid ' + BORDER, borderRadius: 10, color: TEXT, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
          />
          {searching && <div style={{ fontSize: 12, color: MUTED, textAlign: 'center', padding: '8px' }}>Searching...</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
            {results.map(track => (
              <button key={track.id} onClick={() => selectTrack(track)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: SURFACE, border: '1px solid ' + BORDER, borderRadius: 10, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                {track.album_art && (
                  <img src={track.album_art} alt="" style={{ width: 40, height: 40, borderRadius: 6, flexShrink: 0, objectFit: 'cover' }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name}</div>
                  <div style={{ fontSize: 11, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artist}</div>
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => { setStep('idle'); setQuery(''); setResults([]); }}
            style={{ marginTop: 10, background: 'none', border: 'none', color: MUTED, fontSize: 11, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      ) : step === 'confirm' && selected ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', background: SURFACE, borderRadius: 12, marginBottom: 14, border: '1px solid ' + BORDER }}>
            {selected.album_art && (
              <img src={selected.album_art} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{selected.name}</div>
              <div style={{ fontSize: 12, color: MUTED }}>{selected.artist}</div>
            </div>
          </div>
          <div style={{ padding: '10px 12px', background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.2)', borderRadius: 10, marginBottom: 14, fontSize: 12, color: TEXT2, lineHeight: 1.5 }}>
            "Thinking of you — listening to this."<br/>
            <span style={{ color: MUTED }}>Costs 99cr from your balance ({credits}cr).</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setStep('search'); }}
              style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid ' + BORDER, borderRadius: 10, color: MUTED, fontSize: 12, cursor: 'pointer' }}>
              Back
            </button>
            <button onClick={sendSong} disabled={sending}
              style={{ flex: 2, padding: '10px', background: sending ? 'rgba(29,185,84,0.4)' : SPOTIFY_GREEN, border: 'none', borderRadius: 10, color: '#000', fontSize: 13, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer' }}>
              {sending ? 'Sending...' : 'Send for 99cr'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
