import { describe, expect, it } from 'vitest'
import { chatEntryFor, draftChangeFor } from '../src/chat-entry'

describe('chat entry: response preferences have distinct starters', () => {
  it('visibly continues a non-career branch and keeps the full path in the editable starter', () => {
    const guide = chatEntryFor('listen', { exploration_intent: 'relationships', follow_ups: {
      relationships: { selections: ['自己的想法和家人的期待不同'], note: '', refinements: { '自己的想法和家人的期待不同': ['知道自己想要什么，但难以表达'] } },
    } })
    expect(guide.introduction).toContain('家人的期待不同')
    expect(guide.starters[0]).toContain('知道自己想要什么，但难以表达')
    expect(guide.starters[0]).toContain('先听我说说')
    expect(guide.starters[0]).toContain('刚才的线索')
  })
  it('offers listening prompts when the user wants to talk', () => {
    const guide = chatEntryFor('listen')
    expect(guide.heading).toContain('说')
    expect(guide.starters).toHaveLength(3)
    expect(guide.starters.join('|')).not.toContain('比较我正在考虑')
  })

  it('offers comparison with no fabricated choices', () => {
    const noCandidates = chatEntryFor('compare')
    expect(noCandidates.starters[0]).toContain('还没有候选方向')
    const withCandidates = chatEntryFor('compare', { card: { options: ['继续开发', '产品方向'] } })
    expect(withCandidates.starters[0]).toContain('比较')
    expect(withCandidates.introduction).toContain('留下了一些选择')
  })

  it('grounds discovery in known clues, but avoids restating private text', () => {
    const clue = '喜欢解释复杂问题'
    const withClue = chatEntryFor('discover', { focus_response: clue })
    const without = chatEntryFor('discover')
    expect(withClue.starters[0]).toContain('刚才留下的线索')
    expect(withClue.starters.join('|')).not.toContain(clue)
    expect(without.starters[0]).toContain('真实经历')
  })

  it('offers a small experiment, not a decisive life change', () => {
    expect(chatEntryFor('experiment').starters[0]).toContain('不想冒太大风险')
    expect(new Set(
      ['listen', 'discover', 'compare', 'experiment'].map(mode =>
        chatEntryFor(mode as 'listen'|'discover'|'compare'|'experiment').starters[0]
      )
    ).size).toBe(4)
  })
})

describe('chat starter draft protection', () => {
  it('only fills a blank draft without confirmation', () => {
    expect(draftChangeFor('  ', '我想聊聊')).toBe('fill')
    expect(draftChangeFor('已写内容', '新建议')).toBe('confirm-replace')
    expect(draftChangeFor('  我想聊聊 ', '我想聊聊')).toBe('unchanged')
  })
})
