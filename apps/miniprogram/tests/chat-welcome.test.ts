import {expect,it} from 'vitest'
import {welcomeMessage} from '../src/chat-welcome'
import {replyText} from '../src/reply-format'
import {speechKey} from '../src/speech'

it('uses one complete welcome sentence and only refers to earlier clues when provided',()=>{
 const withContext=welcomeMessage(true),direct=welcomeMessage(false)
 expect(replyText(withContext.content)).toBe('嗨，我是 Bloom，很高兴认识你，我们可以从你刚才留下的想法慢慢聊起，还没想清楚也没关系，想到哪里就先说到哪里，也许聊着聊着，就会发现一件你愿意试试的小事。')
 expect(direct.content).not.toContain('刚才')
 expect(withContext.content).not.toContain('\n')
 expect(speechKey(withContext)).toBe('welcome:first-context-v1')
 expect(withContext.id).toBeUndefined()
})
