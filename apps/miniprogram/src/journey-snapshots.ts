import type { InitialSnapshot, Issue } from './domain'
import type { JourneyEvent } from './journey'

/** Project a saved starting record, never a reconstruction from today's card. */
export function snapshotJourneyEvent(snapshot:InitialSnapshot|null, issue:Issue):JourneyEvent|null {
  if(!snapshot || snapshot.id!=='snapshot:'+issue.id || !Number.isFinite(Date.parse(snapshot.captured_at))) return null
  return {id:snapshot.id,issue_id:issue.id,issue_title:issue.title,kind:'snapshot',title:'初始快照',
    text:snapshot.answers.question?.trim()||snapshot.direction?.trim()||'当时保存的回答，点击查看初始快照',
    created_at:snapshot.captured_at,editable:false,source_label:'初始整理 · 只读',source_available:true}
}
export async function loadJourneySnapshots(issues:Issue[], request:(method:'GET',path:string)=>Promise<unknown>) {
  const items:JourneyEvent[]=[], failures:Issue[]=[]
  for(let offset=0;offset<issues.length;offset+=5) {
    const group=issues.slice(offset,offset+5)
    const results=await Promise.allSettled(group.map(issue=>request('GET','/issues/'+encodeURIComponent(issue.id)+'/snapshot')))
    results.forEach((result,index)=>{
      if(result.status==='rejected'){failures.push(group[index]);return}
      const event=snapshotJourneyEvent(result.value as InitialSnapshot|null,group[index])
      if(event)items.push(event)
      else if(result.value!==null)failures.push(group[index])
    })
  }
  return {items,failures:failures.length}
}
