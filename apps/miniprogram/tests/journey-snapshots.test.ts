import { expect, it, vi } from 'vitest'
import { loadJourneySnapshots, snapshotJourneyEvent } from '../src/journey-snapshots'
import type { InitialSnapshot, Issue } from '../src/domain'
const issue={id:'a',title:'现在的标题'} as Issue
const snapshot:InitialSnapshot={id:'snapshot:a',version:2,direction:'当时的方向',source:'onboarding',captured_at:'2026-10-20T08:00:00Z',background:'',stage:'unsure',life_contexts:[],constraints:[],concerns:[],answers:{question:'技能还可以用在哪里'}}
it('projects an existing snapshot using its saved capture time and read-only identity',()=>{
  const before=JSON.stringify(snapshot),event=snapshotJourneyEvent(snapshot,issue)
  expect(event).toMatchObject({id:'snapshot:a',kind:'snapshot',title:'初始快照',text:snapshot.answers.question,created_at:snapshot.captured_at,editable:false,issue_id:'a'})
  expect(JSON.stringify(snapshot)).toBe(before)
})
it('does not fabricate a snapshot from the current card, or accept another exploration or invalid dates',()=>{
  expect(snapshotJourneyEvent(null,issue)).toBeNull()
  expect(snapshotJourneyEvent({...snapshot,id:'snapshot:other'},issue)).toBeNull()
  expect(snapshotJourneyEvent({...snapshot,captured_at:'not a date'},issue)).toBeNull()
})
it('keeps available snapshots when another read fails, and distinguishes absent records',async()=>{
  const request=vi.fn(async(_method:string,path:string)=>{if(path.includes('/b/'))throw Error('offline');return path.includes('/c/')?null:snapshot})
  const result=await loadJourneySnapshots([issue,{id:'b'} as Issue,{id:'c'} as Issue],request)
  expect(result.items.map(item=>item.id)).toEqual(['snapshot:a'])
  expect(result.failures).toBe(1)
  expect(request.mock.calls.every(([method])=>method==='GET')).toBe(true)
})
