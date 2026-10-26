import { expect, it } from 'vitest'
import { sharedContext } from '../src/personal-context'
it('shows only enabled confirmed global long-term context and never topic-specific plans', () => {
  const memories = [
    {id:'global',issue_id:null,enabled:true,status:'active',horizon:'long_term',content:'需要照顾家人'},
    {id:'job',issue_id:'job',enabled:true,status:'active',horizon:'long_term',content:'正在投递岗位'},
    {id:'off',issue_id:null,enabled:false,status:'active',horizon:'long_term',content:'已经停用'},
    {id:'verify',issue_id:null,enabled:true,status:'needs_review',horizon:'long_term',content:'待核实'},
    {id:'phase',issue_id:null,enabled:true,status:'active',horizon:'current_phase',content:'暂时的目标'},
  ]
  expect(sharedContext(memories as any).map(item=>item.id)).toEqual(['global'])
})
