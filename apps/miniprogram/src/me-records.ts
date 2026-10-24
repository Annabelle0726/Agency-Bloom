import { onScopeDispose, ref, watch } from 'vue'
import type { InitialSnapshot, Memory } from './domain'
import { concerns, stages } from './domain'
import { concernOptions, lifeContexts, startingConcernOptions, supportStyles } from './onboarding'

export type MeRequest = <T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, data?: unknown) => Promise<T>
export function phaseRecords(memories: Memory[], issueId: string) {
  return memories.filter(m => m.horizon === 'current_phase' && m.status !== 'historical' && (!m.issue_id || m.issue_id === issueId))
}
export function snapshotRows(item: InitialSnapshot) {
  const topic = (id: string) => startingConcernOptions.find(c => c.id === id)?.title || concernOptions.find(c => c.id === id)?.title || concerns.find(c => c.id === id)?.title || id
  const rows = [
    { label: '当时关注的事', value: item.concerns.map(topic).join('、') || '未选择' },
    { label: '当时想聊的问题', value: item.answers.question || item.direction || '未填写' },
  ]
  for (const [key, answer] of Object.entries(item.answers.follow_ups || {})) {
    rows.push({ label: topic(key), value: [...answer.selections, answer.note].filter(Boolean).join('\n') || '未填写' })
    for (const parent of answer.selections) {
      const values = answer.refinements?.[parent]
      if (values?.length) rows.push({ label: parent, value: values.join('\n') })
    }
  }
  if (item.answers.response) rows.push({ label: '当时的补充', value: item.answers.response })
  rows.push(
    { label: '经历与背景', value: item.background || '未填写' },
    { label: '当时的生活状态', value: item.life_contexts.map(id => lifeContexts.find(c => c.id === id)?.title || id).join('、') || '未选择' },
    { label: '当时的阶段', value: item.stage === 'unsure' ? '尚未确定' : stages.find(s => s.id === item.stage)?.label || '未记录' },
    { label: '当时的现实条件', value: item.constraints.join('\n') || '未填写' },
    { label: '当时的回应偏好', value: supportStyles.find(s => s.id === (item.answers as { support_style?: string }).support_style)?.title || '未记录' },
  )
  return rows
}

/** Read existing owned records only. Never infer current intent or issue model calls. */
export function useMeRecords(userId: () => string, issueId: () => string, revision: () => unknown, request: MeRequest) {
  const memories = ref<Memory[]>([]), snapshot = ref<InitialSnapshot | null>(null)
  const loading = ref(false), memoryError = ref(''), snapshotError = ref('')
  let generation = 0
  async function reload() {
    const attempt = ++generation, owner = userId(), issue = issueId()
    memories.value = []; snapshot.value = null; memoryError.value = ''; snapshotError.value = ''
    if (!owner) { loading.value = false; return }
    loading.value = true
    const current = () => attempt === generation && owner === userId() && issue === issueId()
    await Promise.all([
      request<Memory[]>('GET', '/memories').then(value => { if (current()) memories.value = value }, error => { if (current()) memoryError.value = error instanceof Error ? error.message : '暂时无法读取记录' }),
      issue ? request<InitialSnapshot | null>('GET', `/issues/${encodeURIComponent(issue)}/snapshot`).then(value => { if (current()) snapshot.value = value }, error => { if (current()) snapshotError.value = error instanceof Error ? error.message : '暂时无法读取初始回答' }) : Promise.resolve(),
    ])
    if (current()) loading.value = false
  }
  watch(() => [userId(), issueId(), revision()], reload, { immediate: true, flush: 'sync' })
  onScopeDispose(() => { generation++ })
  return { memories, snapshot, loading, memoryError, snapshotError, reload }
}
