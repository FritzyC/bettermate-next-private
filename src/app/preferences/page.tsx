'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { colors, fonts, radii } from '@/lib/bm/tokens'

type PrefField = { value: string; dealbreaker: boolean }
type Preferences = {
  political: PrefField; religion: PrefField; diet: PrefField;
  drinking: PrefField; smoking: PrefField; kids: PrefField;
  ethnicity: PrefField; education: PrefField; fitness: PrefField;
}
const defaultPref = (): PrefField => ({ value: '', dealbreaker: false })
const defaultPrefs = (): Preferences => ({
  political: defaultPref(), religion: defaultPref(), diet: defaultPref(),
  drinking: defaultPref(), smoking: defaultPref(), kids: defaultPref(),
  ethnicity: defaultPref(), education: defaultPref(), fitness: defaultPref(),
})

const PREF_FIELDS: { key: keyof Preferences; label: string; icon: string; options: string[] }[] = [
  { key:'political', label:'Political leaning', icon:'🗳️', options:['Conservative','Liberal','Moderate','Apolitical','Prefer not to say'] },
  { key:'religion', label:'Religion', icon:'🕊️', options:['Christian','Muslim','Jewish','Hindu','Buddhist','Atheist','Agnostic','Spiritual','Other','Open to all'] },
  { key:'diet', label:'Diet', icon:'🥗', options:['No preference','Omnivore','Vegetarian','Vegan','Halal','Kosher','Gluten-free'] },
  { key:'drinking', label:'Drinking', icon:'🥂', options:['No preference','Never','Socially','Regularly'] },
  { key:'smoking', label:'Smoking', icon:'🚭', options:['No preference','Never','Occasionally','Regularly'] },
  { key:'kids', label:'Kids preference', icon:'👶', options:['Open to all','Want kids','Do not want kids','Have kids / open to more','Do not have kids','Maybe someday','No preference'] },
  { key:'ethnicity', label:'Preferred ethnicity/race', icon:'🌍', options:['Open to all','White / Caucasian','Black / African','Hispanic / Latino','Asian','Middle Eastern','South Asian','Native American','Pacific Islander','Mixed','No preference'] },
  { key:'education', label:'Education', icon:'🎓', options:['No preference','High school','Some college','Bachelors degree','Graduate degree','Trade / vocational'] },
  { key:'fitness', label:'Fitness lifestyle', icon:'💪', options:['No preference','Very active','Moderately active','Occasionally active','Not a priority'] },
]

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
      supabase.from('user_preferences').select('*').eq('id', user.id).maybeSingle()
        .then(({ data }) => {
          if (data) {
            setPrefs({
              political: { value: data.political_view || '', dealbreaker: !!data.political_dealbreaker },
              religion:  { value: data.religion || '', dealbreaker: !!data.religion_dealbreaker },
              diet:      { value: data.diet || '', dealbreaker: !!data.diet_dealbreaker },
              drinking:  { value: data.drinking || '', dealbreaker: !!data.drinking_dealbreaker },
              smoking:   { value: data.smoking || '', dealbreaker: !!data.smoking_dealbreaker },
              kids:      { value: data.kids_preference || '', dealbreaker: !!data.kids_dealbreaker },
              ethnicity: { value: data.ethnicity_preference || '', dealbreaker: !!data.ethnicity_dealbreaker },
              education: { value: data.education_preference || '', dealbreaker: !!data.education_dealbreaker },
              fitness:   { value: data.fitness_lifestyle || '', dealbreaker: !!data.fitness_dealbreaker },
            })
          }
          setLoading(false)
        })
    })
  }, [router])

  const set = (key: keyof Preferences, field: 'value'|'dealbreaker', val: string|boolean) => {
    setPrefs(p => ({ ...p, [key]: { ...p[key], [field]: val } }))
    setSaved(false)
  }

  const save = async () => {
    setSaving(true)
    await supabase.from('user_preferences').upsert({
      id: userId,
      political_view: prefs.political.value, political_dealbreaker: prefs.political.dealbreaker,
      religion: prefs.religion.value, religion_dealbreaker: prefs.religion.dealbreaker,
      diet: prefs.diet.value, diet_dealbreaker: prefs.diet.dealbreaker,
      drinking: prefs.drinking.value, drinking_dealbreaker: prefs.drinking.dealbreaker,
      smoking: prefs.smoking.value, smoking_dealbreaker: prefs.smoking.dealbreaker,
      kids_preference: prefs.kids.value, kids_dealbreaker: prefs.kids.dealbreaker,
      ethnicity_preference: prefs.ethnicity.value, ethnicity_dealbreaker: prefs.ethnicity.dealbreaker,
      education_preference: prefs.education.value, education_dealbreaker: prefs.education.dealbreaker,
      fitness_lifestyle: prefs.fitness.value, fitness_dealbreaker: prefs.fitness.dealbreaker,
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
    <div style={{ minHeight:'100vh', background:`linear-gradient(135deg,${colors.bgDeep},${colors.bgBase})`, padding:'40px 20px' }}>
      <div style={{ maxWidth:520, margin:'0 auto' }}>
        <button onClick={() => router.back()} style={{ background:'transparent', border:'none', color:colors.textMuted, fontFamily:fonts.sans, fontSize:14, cursor:'pointer', marginBottom:24, padding:0 }}>Back</button>
        <h1 style={{ fontFamily:fonts.serif, fontSize:28, color:colors.textPrimary, margin:'0 0 8px' }}>Match Preferences</h1>
        <p style={{ fontFamily:fonts.sans, fontSize:15, color:colors.textMuted, margin:'0 0 28px' }}>Set your preferences and mark dealbreakers. BetterMate uses these to filter and rank your matches.</p>
        <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:28 }}>
          {PREF_FIELDS.map(({ key, label, icon, options }) => (
            <div key={key} style={{ background:colors.bgCard, border:`1px solid ${colors.borderCard}`, borderRadius:radii.sub, padding:'16px 18px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <span style={{ fontFamily:fonts.serif, fontSize:15, color:'#e9d5ff' }}>{icon} {label}</span>
                <button onClick={() => set(key, 'dealbreaker', !prefs[key].dealbreaker)}
                  style={{ padding:'4px 12px', borderRadius:50, border: prefs[key].dealbreaker ? '1.5px solid #f87171' : `1.5px solid ${colors.borderVisible}`, background: prefs[key].dealbreaker ? 'rgba(248,113,113,0.12)' : 'transparent', color: prefs[key].dealbreaker ? '#f87171' : colors.textMuted, fontSize:11, fontFamily:fonts.sans, cursor:'pointer', fontWeight:600 }}>
                  {prefs[key].dealbreaker ? 'Dealbreaker' : 'Dealbreaker?'}
                </button>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {options.map(opt => (
                  <button key={opt} onClick={() => set(key, 'value', prefs[key].value === opt ? '' : opt)}
                    style={{ padding:'8px 14px', borderRadius:50, border: prefs[key].value === opt ? `1.5px solid ${colors.purple}` : `1.5px solid ${colors.borderSubtle}`, background: prefs[key].value === opt ? 'rgba(124,58,237,0.15)' : 'transparent', color: prefs[key].value === opt ? colors.chipActive : colors.chipInactive, fontSize:12, fontFamily:fonts.sans, cursor:'pointer', transition:'all 0.15s ease' }}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button onClick={save} disabled={saving}
          style={{ width:'100%', padding:'18px', borderRadius:radii.card, border:'none', background: saving ? '#1a0f2e' : `linear-gradient(135deg,${colors.purple},${colors.pink})`, color: saving ? colors.textDisabled : '#fff', fontSize:16, fontFamily:fonts.serif, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
        {saved && <p style={{ textAlign:'center', color:colors.success, fontFamily:fonts.sans, fontSize:13, marginTop:12 }}>Preferences saved</p>}
      </div>
    </div>
  )
}
