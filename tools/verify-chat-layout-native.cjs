// Open an empty chat before running. Tests real native geometry without sending messages.
// Temporarily constrains chat width, restores it afterwards; does not change the simulator device.
const auto = require('../output/native-sdk/node_modules/miniprogram-automator');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const out = path.resolve(process.env.AGENCY_QA_OUTPUT || 'output/chat-layout');
(async () => {
 await fs.mkdir(out, { recursive: true });
 const mp = await auto.connect({wsEndpoint:'ws://127.0.0.1:9430'});
 let node, old='';
 try {
  const page = await mp.currentPage();
  if(await page.$('.chat-mode-panel')) await (await page.$('.chat-mode-trigger')).tap();
  await mp.CDP().enable();
  const dom=(method,params)=>mp.CDP().sendCommand('DOM',method,params);
  const tree=await dom('getDocument',{depth:-1});
  function find(n){const a=n.attributes||[]; if(a.includes('class') && a[a.indexOf('class')+1].split(' ').includes('chat-content'))return n;for(const x of [...n.children||[],...n.shadowRoots||[]]){const r=find(x);if(r)return r;}}
  node=find(tree.root);assert(node,'Chat must be open');
  const a=node.attributes;old=a.includes('style')?a[a.indexOf('style')+1]:'';
  async function box(sel){const e=await page.$(sel);assert(e,sel);return {...await e.offset(),...await e.size()};}
  const results=[];
  for(const width of [320,375,430]){
   await dom('setAttributeValue',{nodeId:node.nodeId,name:'style',value:old+';width:'+width+'px;max-width:100%;'});
   const label=await box('.chat-preference-label'),button=await box('.chat-mode-trigger'),title=await box('.chat-mode-trigger text'),arrow=await box('.chat-mode-chevron');
   assert(Math.abs(label.top+label.height/2-button.top-button.height/2)<2,'Preference stays in one row');
   assert(title.left+title.width+7<=arrow.left,'Text keeps clear of the arrow');
   assert(arrow.left+arrow.width<=button.left+button.width,'Arrow stays inside button');
   assert(Math.abs(arrow.top+arrow.height/2-title.top-title.height/2)<1,'Arrow stays vertically centered beside the mode text');
   const avatar=await box('.chat-welcome-avatar'),copy=await box('.chat-welcome-intro .body-copy');
   assert(avatar.left+avatar.width<=copy.left,'Welcome avatar and copy are side by side');
   assert(Math.abs(avatar.top+avatar.height/2-copy.top-copy.height/2)<2,'Welcome avatar is centered');
   results.push({width,label,button,title,arrow,avatar,copy});
   await mp.screenshot({path:path.join(out,'chat-native-'+width+'.png')});
  }
  await fs.writeFile(path.join(out,'native-layout-report.json'),JSON.stringify({device:await mp.systemInfo(),note:'Real WeChat renderer; constrained chat container widths, not a changed device viewport',results},null,2));
  console.log(JSON.stringify(results));
 }finally{if(node)await mp.CDP().sendCommand('DOM','setAttributeValue',{nodeId:node.nodeId,name:'style',value:old});await mp.disconnect();}
})().catch(e=>{console.error(e);process.exitCode=1});
