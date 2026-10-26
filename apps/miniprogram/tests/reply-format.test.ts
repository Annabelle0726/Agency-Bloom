import {expect,it} from 'vitest'
import {formatReply, replyText} from '../src/reply-format'

it('formats emphasis without losing the plain text used for copy and selection',()=>{
 const source='先保留 **稳定收入**，再 ==了解真实日常==，也可以 *慢慢来*。'
 const blocks=formatReply(source)
 expect(blocks[0].runs.some(r=>r.text==='稳定收入'&&r.bold)).toBe(true)
 expect(blocks[0].runs.some(r=>r.text==='了解真实日常'&&r.highlight)).toBe(true)
 expect(replyText(source)).toBe('先保留 稳定收入，再 了解真实日常，也可以 慢慢来。')
})
it('supports headings, lists, quotes and literal code without executing markup or loading images',()=>{
 const source='## 两种选择\n\n- **先了解**\n- 暂不决定\n\n> 都可以调整\n\n```js\n**保留原样**\n```\n\n[参考](https://example.com) <script>bad()</script> ![图片](https://example.com/a.png)'
 const blocks=formatReply(source)
 expect(blocks.map(b=>b.kind)).toContain('heading')
 expect(blocks.filter(b=>b.kind==='list')).toHaveLength(2)
 expect(blocks.find(b=>b.kind==='code')?.runs[0].text).toBe('**保留原样**')
 expect(replyText(source)).toContain('参考 <script>bad()</script> 图片')
 expect(JSON.stringify(blocks)).not.toContain('https://example.com/a.png')
})
it('keeps streaming or unmatched markers readable and handles escaped markers',()=>{
 expect(replyText('尚未闭合 **重要')).toBe('尚未闭合 **重要')
 expect(replyText('\\*原样\\* 与 `**代码**`')).toBe('*原样* 与 **代码**')
 expect(formatReply('**外层 ==重点==**')[0].runs.some(r=>r.text==='重点'&&r.bold&&r.highlight)).toBe(true)
})
