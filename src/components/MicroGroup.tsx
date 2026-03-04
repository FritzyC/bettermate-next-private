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
const BRAND = 'linear-gradient(135deg, #7B1C4A, #4A0F2E)';
const SUCCESS = '#4CAF7D';

export default function MicroGroup({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [step, setStep] = useState<'list' | 'create' | 'invite'>('list');
  const [newGroup, setNewGroup] = useState({ name: '', activity_id: '', max_size: 4 });
  const [inviteEmail, setInviteEmail] = useState('');
  const [createdGroup, setCreatedGroup] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (open) load(); }, [open]);

  async function load() {
    const supabase = getSupabase();
    if (!supabase) return;
    const [{ data: myGroups }, { data: acts }] = await Promise.all([
      supabase.from('group_members').select('group_id, groups(*)').eq('user_id', userId),
      supabase.from('activities').select('*'),
    ]);
    setGroups((myGroups || []).map((m: any) => m.groups).filter(Boolean));
    setActivities(acts || []);
  }

  async function createGroup() {
    if (!newGroup.name.trim() || !newGroup.activity_id) return;
    setCreating(true);
    const supabase = getSupabase();
    if (!supabase) { setCreating(false); return; }
    const { data: group } = await supabase.from('groups').insert({
      creator_id: userId,
      name: newGroup.name,
      activity_id: newGroup.activity_id,
      max_size: newGroup.max_size,
    }).select().single();
    if (group) {
      await supabase.from('group_members').insert({
        group_id: group.id, user_id: userId, role: 'creator', status: 'joined',
        joined_at: new Date().toISOString(),
      });
      await trackEvent('group_created', { group_id: group.id, activity_id: newGroup.activity_id });
      setCreatedGroup(group);
      setStep('invite');
      load();
    }
    setCreating(false);
  }

  async function inviteMember() {
    if (!inviteEmail.trim() || !createdGroup) return;
    setLoading(true);
    const supabase = getSupabase();
    if (!supabase) { setLoading(false); return; }
    const { data: user } = await supabase.from('user_profiles').select('id').eq('email', inviteEmail.trim()).single();
    if (user) {
      await supabase.from('group_members').insert({
        group_id: createdGroup.id, user_id: user.id, role: 'member', status: 'invited',
      });
      await trackEvent('group_invited', { group_id: createdGroup.id, invitee_id: user.id });
      setInviteEmail('');
    }
    setLoading(false);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        style={{ width: '100%', padding: '14px 20px', background: 'transparent', border: 'none', borderTop: '1px solid ' + BORDER, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18 }}>{'👥'}</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT2 }}>Micro-Groups</div>
            <div style={{ fontSize: 11, color: MUTED }}>Plan with 2–6 people around an activity</div>
          </div>
        </div>
        <span style={{ fontSize: 12, color: MUTED }}>{'▼'}</span>
      </button>
    );
  }

  return (
    <div style={{ background: SURFACE, borderTop: '1px solid ' + BORDER }}>
      <button onClick={() => { setOpen(false); setStep('list'); }}
        style={{ width: '100%', padding: '14px 20px', background: ELEVATED, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18 }}>{'👥'}</span>
          <div style={{ fontSize: 13, fontWeight: 600, color: GOLD }}>Micro-Groups</div>
        </div>
        <span style={{ fontSize: 12, color: MUTED }}>{'▲'}</span>
      </button>

      <div style={{ padding: '16px 20px' }}>

        {step === 'list' && (
          <div>
            {groups.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{'👥'}</div>
                <div style={{ fontSize: 13, color: TEXT2, marginBottom: 4 }}>No groups yet</div>
                <div style={{ fontSize: 12, color: MUTED }}>Create a group around an activity and invite 1–5 people.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {groups.map((g: any) => (
                  <div key={g.id} style={{ padding: '12px 14px', background: ELEVATED, border: '1px solid ' + BORDER, borderRadius: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{g.name}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{g.activity_id} · {g.status}</div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setStep('create')}
              style={{ width: '100%', padding: '11px', background: BRAND, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              + Create a Group
            </button>
          </div>
        )}

        {step === 'create' && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <p style={{ margin: '0 0 6px', fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Group name</p>
              <input value={newGroup.name} onChange={e => setNewGroup(g => ({ ...g, name: e.target.value }))}
                placeholder="e.g. Comedy Tuesday Crew"
                style={{ width: '100%', padding: '10px 12px', background: ELEVATED, border: '1px solid ' + BORDER, borderRadius: 10, color: TEXT, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <p style={{ margin: '0 0 6px', fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Activity</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {activities.map(a => (
                  <button key={a.id} onClick={() => setNewGroup(g => ({ ...g, activity_id: a.id }))}
                    style={{ padding: '6px 12px', background: newGroup.activity_id === a.id ? 'rgba(201,169,110,0.15)' : ELEVATED, border: '1px solid ' + (newGroup.activity_id === a.id ? GOLD : BORDER), borderRadius: 16, color: newGroup.activity_id === a.id ? GOLD : MUTED, fontSize: 11, cursor: 'pointer' }}>
                    {a.icon} {a.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <p style={{ margin: '0 0 6px', fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Max size</p>
              <div style={{ display: 'flex', gap: 6 }}>
                {[2,3,4,5,6].map(n => (
                  <button key={n} onClick={() => setNewGroup(g => ({ ...g, max_size: n }))}
                    style={{ flex: 1, padding: '8px', background: newGroup.max_size === n ? 'rgba(201,169,110,0.15)' : ELEVATED, border: '1px solid ' + (newGroup.max_size === n ? GOLD : BORDER), borderRadius: 8, color: newGroup.max_size === n ? GOLD : MUTED, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep('list')}
                style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid ' + BORDER, borderRadius: 10, color: MUTED, fontSize: 12, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={createGroup} disabled={creating || !newGroup.name.trim() || !newGroup.activity_id}
                style={{ flex: 2, padding: '10px', background: BRAND, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: creating ? 0.7 : 1 }}>
                {creating ? 'Creating...' : 'Create Group'}
              </button>
            </div>
          </div>
        )}

        {step === 'invite' && createdGroup && (
          <div>
            <div style={{ padding: '12px 14px', background: 'rgba(76,175,125,0.08)', border: '1px solid rgba(76,175,125,0.2)', borderRadius: 12, marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{'👥'}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: SUCCESS }}>{createdGroup.name} created</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Invite people by their BetterMate email</div>
            </div>
            <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
              placeholder="friend@email.com"
              style={{ width: '100%', padding: '10px 12px', background: ELEVATED, border: '1px solid ' + BORDER, borderRadius: 10, color: TEXT, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
            <button onClick={inviteMember} disabled={loading || !inviteEmail.trim()}
              style={{ width: '100%', padding: '10px', background: BRAND, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1, marginBottom: 8 }}>
              {loading ? 'Inviting...' : 'Send Invite'}
            </button>
            <button onClick={() => { setStep('list'); setCreatedGroup(null); }}
              style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px solid ' + BORDER, borderRadius: 10, color: MUTED, fontSize: 12, cursor: 'pointer' }}>
              Done
            </button>
            <p style={{ margin: '12px 0 0', fontSize: 11, color: MUTED, lineHeight: 1.5, textAlign: 'center' }}>
              Groups use the same safety and integrity mechanics as 1-on-1 plans.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
