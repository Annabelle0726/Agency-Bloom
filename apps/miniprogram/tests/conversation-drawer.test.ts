import { afterEach, expect, it, vi } from 'vitest'
import { createRenderer, h, nextTick, reactive } from 'vue'
import ConversationDrawer from '../src/components/ConversationDrawer.vue'
import type { Conversation } from '../src/domain'

interface Node { type: string; props: Record<string, any>; children: Node[]; parent?: Node; text?: string; [key: string]: any }
const node = (type: string): Node => ({ type, tagName: type.toUpperCase(), props: {}, children: [], addEventListener() {}, setAttribute() {} })
const renderer = createRenderer<Node, Node>({
  createElement: node, createText: text => ({ ...node('#text'), text }), createComment: node,
  setText: (el, text) => { el.text = text }, setElementText: (el, text) => { el.text = text },
  parentNode: el => el.parent, nextSibling: () => null,
  patchProp: (el, key, _old, value) => { el.props[key] = value },
  insert(el, parent, anchor) {
    if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1)
    const at = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(at < 0 ? parent.children.length : at, 0, el); el.parent = parent
  },
  remove(el) { if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1) },
})
function find(root: Node, className: string): Node[] {
  return [...(String(root.props.class || '').split(' ').includes(className) ? [root] : []), ...root.children.flatMap(child => find(child, className))]
}
const text = (el: Node): string => (el.text || '') + el.children.map(text).join('')
const conversation = (id: string, updated_at: string): Conversation => ({ id, title: id, updated_at, created_at: updated_at,
  issue_id: 'issue', support_style: 'listen', summary: null, linked_issue_ids: [], version: 3, archived_at: null })
let dispose = () => {}
afterEach(() => { dispose(); vi.unstubAllGlobals() })
function mount(fail = false) {
  vi.stubGlobal('document', { activeElement: null })
  vi.stubGlobal('uni', { createSelectorQuery: () => ({ in() { return this }, select() { return this },
    boundingClientRect(callback: Function) { callback({ height: 550 }); return this }, exec() {} }) })
  const items = [conversation('newer', '2026-10-24'), conversation('older', '2026-10-20')]
  const request = vi.fn(async (_method: string, path: string, body: any) => {
    if (fail) throw Error('置顶未保存，请重试')
    return { ...items.find(c => path.includes(c.id))!, pinned_at: body.pinned ? '2026-10-24T12:00' : null }
  })
  const props = reactive({ view: 'list' as const, conversations: items, active: items[0], issues: [], user: null,
    summary: null, summaryDraft: null, generating: false, running: [], request })
  const changed = vi.fn((value: Conversation) => { props.conversations = props.conversations.map(c => c.id === value.id ? value : c) })
  const root = node('root'), app = renderer.createApp(() => h(ConversationDrawer, { ...props, onChanged: changed }))
  app.component('scroll-view', { render() { return h('scroll-view', this.$attrs, this.$slots.default?.()) } })
  app.mount(root); dispose = () => app.unmount()
  return { root, props, request, changed }
}

it('pins the chosen conversation, reorders after acknowledgement, and supports unpinning', async () => {
  const { root, request, changed } = mount()
  const pin = find(root, 'pin-conversation')[1]
  expect(pin, 'a conversation must expose an accessible pin action').toBeDefined()
  await pin.props.onClick(); await nextTick()
  expect(request).toHaveBeenCalledWith('PUT', '/conversations/older/pin', { version: 3, pinned: true })
  expect(changed).toHaveBeenCalledOnce()
  expect(find(root, 'conversation-title').map(text)).toEqual(['older', 'newer'])
  const unpin = find(root, 'pin-conversation')[0]
  expect(unpin.props['aria-pressed']).toBe(true)
  await unpin.props.onClick(); await nextTick()
  expect(find(root, 'conversation-title').map(text)).toEqual(['newer', 'older'])
})

it('keeps the old order and shows a local error if saving the pin fails', async () => {
  const { root, changed } = mount(true)
  const pin = find(root, 'pin-conversation')[1]
  expect(pin).toBeDefined()
  await pin.props.onClick(); await nextTick()
  expect(changed).not.toHaveBeenCalled()
  expect(find(root, 'conversation-title').map(text)).toEqual(['newer', 'older'])
  expect(find(root, 'notice').map(text).join('')).toContain('置顶未保存')
  expect(find(root, 'pin-conversation')[1].props.disabled).toBe(false)
})
