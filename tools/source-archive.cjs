// Full-resolution source archive, separate from runtime JPEG delivery.
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const root=path.resolve(__dirname,'..'),file=path.join(root,'assets/visual-library/source-archive.json');
function load(){return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{objects:[]};}
function recordFor(localPath){return load().objects.find(o=>o.localPath===localPath&&o.verifiedAt);}
async function fetchVerified(item,fetcher=fetch){
 const prefix='https://ycombbpglsmbvjlrjtgc.supabase.co/storage/v1/object/public/';
 if(!item.url.startsWith(prefix)||/[{}]|%7[bd]/i.test(item.url)||!/^https:/.test(item.url)||!/^[a-f0-9]{64}$/.test(item.sha256)||!Number.isInteger(item.bytes)||item.bytes<=0)throw Error('Invalid archived source');
 const response=await fetcher(item.url,{redirect:'error',signal:AbortSignal.timeout(90000)});
 if(response.status!==200)throw Error('Source HTTP '+response.status+': '+item.localPath);
 const bytes=Buffer.from(await response.arrayBuffer());
 if(bytes.length!==item.bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw Error('Source content mismatch: '+item.localPath);
 return bytes;
}
function resolveSourcePath(localPath) {
 const local=path.join(root,localPath);if(fs.existsSync(local))return local;
 const item=recordFor(localPath),cached=path.join(root,'output/visual-source-cache',localPath);
 if(item&&fs.existsSync(cached)){const bytes=fs.readFileSync(cached);if(bytes.length===item.bytes&&crypto.createHash('sha256').update(bytes).digest('hex')===item.sha256)return cached;}
 throw Error('Source is archived in Supabase. Run node tools/source-archive.cjs --cache before regenerating derivatives: '+localPath);
}
module.exports={load,recordFor,fetchVerified,resolveSourcePath};
if(require.main===module)(async()=>{
 const catalog=load();if(!catalog.objects.length)throw Error('No archive catalog');
 let count=0;for(const item of catalog.objects){
  const bytes=await fetchVerified(item);
  if(process.argv.includes('--cache')){
   if(!/^(assets\/visual-library\/originals\/(choices|connection|direction|growth|reflection|rest|transition)|design\/themes\/references)\/[a-z0-9_/.-]+$/.test(item.localPath)||item.localPath.includes('..'))throw Error('Unsafe source path');
   const dest=path.join(root,'output/visual-source-cache',item.localPath);
   fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);
  }count++;
 }console.log(JSON.stringify({verified:count,cached:process.argv.includes('--cache')}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
