// Local-only derivatives. Never rewrites approved source art or theme references.
const sharp=require('sharp'),fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'..'), original=path.join(root,'design/img');
const runtime=path.join(root,'apps/miniprogram/src/static/bloom');
const crops=[];
async function output(name,src,width,height,extract){
 let task=sharp(src); if(extract)task=task.extract(extract);
 await task.resize(width,height,{fit:'cover',position:name.endsWith('-scene')?'east':'centre'}).jpeg({quality:73,mozjpeg:true}).toFile(path.join(runtime,name+'.jpg'));
 crops.push({name,source:path.relative(root,src).replaceAll('\\','/'),width,height,extract:extract||null,bytes:(await fs.stat(path.join(runtime,name+'.jpg'))).size});
}
(async()=>{
 await fs.mkdir(runtime,{recursive:true});
 const user=(n)=>path.join(original,'image-gen-'+n+'.png');
 await output('mist-lake',user(1),750,940);
 await output('mist-reading',user(5),750,940);
 await output('forest-hero',user(2),750,940);
 await output('forest-reading',user(3),750,940);
 await output('forest-path',user(2),224,360);
 await output('reading-corner',user(3),224,360);
 await output('lake-reflection',user(4),224,360);
 const names={dark:'night',dawn:'dusk',lavender:'lavender',minimal:'minimal'};
 for(const [id,name] of Object.entries(names)){
  const src=path.join(original,'bloom-'+id+'.png'),m=await sharp(src).metadata();
  await output(name+'-scene',src,750,940);
  const crop=(left,top,w,h)=>({left:Math.round(m.width*left),top:Math.round(m.height*top),width:Math.floor(m.width*w),height:Math.floor(m.height*h)});
  await output(name+'-landscape',src,224,360,id==='dark'?crop(.56,.02,.42,.82):crop(0,.12,.4,.82));
  await output(name+'-reading',src,224,360,crop(.57,.23,.42,.77));
  await output(name+'-reflection',src,224,360,crop(.25,.17,.4,.8));
 }
 await fs.writeFile(path.join(original,'bloom-crops.json'),JSON.stringify(crops,null,2)+'\n');
 console.log(JSON.stringify({images:crops.length,bytes:crops.reduce((n,c)=>n+c.bytes,0),crops}));
})().catch(e=>{console.error(e);process.exitCode=1});
