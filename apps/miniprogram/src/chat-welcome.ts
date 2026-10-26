import type {ChatMessage} from './domain'
export function welcomeMessage(hasContext:boolean):ChatMessage {
  return {role:'assistant',content:'**嗨，我是 Bloom**，很高兴认识你，'+(hasContext?'我们可以从你刚才留下的想法慢慢聊起，':'')+'还没想清楚也没关系，想到哪里就先说到哪里，也许聊着聊着，就会发现一件你愿意试试的小事。',
    welcomeVariant:hasContext?'first-context-v1':'first-open-v1'}
}
