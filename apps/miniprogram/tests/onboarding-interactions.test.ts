import { afterEach, expect, it, vi } from 'vitest'
import { createRenderer, h, nextTick } from 'vue'
import OnboardingFlow from '../src/components/OnboardingFlow.vue'
import { newOnboarding, saveDraft, toggleFollowUp, toggleRefinement, updateConcerns } from '../src/onboarding'

interface Node { type: string; props: Record<string, any>; children: Node[]; parent?: Node; text?: string; [key: string]: any }
const node = (type: string): Node => ({ type, tagName: type.toUpperCase(), props: {}, children: [], style: {}, addEventListener() {}, setAttribute() {}, removeAttribute() {} })
const renderer = createRenderer<Node, Node>({
  createElement: node, createText: text => ({ ...node('#text'), text }), createComment: node,
  setText: (el, text) => { el.text = text }, setElementText: (el, text) => { el.text = text },
  parentNode: el => el.parent,
  nextSibling: el => el.parent ? el.parent.children[el.parent.children.indexOf(el) + 1] || null : null,
  patchProp: (el, key, _old, value) => { el.props[key] = value },
  insert(el, parent, anchor) {
    if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1)
    const at = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(at < 0 ? parent.children.length : at, 0, el); el.parent = parent
  },
  remove(el) { if (el.parent) { el.parent.children.splice(el.parent.children.indexOf(el), 1); el.parent = undefined } },
})
const find = (root: Node, name: string): Node[] => [...(String(root.props.class || '').split(' ').includes(name) ? [root] : []), ...root.children.flatMap(child => find(child, name))]
const text = (el: Node): string => (el.text || '') + el.children.map(text).join('')
let dispose = () => {}
afterEach(() => { dispose(); vi.useRealTimers(); vi.unstubAllGlobals() })

function mount(resume?: ReturnType<typeof saveDraft>) {
  vi.useFakeTimers()
  const stored = new Map<string, unknown>(), progress = vi.fn(), save = vi.fn(), chat = vi.fn(), skip = vi.fn()
  vi.stubGlobal('document', { activeElement: null })
  vi.stubGlobal('uni', { getStorageSync: (key: string) => stored.get(key), setStorageSync: (key: string, value: unknown) => stored.set(key, value), removeStorageSync: (key: string) => stored.delete(key) })
  const root = node('root'), app = renderer.createApp(() => h(OnboardingFlow, { busy: false, error: '', userId: 'isolated-ui-test', resume, onProgress: progress, onSave: save, onChat: chat, onSkip: skip }))
  app.component('scroll-view', { render() { return h('scroll-view', this.$attrs, this.$slots.default?.()) } })
  app.mount(root); dispose = () => app.unmount()
  return { root, progress, save, chat, skip }
}

it('requires a Q1 topic but lets an explicit unsure choice finish without optional answers', async () => {
  const { root, save, chat } = mount()
  expect(find(root, 'action-button')[0].props.disabled).toBe(true)
  find(root, 'action-button')[0].props.onClick(); await nextTick()
  expect(find(root, 'flow-step-0')).toHaveLength(1)
  find(root, 'selection-card').find(el => text(el).includes('暂时说不清'))!.props.onClick()
  await nextTick()
  expect(find(root, 'action-button')[0].props.disabled).toBe(false)
  for (const step of [1, 2, 3, 4]) {
    find(root, 'action-button')[0].props.onClick(); await nextTick()
    expect(find(root, 'flow-step-' + step)).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(181)
  }
  find(root, 'action-button')[0].props.onClick(); await nextTick()
  expect(save).toHaveBeenCalledOnce()
  expect(save.mock.lastCall![0]).toMatchObject({ concerns: ['unsure'], support_style: '', background: '', constraints: [], follow_ups: {} })
  expect(chat).not.toHaveBeenCalled()
})

it('returns incomplete older drafts to Q1 while retaining all supplied text', async () => {
  const form = { ...newOnboarding(), actual_question: '我之前写下的问题', background: '仍在工作的情况' }
  const { root, progress } = mount(saveDraft(form, 4))
  expect(find(root, 'flow-step-0')).toHaveLength(1)
  find(root, 'selection-card').find(el => text(el).includes('暂时说不清'))!.props.onClick()
  await nextTick()
  expect(progress.mock.lastCall![0].form).toMatchObject({ actual_question: form.actual_question, background: form.background })
})

it('allows pausing an unanswered questionnaire without submitting or completing it', async () => {
  const { root, skip, save, chat } = mount()
  expect(text(find(root, 'flow-skip')[0])).toBe('稍后再填')
  find(root, 'flow-skip')[0].props.onClick(); await nextTick()
  expect(skip).toHaveBeenCalledOnce()
  expect(save).not.toHaveBeenCalled()
  expect(chat).not.toHaveBeenCalled()
})

it('blocks advancement again after the last topic is removed from review', async () => {
  const form = newOnboarding(); updateConcerns(form, 'relationships')
  const { root } = mount(saveDraft(form, 4))
  find(root, 'record-edit')[0].props.onClick(); await nextTick()
  expect(find(root, 'flow-step-0')).toHaveLength(1)
  find(root, 'selection-card').find(el => text(el).includes('关系和期待'))!.props.onClick()
  await nextTick()
  expect(find(root, 'action-button')[0].props.disabled).toBe(true)
  await vi.advanceTimersByTimeAsync(181)
  find(root, 'action-button')[0].props.onClick(); await nextTick()
  expect(find(root, 'flow-step-0')).toHaveLength(1)
})

it('accepts the first answer while the Continue double-tap lock is still active', async () => {
  const { root } = mount()
  find(root, 'selection-card').find(el => text(el).includes('关系和期待'))!.props.onClick()
  await nextTick()
  find(root, 'action-button')[0].props.onClick()
  await nextTick()
  expect(find(root, 'flow-step-1')).toHaveLength(1)
  expect(find(root, 'is-locked')).toHaveLength(1)
  const answer = find(root, 'selection-card').find(el => text(el).includes('自己的想法和家人的期待不同'))!
  answer.props.onClick(); await nextTick()
  expect(answer.props['aria-pressed']).toBe(true)
})

it('reviews existing resources neutrally and edits the corresponding refinement', async () => {
  const form = newOnboarding()
  updateConcerns(form, 'direction'); toggleFollowUp(form, '想理清目前有哪些方向')
  toggleRefinement(form, 'direction', '想理清目前有哪些方向', '已有经验和技能')
  const { root } = mount(saveDraft(form, 4))
  const review = text(find(root, 'reflection-summary')[0])
  expect(review).toContain('已有经验和技能')
  expect(review).toContain('想再展开的部分')
  expect(review).not.toContain('其中最难的是')
  find(root, 'edit-refinement')[0].props.onClick(); await nextTick()
  expect(find(root, 'flow-step-2')).toHaveLength(1)
  expect(text(find(root, 'selection-card').find(el => el.props['aria-pressed'])!)).toContain('已有经验和技能')
})

it('retains context and constraints when their optional section is closed', async () => {
  const form = newOnboarding()
  updateConcerns(form, 'relationships'); toggleFollowUp(form, '自己的想法和家人的期待不同')
  const { root, progress } = mount(saveDraft(form, 2))
  const toggle = find(root, 'context-toggle')[0]
  expect(toggle.props['aria-expanded']).toBe(false)
  toggle.props.onClick(); await nextTick()
  find(root, 'life-tag').find(el => el.props['data-context'] === 'working')!.props.onClick()
  find(root, 'mainline-choice').find(el => text(el) === '能投入的时间有限')!.props.onClick()
  await nextTick(); toggle.props.onClick(); await nextTick()
  expect(toggle.props['aria-expanded']).toBe(false)
  expect(text(find(root, 'context-summary')[0])).toContain('在职工作')
  expect(progress.mock.lastCall![0].form.life_contexts).toEqual(['working'])
  expect(progress.mock.lastCall![0].form.constraints).toEqual(['能投入的时间有限'])
})
