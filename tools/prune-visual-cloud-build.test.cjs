const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{createHash}=require('node:crypto');
const {prune}=require('./prune-visual-cloud-build.cjs');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bloom-cloud-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const local='/static/visuals/growth/growth_test_01.jpg',key='growth/growth_test_01.jpg',data=Buffer.from('exact reviewed bytes'),file=path.join(root,local);
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);
 const storage={enabled:true,verifiedAt:'reviewed',publicBaseUrl:'https://example.test/',objects:{[local]:key}};
 const plan={state:'verified',verifiedAt:'reviewed',publicBaseUrl:storage.publicBaseUrl,objects:[{localPath:local,key,url:storage.publicBaseUrl+key,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')}]};
 return {root,file,storage,plan,data};
}
test('removes exactly verified build copies and keeps unrelated assets',t=>{
 const f=fixture(t),other=path.join(f.root,'static/keep.jpg');fs.writeFileSync(other,'keep');
 assert.deepEqual(prune(f.root,f.storage,f.plan),{removed:1,bytes:f.data.length});assert.ok(fs.existsSync(other));
 assert.deepEqual(prune(f.root,f.storage,f.plan),{removed:0,bytes:0});
});
test('disabled cloud config preserves local fallback',t=>{
 const f=fixture(t);f.storage.enabled=false;assert.equal(prune(f.root,f.storage,f.plan).removed,0);assert.ok(fs.existsSync(f.file));
});
test('stale verification and changed image bytes abort without deleting',t=>{
 const f=fixture(t);f.plan.verifiedAt='old';assert.throws(()=>prune(f.root,f.storage,f.plan));assert.ok(fs.existsSync(f.file));
 f.plan.verifiedAt='reviewed';fs.appendFileSync(f.file,'changed');assert.throws(()=>prune(f.root,f.storage,f.plan));assert.ok(fs.existsSync(f.file));
});
test('unsafe traversal cannot remove outside the artifact',t=>{
 const f=fixture(t);f.storage.objects={'/static/../../keep.jpg':'growth/test.jpg'};assert.throws(()=>prune(f.root,f.storage,f.plan));assert.ok(fs.existsSync(f.file));
});
