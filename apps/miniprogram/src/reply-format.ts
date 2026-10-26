export interface ReplyRun { text: string; bold?: boolean; italic?: boolean; highlight?: boolean; code?: boolean }
export interface ReplyBlock { kind: 'paragraph'|'heading'|'list'|'quote'|'code'; runs: ReplyRun[]; prefix?: string; level?: number }

function inline(text:string, style:Omit<ReplyRun,'text'>={}, depth=0):ReplyRun[] {
  const out:ReplyRun[]=[]
  const add=(value:string,extra=style)=>{if(value)out.push({text:value,...extra})}
  for(let i=0;i<text.length;) {
    if(text[i]==='\\'&&i+1<text.length){add(text[i+1]);i+=2;continue}
    if(text[i]==='`') {const end=text.indexOf('`',i+1);if(end>i+1){add(text.slice(i+1,end),{...style,code:true});i=end+1;continue}}
    const link=/^!?\[([^\]\n]+)\]\([^\n)]*\)/.exec(text.slice(i))
    if(link){out.push(...inline(link[1],style,depth+1));i+=link[0].length;continue}
    const marker=['**','__','==','*','_'].find(m=>text.startsWith(m,i)&&text.indexOf(m,i+m.length)>i+m.length)
    if(marker&&depth<8){const end=text.indexOf(marker,i+marker.length),extra={...style,...(marker.length===2&&marker!=='=='?{bold:true}:marker==='=='?{highlight:true}:{italic:true})};out.push(...inline(text.slice(i+marker.length,end),extra,depth+1));i=end+marker.length;continue}
    add(text[i]);i++
  }
  return out.reduce<ReplyRun[]>((result,run)=>{const last=result[result.length-1];if(last&&last.bold===run.bold&&last.italic===run.italic&&last.highlight===run.highlight&&last.code===run.code)last.text+=run.text;else result.push({...run});return result},[])
}
export function formatReply(content:string):ReplyBlock[] {
  const blocks:ReplyBlock[]=[],lines=content.replace(/\r\n?/g,'\n').split('\n')
  for(let i=0;i<lines.length;i++) {
    const line=lines[i]
    if(!line.trim())continue
    if(/^\s*```/.test(line)){const code:string[]=[];while(++i<lines.length&&!/^\s*```/.test(lines[i]))code.push(lines[i]);blocks.push({kind:'code',runs:[{text:code.join('\n'),code:true}]});continue}
    const heading=/^ {0,3}(#{1,6})\s+(.+)$/.exec(line),list=/^\s*(?:([-+*])\s+|(\d+)[.)]\s+)(.*)$/.exec(line),quote=/^\s*>\s?(.*)$/.exec(line)
    if(heading){blocks.push({kind:'heading',level:heading[1].length,runs:inline(heading[2])});continue}
    if(list){blocks.push({kind:'list',prefix:list[2]?list[2]+'. ':'• ',runs:inline(list[3])});continue}
    if(quote){blocks.push({kind:'quote',runs:inline(quote[1])});continue}
    const last=blocks[blocks.length-1]
    if(last?.kind==='paragraph'&&i>0&&lines[i-1].trim())last.runs.push({text:'\n'},...inline(line))
    else blocks.push({kind:'paragraph',runs:inline(line)})
  }
  return blocks
}
export function replyText(content:string) {
  return formatReply(content).map((b,i,blocks)=>(i?(b.kind==='list'&&blocks[i-1].kind==='list'?'\n':'\n\n'):'')+(b.prefix||'')+b.runs.map(r=>r.text).join('')).join('')
}
