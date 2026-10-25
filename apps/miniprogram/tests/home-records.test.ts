import { describe, expect, it } from 'vitest'
import { homeRecordsFor } from '../src/home-records'
import type { Issue } from '../src/domain'

const issue = (id='a'): Issue => ({ id, title:'想给创作留一点时间', concerns:[], stage:'', background:'', version:1,
  created_at:'2026-10-20T08:00:00Z', updated_at:'2026-10-24T08:00:00Z', ended_at:null, feedback:[],
  card:{ title:'想给创作留一点时间', options:[], constraints:[], confirmed:[], hypotheses:['AI 尚未确认的建议'], unknowns:[], next_step:'' } })
const feedback = (id:string,text:string,date='2026-10-24T08:00:00Z',kind='progress') => ({id,text,created_at:date,kind})

describe('Home records come from this exploration and the user’s saved content',()=>{
  it('shows a Plan record once using its Journey identity and reflects a confirmed pause',()=>{
    const current=issue(); current.card.next_step='问朋友'
    current.plan={issue_id:'a',version:2,next_step:'问朋友',status:'paused',attempt_id:'attempt',latest:null,records:[{id:'record:one',title:'经历',text:'我还没决定',created_at:'2026-10-25T08:00:00Z',version:'1',kind:'thought',attempt_id:'attempt',editable:true}]}
    expect(homeRecordsFor(current).map(r=>r.id)).toEqual(['a:step','a:record:one'])
    expect(homeRecordsFor(current)[0].label).toContain('放一放')
  })
  it('has no invented records when no exploration, feedback or chosen step exists',()=>{
    expect(homeRecordsFor(null)).toEqual([])
    expect(homeRecordsFor(issue())).toEqual([])
  })
  it('shows the latest actual feedback and the saved attempt, with no fabricated attempt date',()=>{
    const current=issue()
    current.card.next_step='周末做一份小作品\n投入：两小时\n停止条件：影响休息时先暂停'
    current.feedback=[feedback('old','没有足够的时间','2026-10-21T08:00:00Z','stuck'),feedback('new','试着留出了周六的两小时')]
    const records=homeRecordsFor(current)
    expect(records.map(r=>r.id)).toEqual(['a:step','a:feedback:new'])
    expect(records[1].text).toBe('试着留出了周六的两小时')
    expect(records[1].dateLabel).toBe('10月24日')
    expect(records[0].text).toBe('周末做一份小作品')
    expect(records[0].dateLabel).toBe('')
    expect(records[0].destination).toBe('plan')
  })
  it('shows just the latest observation when there is no chosen next step',()=>{
    const current=issue()
    current.feedback=[feedback('a','还是想先照顾好休息','2026-10-22T08:00:00Z','change'),feedback('b','和朋友聊完有了新想法','2026-10-24T08:00:00Z'),feedback('c','试了以后发现有点累','2026-10-23T08:00:00Z','stuck')]
    expect(homeRecordsFor(current).map(r=>r.id)).toEqual(['a:feedback:b'])
    expect(current.feedback.map(r=>r.id)).toEqual(['a','b','c'])
  })
  it('deduplicates repeated text and does not echo the approved primary card',()=>{
    const current=issue(); current.card.next_step='  先休息一下  '
    current.feedback=[feedback('new','先休息一下'),feedback('old','先休息一下','2026-10-21T08:00:00Z'),feedback('other','想法有了一点变化','2026-10-20T08:00:00Z','change')]
    expect(homeRecordsFor(current,['先休息一下']).map(r=>r.text)).toEqual(['想法有了一点变化'])
    expect(homeRecordsFor(current).map(r=>r.text)).toEqual(['先休息一下','想法有了一点变化'])
  })
  it('reflects changed wishes without interpreting them as failure or a new goal',()=>{
    const current=issue(); current.ended_at='2026-10-25T08:00:00Z'
    current.feedback=[feedback('pause','暂时不想再转行了','2026-10-24T08:00:00Z','change')]
    const [record]=homeRecordsFor(current)
    expect(record.text).toBe('暂时不想再转行了')
    expect(record.label).toBe('想法变化')
    expect(record.destination).toBe('expand')
  })
  it('does not reuse another exploration’s content after switching or deleting records',()=>{
    const first=issue('first');first.feedback=[feedback('1','第一件事的观察')]
    const second=issue('second');second.card.next_step='第二件事的小尝试'
    expect(homeRecordsFor(second).map(r=>r.text)).toEqual(['第二件事的小尝试'])
    expect(homeRecordsFor(first)).toHaveLength(1)
    first.feedback=[]
    expect(homeRecordsFor(first)).toEqual([])
    expect(homeRecordsFor(null)).toEqual([])
  })
  it('preserves full user wording for expansion, ignores blanks and does not invent invalid dates',()=>{
    const current=issue()
    const text='今天有一个很长的发现\n我发现比起职位名称，更在意每天在做什么，也可能还需要再想一想'
    current.feedback=[feedback('blank','  '),feedback('long',text,'not-a-date')]
    const [record]=homeRecordsFor(current)
    expect(record.text).toBe(text)
    expect(record.dateLabel).toBe('')
    expect(homeRecordsFor(current)).toHaveLength(1)
  })
})
