import type { Issue } from './domain'

export interface HomeRecord {
  id: string
  text: string
  label: string
  dateLabel: string
  icon: string
  kind: 'step' | 'observation' | 'obstacle' | 'change'
  destination: 'plan' | 'expand'
}
const normalize=(value:string)=>value.trim().replace(/\s+/g,' ')
const timestamp=(value:string)=>{const time=Date.parse(value);return Number.isFinite(time)?time:0}
function dateLabel(value:string) {
  const date=new Date(value)
  return Number.isNaN(date.getTime())?'':`${date.getMonth()+1}月${date.getDate()}日`
}

// No synthesis, transcript access or network requests. Every row is an existing
// user-saved record owned by the currently selected exploration.
export function homeRecordsFor(issue:Issue|null, exclude:readonly string[]=[]):HomeRecord[] {
  if(!issue)return []
  const seen=new Set(exclude.filter(Boolean).map(normalize))
  const plan=issue.plan?.issue_id===issue.id?issue.plan:null
  const saved=plan?.records.filter(r=>r.kind!=='decision') || []
  const savedIds=new Set(saved.map(r=>r.id))
  const observations=[...saved,...issue.feedback.filter(r=>!savedIds.has(`feedback:${r.id}`)).map(r=>({...r,id:`feedback:${r.id}`}))]
  const feedback:HomeRecord[]=observations.sort((a,b)=>timestamp(b.created_at)-timestamp(a.created_at))
    .filter(item=>item.text.trim()).map(item=>({
      id:`${issue.id}:${item.id}`,text:item.text.trim(),dateLabel:dateLabel(item.created_at),
      kind:item.kind==='change'?'change':item.kind==='stuck'?'obstacle':'observation',
      label:item.kind==='change'?'想法变化':item.kind==='stuck'?'遇到的阻碍':'你的观察',
      icon:item.kind==='change'?'paths':item.kind==='stuck'?'compass':'note',destination:'expand',
    }))
  const action=issue.card.next_step.trim().split('\n')[0].trim()
  const step:HomeRecord|undefined=action?{
    id:`${issue.id}:step`,text:action,dateLabel:'',kind:'step',icon:'step',destination:'plan',
    label:issue.ended_at?'当时选过的一步':plan?.status==='paused'?'先放一放的一步':plan?.status==='completed'?'已经完成的一步':'你选过的一步',
  }:undefined
  // The saved attempt and one subsequent observation form a continuation, not
  // a menu or an activity feed. No blank slot is kept for a missing observation.
  const candidates=[...(step?[step]:[]),...feedback]
  const result:HomeRecord[]=[]
  for(const item of candidates){
    const key=normalize(item.text)
    if(seen.has(key))continue
    seen.add(key);result.push(item)
    if(item.kind!=='step')break
  }
  return result
}
