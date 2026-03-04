export type UserValues = {
  life_trajectory: string;
  conflict_style: string;
  finance_alignment: string;
  growth_orientation: string;
  relationship_readiness: string;
};

export type CompatibilityDimension = {
  id: string; label: string; icon: string; score: number;
  headline: string; detail: string; color: string;
};

export type CompatibilityResult = {
  overallScore: number;
  grade: 'Exceptional' | 'Strong' | 'Promising' | 'Developing';
  summary: string;
  dimensions: CompatibilityDimension[];
  isReal: boolean;
};

const T: Record<string,Record<string,number>> = {
  'Building something new':         {'Building something new':5,'Growing steadily in a career':4,'Exploring different paths':3,'Focused on stability and balance':2},
  'Growing steadily in a career':   {'Building something new':4,'Growing steadily in a career':5,'Exploring different paths':3,'Focused on stability and balance':4},
  'Exploring different paths':      {'Building something new':3,'Growing steadily in a career':3,'Exploring different paths':5,'Focused on stability and balance':2},
  'Focused on stability and balance':{'Building something new':2,'Growing steadily in a career':4,'Exploring different paths':2,'Focused on stability and balance':5},
};
const C: Record<string,Record<string,number>> = {
  'Talk about it directly':              {'Talk about it directly':5,'Take time to process before discussing':4,'Try to smooth things over quickly':3,'Avoid conflict unless necessary':2},
  'Take time to process before discussing':{'Talk about it directly':4,'Take time to process before discussing':5,'Try to smooth things over quickly':4,'Avoid conflict unless necessary':3},
  'Try to smooth things over quickly':   {'Talk about it directly':3,'Take time to process before discussing':4,'Try to smooth things over quickly':5,'Avoid conflict unless necessary':4},
  'Avoid conflict unless necessary':     {'Talk about it directly':2,'Take time to process before discussing':3,'Try to smooth things over quickly':4,'Avoid conflict unless necessary':4},
};
const F: Record<string,Record<string,number>> = {
  'Invest and build long-term':              {'Invest and build long-term':5,'Balance saving and enjoying life':4,'Live experiences now':2,'Prefer simplicity over financial ambition':3},
  'Balance saving and enjoying life':        {'Invest and build long-term':4,'Balance saving and enjoying life':5,'Live experiences now':3,'Prefer simplicity over financial ambition':4},
  'Live experiences now':                    {'Invest and build long-term':2,'Balance saving and enjoying life':3,'Live experiences now':5,'Prefer simplicity over financial ambition':3},
  'Prefer simplicity over financial ambition':{'Invest and build long-term':3,'Balance saving and enjoying life':4,'Live experiences now':3,'Prefer simplicity over financial ambition':5},
};
const G: Record<string,Record<string,number>> = {
  'Creating new things':                  {'Creating new things':5,'Improving something that already works':4,'Exploring possibilities':4,'Helping others grow':3},
  'Improving something that already works':{'Creating new things':4,'Improving something that already works':5,'Exploring possibilities':3,'Helping others grow':4},
  'Exploring possibilities':              {'Creating new things':4,'Improving something that already works':3,'Exploring possibilities':5,'Helping others grow':3},
  'Helping others grow':                  {'Creating new things':3,'Improving something that already works':4,'Exploring possibilities':3,'Helping others grow':5},
};
const R: Record<string,Record<string,number>> = {
  'Long-term relationship':                    {'Long-term relationship':5,'Serious dating':4,'Meeting people and seeing where it goes':2,'Friendships and social connections':1},
  'Serious dating':                            {'Long-term relationship':4,'Serious dating':5,'Meeting people and seeing where it goes':3,'Friendships and social connections':2},
  'Meeting people and seeing where it goes':   {'Long-term relationship':2,'Serious dating':3,'Meeting people and seeing where it goes':5,'Friendships and social connections':4},
  'Friendships and social connections':        {'Long-term relationship':1,'Serious dating':2,'Meeting people and seeing where it goes':4,'Friendships and social connections':5},
};

function fallback(matchId: string): CompatibilityResult {
  const seed = matchId.split('').reduce((a,c)=>a+c.charCodeAt(0),0);
  const rand=(mn:number,mx:number,o=0)=>{const v=((seed+o)*2654435761)>>>0;return Math.round(mn+(v%((mx-mn)*10))/10);};
  const dims:CompatibilityDimension[]=[
    {id:'trajectory',label:'Life Trajectory',icon:'◈',score:rand(3,5,1),color:'#c084fc',headline:'Complete your profile',detail:'Finish onboarding to see your real compatibility score on this dimension.'},
    {id:'conflict',label:'Conflict Style',icon:'◉',score:rand(2,5,2),color:'#f0abca',headline:'Complete your profile',detail:'Finish onboarding to see your real compatibility score on this dimension.'},
    {id:'finance',label:'Finance Alignment',icon:'◎',score:rand(3,5,3),color:'#a78bfa',headline:'Complete your profile',detail:'Finish onboarding to see your real compatibility score on this dimension.'},
    {id:'growth',label:'Growth Orientation',icon:'◐',score:rand(2,5,4),color:'#f9a8c9',headline:'Complete your profile',detail:'Finish onboarding to see your real compatibility score on this dimension.'},
    {id:'readiness',label:'Relationship Readiness',icon:'◑',score:rand(3,5,5),color:'#c4b5fd',headline:'Complete your profile',detail:'Finish onboarding to see your real compatibility score on this dimension.'},
  ];
  const avg=dims.reduce((a,d)=>a+d.score,0)/dims.length;
  const overallScore=Math.round((avg/5)*100);
  const grade=overallScore>=85?'Exceptional':overallScore>=70?'Strong':overallScore>=55?'Promising':'Developing';
  return {overallScore,grade,isReal:false,summary:'Finish your values profile to unlock your real compatibility snapshot.',dimensions:dims};
}

export function calculateCompatibility(a:UserValues|null,b:UserValues|null,matchId:string):CompatibilityResult {
  if(!a||!b) return fallback(matchId);
  const lk=(m:Record<string,Record<string,number>>,x:string,y:string)=>m[x]?.[y]??3;
  const ts=lk(T,a.life_trajectory,b.life_trajectory);
  const cs=lk(C,a.conflict_style,b.conflict_style);
  const fs=lk(F,a.finance_alignment,b.finance_alignment);
  const gs=lk(G,a.growth_orientation,b.growth_orientation);
  const rs=lk(R,a.relationship_readiness,b.relationship_readiness);
  const headlines:(s:number)=>{headline:string;detail:string}=(s)=>s>=4?{headline:'Strong alignment',detail:'Your values closely match on this dimension.'}:s===3?{headline:'Compatible with nuance',detail:'You have meaningful overlap here with some healthy differences.'}:{headline:'Worth a real conversation',detail:'You diverge on this dimension. That is fine — if you are both honest about it.'};
  const dims:CompatibilityDimension[]=[
    {id:'trajectory',label:'Life Trajectory',icon:'\u25c8',color:'#c084fc',score:ts,...(ts>=4?{headline:'Headed in the same direction',detail:'You share a similar sense of where life is going. That reduces the friction that derails most relationships over time.'}:ts===3?{headline:'Different paths, compatible pace',detail:'Your trajectories differ but are workable if you stay honest with each other early.'}:{headline:'Worth an honest conversation',detail:'Your life directions look quite different right now. Transparency here is non-optional.'})},
    {id:'conflict',label:'Conflict Style',icon:'\u25c9',color:'#f0abca',score:cs,...(cs>=4?{headline:'Compatible under pressure',detail:'You handle friction in compatible ways. That makes repair faster and keeps resentment from building.'}:cs===3?{headline:'Complementary conflict styles',detail:'Your approaches differ but are not incompatible. Name the difference before it becomes a pattern.'}:{headline:'This dimension needs attention',detail:'Very different conflict styles compound over time. It is worth discussing early.'})},
    {id:'finance',label:'Finance Alignment',icon:'\u25ce',color:'#a78bfa',score:fs,...(fs>=4?{headline:'Similar money mindset',detail:'Financial alignment is one of the strongest predictors of long-term compatibility. You have it.'}:fs===3?{headline:'Workable financial differences',detail:'Your money philosophies have some distance. Navigable with clear communication.'}:{headline:'Financial alignment is worth discussing',detail:'Significant money mindset gaps are one of the most common friction sources. Name it early.'})},
    {id:'growth',label:'Growth Orientation',icon:'\u25d0',color:'#f9a8c9',score:gs,...(gs>=4?{headline:'Both wired to keep moving',detail:'You will push each other forward without one person feeling dragged or held back.'}:gs===3?{headline:'Different drivers, similar energy',detail:'Motivated by different things but both oriented toward growth. That can be genuinely complementary.'}:{headline:'Growth misalignment creates friction',detail:'One of you leans toward creation, the other toward improvement or stability. Awareness helps.'})},
    {id:'readiness',label:'Relationship Readiness',icon:'\u25d1',color:'#c4b5fd',score:rs,...(rs>=4?{headline:'On the same page about what this is',detail:'You both want the same thing right now. That removes one of the most common sources of unspoken hurt in early dating.'}:rs===3?{headline:'Similar enough to explore',detail:'Your readiness is close but not identical. Close enough to move forward with honesty.'}:{headline:'Readiness gap — be upfront',detail:'There is a meaningful difference in what you are each looking for. Have the real conversation early.'})},
  ];
  const weighted=(ts+cs+fs+gs+(rs*2));
  const overallScore=Math.round((weighted/(5*6))*100);
  const grade:CompatibilityResult['grade']=overallScore>=85?'Exceptional':overallScore>=70?'Strong':overallScore>=55?'Promising':'Developing';
  const summary=overallScore>=85?'Rare alignment across what actually matters. This deserves your full attention.':overallScore>=70?'Solid foundation with real shared values. The friction that exists will make you both better.':overallScore>=55?"Real potential here. The differences aren\'t dealbreakers \u2014 they\'re data.":'Still early. The gaps are real \u2014 which makes honesty more important than chemistry right now.';
  return {overallScore,grade,summary,dimensions:dims,isReal:true};
}
