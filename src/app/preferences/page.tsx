'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { colors, fonts, radii } from '@/lib/bm/tokens'

type PrefField = { values: string[]; dealbreaker: boolean }
type Preferences = {
  political: PrefField; religion: PrefField; diet: PrefField;
  drinking: PrefField; smoking: PrefField; kids: PrefField;
  ethnicity: PrefField; education: PrefField; fitness: PrefField;
}
const defaultPref = (): PrefField => ({ values: [], dealbreaker: false })
const defaultPrefs = (): Preferences => ({
  political: defaultPref(), religion: defaultPref(), diet: defaultPref(),
  drinking: defaultPref(), smoking: defaultPref(), kids: defaultPref(),
  ethnicity: defaultPref(), education: defaultPref(), fitness: defaultPref(),
})

const PREF_FIELDS: { key: keyof Preferences; label: string; icon: string; note: string; options: string[] }[] = [
  { key:'political', label:'Political leaning', icon:'🗳️', note:'Select all that apply', options:['Conservative','Liberal','Moderate','Apolitical','Prefer not to say'] },
  { key:'religion', label:'Religion', icon:'🕊️', note:'Select all that apply', options:['Christian','Muslim','Jewish','Hindu','Buddhist','Atheist','Agnostic','Spiritual','Other','Open to all'] },
  { key:'diet', label:'Diet', icon:'🥗', note:'Select all that apply', options:['No preference','Omnivore','Vegetarian','Vegan','Halal','Kosher','Gluten-free'] },
  { key:'drinking', label:'Drinking', icon:'🥂', note:'Select all that apply', options:['No preference','Never','Socially','Regularly'] },
  { key:'smoking', label:'Smoking', icon:'🚭', note:'Select all that apply', options:['No preference','Never','Occasionally','Regularly'] },
  { key:'kids', label:'Kids preference', icon:'👶', note:'Select all that apply', options:['Open to all','Want kids','Do not want kids','Have kids / open to more','Do not have kids','Maybe someday','No preference'] },
  { key:'ethnicity', label:'Preferred ethnicity / race', icon:'🌍', note:'Select all that apply — optional', options:['Open to all','White / Caucasian','Black / African','Hispanic / Latino','Asian','Middle Eastern','South Asian','Native American','Pacific Islander','Mixed','No preference'] },
  { key:'education', label:'Education', icon:'🎓', note:'Select all that apply', options:['No preference','High school','Some college','Bachelors degree','Graduate degree','Trade / vocational'] },
  { key:'fitness', label:'Fitness lifestyle', icon:'💪', note:'Select all that apply', options:['No preference','Very active','Moderately active','Occasionally active','Not a priority'] },
]

function toArr(v: string | string[] | null | undefined): string[] {
  if (!v) return []
  if (Array.isArray(v)) return v
  return [v]
}

export default function PreferencesPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string>('')
  const [prefs, setPrefs] = useState<Preferences>(defaultPrefs())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/auth'); return }
      setUserId(user.id)
      supabase.from('user_match_preferences').select('*').eq('id', user.id).maybeSingle()
        .then(({ data }) => {
          if (data) {
            setPrefs({
              political: { values: toArr(data.political_view), dealbreaker: !!data.political_dealbreaker },
              religion:  { values: toArr(data.religion), dealbreaker: !!data.religion_dealbreaker },
              diet:      { values: toArr(data.diet), dealbreaker: !!data.diet_dealbreaker },
              drinking:  { values: toArr(data.drinking), dealbreaker: !!data.drinking_dealbreaker },
              smoking:   { values: toArr(data.smoking), dealbreaker: !!data.smoking_dealbreaker },
              kids:      { values: toArr(data.kids_preference), dealbreaker: !!data.kids_dealbreaker },
              ethnicity: { values: toArr(data.ethnicity_preference), dealbreaker: !!data.ethnicity_dealbreaker },
              education: { values: toArr(data.education_preference), dealbreaker: !!data.education_dealbreaker },
              fitness:   { values: toArr(data.fitness_lifestyle), dealbreaker: !!data.fitness_dealbreaker },
            })
          }
          setLoading(false)
        })
    })
  }, [router])

  const toggle = (key: keyof Preferences, opt: string) => {
    setPrefs(p => {
      const cur = p[key].values
      const next = cur.includes(opt) ? cur.filter(v => v !== opt) : [...cur, opt]
      return { ...p, [key]: { ...p[key], values: next } }
    })
    setSaved(false)
  }

  const toggleDB = (key: keyof Preferences) => {
    setPrefs(p => ({ ...p, [key]: { ...p[key], dealbreaker: !p[key].dealbreaker } }))
    setSaved(false)
  }

  const save = async () => {
    setSaving(true)
    await supabase.from('user_match_preferences').upsert({
      id: userId,
      political_view: prefs.political.values, political_dealbreaker: prefs.political.dealbreaker,
      religion: prefs.religion.values, religion_dealbreaker: prefs.religion.dealbreaker,
      diet: prefs.diet.values, diet_dealbreaker: prefs.diet.dealbreaker,
      drinking: prefs.drinking.values, drinking_dealbreaker: prefs.drinking.dealbreaker,
      smoking: prefs.smoking.values, smoking_dealbreaker: prefs.smoking.dealbreaker,
      kids_preference: prefs.kids.values, kids_dealbreaker: prefs.kids.dealbreaker,
      ethnicity_preference: prefs.ethnicity.values, ethnicity_dealbreaker: prefs.ethnicity.dealbreaker,
      education_preference: prefs.education.values, education_dealbreaker: prefs.education.dealbreaker,
      fitness_lifestyle: prefs.fitness.values, fitness_dealbreaker: prefs.fitness.dealbreaker,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' })
    setSaving(false); setSaved(true)
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:colors.bgDeep, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <p style={{ color:colors.textMuted, fontFamily:fonts.sans }}>Loading...</p>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:`linear-gradient(135deg,${colors.bgDeep},${colors.bgBase})`, padding:'40px 20px 80px' }}>
      <div style={{ maxWidth:520, margin:'0 auto' }}>
        <button onClick={() => router.back()} style={{ background:'transparent', border:'none', color:colors.textMuted, fontFamily:fonts.sans, fontSize:14, cursor:'pointer', marginBottom:24, padding:0 }}>← Back</button>
        <h1 style={{ fontFamily:fonts.serif, fontSize:28, color:colors.textPrimary, margin:'0 0 8px' }}>Match Preferences</h1>
        <p style={{ fontFamily:fonts.sans, fontSize:14, color:colors.textMuted, margin:'0 0 28px', lineHeight:1.6 }}>Select all that apply. Toggle dealbreaker on any category to filter out incompatible matches.</p>
        <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:28 }}>
          {PREF_FIELDS.map(({ key, label, icon, note, options }) => (
            <div key={key} style={{ background:colors.bgCard, border:`1px solid ${colors.borderCard}`, borderRadius:radii.sub, padding:'16px 18px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ fontFamily:fonts.serif, fontSize:15, color:'#e9d5ff' }}>{icon} {label}</span>
                <button onClick={() => toggleDB(key)}
                  style={{ padding:'4px 12px', borderRadius:50, border: prefs[key].dealbreaker ? '1.5px solid #f87171' : `1.5px solid ${colors.borderVisible}`, background: prefs[key].dealbreaker ? 'rgba(248,113,113,0.12)' : 'transparent', color: prefs[key].dealbreaker ? '#f87171' : colors.textMuted, fontSize:11, fontFamily:fonts.sans, cursor:'pointer', fontWeight:600, whiteSpace:'nowrap' }}>
                  {prefs[key].dealbreaker ? '🚫 Dealbreaker' : 'Dealbreaker?'}
                </button>
              </div>
              <p style={{ margin:'0 0 10px', fontSize:11, color:colors.textMuted, fontFamily:fonts.sans }}>{note}</p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {options.map(opt => {
                  const active = prefs[key].values.includes(opt)
                  return (
                    <button key={opt} onClick={() => toggle(key, opt)}
                      style={{ padding:'8px 14px', borderRadius:50, border: active ? `1.5px solid ${colors.purple}` : `1.5px solid ${colors.borderSubtle}`, background: active ? 'rgba(124,58,237,0.18)' : 'transparent', color: active ? colors.chipActive : colors.chipInactive, fontSize:12, fontFamily:fonts.sans, cursor:'pointer', transition:'all 0.15s ease', fontWeight: active ? 600 : 400 }}>
                      {active ? '✓ ' : ''}{opt}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <button onClick={save} disabled={saving}
          style={{ width:'100%', padding:'18px', borderRadius:radii.card, border:'none', background: saving ? '#1a0f2e' : `linear-gradient(135deg,${colors.purple},${colors.pink})`, color: saving ? colors.textDisabled : '#fff', fontSize:16, fontFamily:fonts.serif, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
        {saved && <p style={{ textAlign:'center', color:colors.success, fontFamily:fonts.sans, fontSize:13, marginTop:12 }}>✓ Preferences saved</p>}
      </div>
    </div>
  )
}
