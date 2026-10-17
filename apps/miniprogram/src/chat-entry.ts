import type { SupportMode } from './onboarding'

export interface ChatEntryContext {
  actual_question?: string
  focus_response?: string
  background?: string
  card?: { options?: string[] }
}

export interface ChatEntry {
  heading: string
  introduction: string
  starters: readonly string[]
}

export function chatEntryFor(mode: SupportMode, context: ChatEntryContext = {}): ChatEntry {
  const hasClue = Boolean(
    context.actual_question?.trim() || context.focus_response?.trim() || context.background?.trim()
  )
  const hasChoices = (context.card?.options?.filter(value => value.trim()).length || 0) >= 2

  switch (mode) {
    case 'listen':
      return {
        heading: '想说什么，就从这里开始',
        introduction: hasClue
          ? '你之前留下的想法还在这里。不急着找答案，想从哪一部分说起都可以。'
          : '你不用把想法整理好，也不必立刻做决定。我会先听你说。',
        starters: [
          hasClue ? '我想先聊聊刚才留下的那件事' : '最近有件事一直放在心上',
          '我想说说最近的工作和感受',
          '我现在也不知道怎么表达',
        ],
      }
    case 'compare':
      return {
        heading: '把选择看清楚',
        introduction: hasChoices
          ? '你已经留下了一些选择。可以先看看自己最在意的条件，不急着选答案。'
          : '如果已有方向，我们可以比较；如果没有，也能先找出值得考虑的选项。',
        starters: [
          hasChoices ? '帮我比较我正在考虑的几个方向' : '我还没有候选方向，先找出值得比较的选择',
          '我最担心改变方向会失去什么',
          '先帮我确认需要核实的现实条件',
        ],
      }
    case 'experiment':
      return {
        heading: '先试一点点',
        introduction: '不用一下子改变很多。先看看有没有一个可停止、代价可控的尝试。',
        starters: [
          '我想试一点，但不想冒太大风险',
          '和我一起设计一次低成本的小实验',
          '我已经试过一次，想聊聊结果',
        ],
      }
    case 'discover':
    default:
      return {
        heading: '从这里，发现新可能',
        introduction: hasClue
          ? '你刚才留下的线索还在。我们可以沿着它们寻找新的连接，不需要重复填写。'
          : '从你做过、在意过的事情里，也许能发现以前没注意到的线索。',
        starters: [
          hasClue ? '从我刚才留下的线索出发，看看新的可能' : '先从一次真实经历开始',
          '看看我的经历还能连接到什么',
          '帮我发现已有能力的新用处',
        ],
      }
  }
}

export type DraftChange = 'unchanged' | 'fill' | 'confirm-replace'
export function draftChangeFor(current: string, incoming: string): DraftChange {
  if (current.trim() === incoming.trim()) return 'unchanged'
  return current.trim() ? 'confirm-replace' : 'fill'
}
