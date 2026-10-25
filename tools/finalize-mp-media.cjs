const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {prune}=require('./prune-visual-cloud-build.cjs');
const {assertMediaBudget}=require('./check-mp-media.cjs');
const root=path.resolve(__dirname,'..');
function pruneAppMedia(output,catalog){
 const base='https://ycombbpglsmbvjlrjtgc.supabase.co/storage/v1/object/public/visual-library/';
 if(catalog.publicBaseUrl!==base||!catalog.verifiedAt)throw Error('Unverified app media catalog');
 const pending=[];
 for(const item of catalog.objects){
  if(!/^\/static\/[a-z0-9_/-]+\.(jpg|png)$/.test(item.localPath)||item.localPath.includes('..')||item.key!=='app-media/'+item.localPath.slice(8)||item.url!==base+item.key||!item.verifiedAt||!/^[a-f0-9]{64}$/.test(item.sha256))throw Error('Invalid app media receipt');
  const file=path.join(output,item.localPath.slice(1));
  if(!fs.existsSync(file))continue;
  const data=fs.readFileSync(file);
  if(fs.lstatSync(file).isSymbolicLink()||data.length!==item.bytes||crypto.createHash('sha256').update(data).digest('hex')!==item.sha256)throw Error('Package media differs from verified cloud bytes: '+item.localPath);
  pending.push(file);
 }
 for(const file of pending)fs.unlinkSync(file);
 return pending.length;
}
function finalize(output){
 const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
 const visuals=prune(output,read('apps/miniprogram/src/visual-storage.json'),read('assets/visual-library/storage-upload-plan.json'));
 const appMedia=pruneAppMedia(output,read('apps/miniprogram/src/app-media.json'));
 const budget=assertMediaBudget(output);
 console.log('Cloud media package: '+JSON.stringify({visuals,appMedia,...budget}));
 return budget;
}
module.exports={pruneAppMedia,finalize};
if(require.main===module){try{const mode=process.argv[2]||'build';if(!['dev','build'].includes(mode))throw Error('Use dev or build');finalize(path.join(root,'apps/miniprogram/dist',mode,'mp-weixin'));}catch(error){console.error(error.message);process.exitCode=1;}}
