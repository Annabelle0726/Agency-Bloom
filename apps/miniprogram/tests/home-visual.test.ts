import { expect, it } from 'vitest'
import { resolveHomeRecordVisual } from '../src/home-visual'
import { getVisual, resolveVisualPath } from '../src/visual-library'
import { themes } from '../src/themes'
import type { Issue } from '../src/domain'
const issue:Issue={id:'a',title:'自己的问题',concerns:['direction'],card:{title:'',options:[],confirmed:[],constraints:[],hypotheses:[],unknowns:[],next_step:'试做一份需求练习'},stage:'',background:'',feedback:[],version:1,created_at:'2026-10-25T08:00:00Z',updated_at:'2026-10-25T08:00:00Z',ended_at:null}
it('resolves only deployed shared artwork with a real variant for each active theme',()=>{
  for(const theme of themes){
    const art=resolveHomeRecordVisual(issue,theme.id)
    expect(art).not.toBeNull()
    const source=getVisual(art!.id)!
    expect(source.deploy).toBe(true)
    expect(source.intendedPage).toContain('shared')
    expect(source.themeCompatibility).toContain(theme.id)
    expect(art!.src).toBe(resolveVisualPath(art!.id,theme.id,'card-thumbnail'))
    expect(resolveHomeRecordVisual(issue,theme.id)).toEqual(art)
  }
})
it('uses real night art in Quiet Night and never creates artwork for absent saved attempts',()=>{
  const art=resolveHomeRecordVisual(issue,'dark')!
  expect(getVisual(art.id)!.themeCompatibility).toEqual(['dark'])
  expect(resolveHomeRecordVisual(null,'forest')).toBeNull()
  expect(resolveHomeRecordVisual({...issue,card:{...issue.card,next_step:''}},'forest')).toBeNull()
})
