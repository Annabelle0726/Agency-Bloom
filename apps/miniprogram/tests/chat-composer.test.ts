import { afterEach, expect, it, vi } from 'vitest'
import { createRenderer, h, nextTick, reactive } from 'vue'
import ChatComposer from '../src/pages/index/chat/ChatComposer.vue'

// Render the real Vue component without a DOM. Native geometry stays at the
// uni boundary; input visibility, event handlers and state updates are real.
interface Node { type: string; props: Record<string, any>; children: Node[]; parent?: Node; text?: string; [key: string]: any }
function node(type: string): Node { return { type, tagName: type.toUpperCase(), props: {}, children: [], addEventListener() {}, setAttribute() {} } }
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
function find(root: Node, type: string): Node | undefined {
  if (root.type === type) return root
  for (const child of root.children) { const found = find(child, type); if (found) return found }
}
let unmount = () => {}
afterEach(() => { unmount(); vi.unstubAllGlobals() })
function mount() {
  vi.stubGlobal('document', { activeElement: null })
  vi.stubGlobal('uni', { createSelectorQuery: () => ({ in() { return this }, select() { return this },
    boundingClientRect(callback: (rect: { height: number }) => void) { callback({ height: 146 }); return this }, exec() {} }) })
  const props = reactive({ draft: '已经发送的长消息', sending: true, sendingStartedAt: Date.now(),
    generatingSummary: false, readOnlyConversation: false, activeConversation: null, isDrafting: true,
    webSearchOn: false, chatFooterNote: '按你的节奏聊', error: '' })
  const cancel = vi.fn(), send = vi.fn(), layout = vi.fn()
  const root = node('root'), app = renderer.createApp(() => h(ChatComposer, { ...props, onCancel: cancel, onSend: send, onLayout: layout }))
  app.mount(root); unmount = () => app.unmount()
  return { root, props, cancel, send, layout }
}

it('keeps a stable input and stop button while a reply is pending without duplicating the sent text', async () => {
  const { root, props, cancel, send } = mount()
  await nextTick()
  const input = find(root, 'textarea')
  expect(input, 'the composer must stay present while waiting').toBeDefined()
  expect(input!.props.value).toBe('')
  expect(input!.props.disabled).toBe(true)
  const stop = (function findButton(el: Node): Node | undefined {
    if (el.type === 'button' && el.props['aria-label'] === '停止回复') return el
    for (const c of el.children) { const found = findButton(c); if (found) return found }
  })(root)!
  stop.props.onClick(); expect(cancel).toHaveBeenCalledOnce(); expect(send).not.toHaveBeenCalled()
  props.sending = false; props.sendingStartedAt = 0; props.error = '回复未完成'
  await nextTick()
  expect(find(root, 'textarea')).toBe(input)
  expect(input!.props.value).toBe('已经发送的长消息')
  expect(input!.props.disabled).toBe(false)
})

it('reports the actual dock height so the last reply can stay above the composer', async () => {
  const { layout } = mount()
  await nextTick()
  expect(layout).toHaveBeenCalledWith(146)
})
