// Only verified cloud-backed JPEG copies leave the build; source assets remain.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function prune(output,storage,plan){
 if(!storage.enabled||!storage.verifiedAt)return {removed:0,bytes:0};
 if(plan.state!=='verified'||plan.verifiedAt!==storage.verifiedAt||plan.publicBaseUrl!==storage.publicBaseUrl)throw Error('Cloud verification does not match the active build');
 const pending=[];
 for(const [local,key]of Object.entries(storage.objects)){
  if(!/^\/static\/(?:visuals\/(?:choices|connection|direction|growth|reflection|rest|transition)|bloom)\/[a-z0-9_-]+\.jpg$/.test(local))throw Error('Unsafe cloud build path');
  const entry=plan.objects.find(item=>item.localPath===local&&item.key===key);
  if(!entry||entry.url!==storage.publicBaseUrl+key||!/^[a-f0-9]{64}$/.test(entry.sha256))throw Error('Missing verified object');
  const target=path.join(output,local.slice(1));
  if(!fs.existsSync(target))continue; // Idempotent after a verified prune.
  const data=fs.readFileSync(target);
  if(fs.lstatSync(target).isSymbolicLink()||data.length!==entry.bytes||crypto.createHash('sha256').update(data).digest('hex')!==entry.sha256)throw Error('Build image differs from verified upload: '+local);
  pending.push({target,bytes:data.length});
 }
 for(const entry of pending)fs.unlinkSync(entry.target);
 return {removed:pending.length,bytes:pending.reduce((n,e)=>n+e.bytes,0)};
}
module.exports={prune};
if(require.main===module){
 const root=path.resolve(__dirname,'..'),output=path.join(root,'apps/miniprogram/dist/build/mp-weixin');
 const storage=JSON.parse(fs.readFileSync(path.join(root,'apps/miniprogram/src/visual-storage.json'),'utf8'));
 const plan=JSON.parse(fs.readFileSync(path.join(root,'assets/visual-library/storage-upload-plan.json'),'utf8'));
 console.log('Verified cloud copies excluded from package: '+JSON.stringify(prune(output,storage,plan)));
}
