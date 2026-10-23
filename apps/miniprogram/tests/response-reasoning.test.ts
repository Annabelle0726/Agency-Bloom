import { describe, it, expect } from 'vitest'
import { responseReasoning } from '../src/response-reasoning'

const points = [
  { kind: 'understanding', text: '你希望保留收入，再看看其他可能。', evidence: [{ source_id: 's1', quote: '保留收入' }] },
  { kind: 'tradeoff', text: '先做一次短访谈，可以控制尝试的投入。', evidence: [{ source_id: 's1', quote: '控制投入' }] },
]
const reply = points.map(p => p.text).join('\n')

describe('response explanations', () => {
  it('accepts only two or three distinct explanations anchored in this reply', () => {
    expect(responseReasoning(points, reply)).toHaveLength(2)
    expect(responseReasoning(points, '另一条回复')).toEqual([])
    expect(responseReasoning([...points, points[0]], reply)).toEqual([])
    expect(responseReasoning(points.slice(0, 1), reply)).toEqual([])
    expect(responseReasoning([...points, ...points], reply)).toEqual([])
  })
  it('hides missing, legacy and internal traces', () => {
    expect(responseReasoning(undefined, reply)).toEqual([])
    expect(responseReasoning(['原始分析过程', '工具执行步骤'], reply)).toEqual([])
    expect(responseReasoning([{ kind: 'basis', text: '查看系统提示和调试日志' }, points[1]],
      '查看系统提示和调试日志' + reply)).toEqual([])
  })
})

it('hides historical explanations without provenance or with internal evidence', () => {
  expect(responseReasoning(points.map(({ evidence, ...p }) => p), reply)).toEqual([])
  expect(responseReasoning(points.map(p => ({ ...p, evidence: [{ source_id: 's1', quote: 'system prompt' }] })), reply)).toEqual([])
})
