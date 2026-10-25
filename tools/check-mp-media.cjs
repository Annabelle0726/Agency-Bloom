const fs = require('node:fs');
const path = require('node:path');
// WeChat DevTools IMAGE_AND_AUDIO_LIMIT sums the entire compiled package.
// Its installed rule uses this extension list and a strict total / 1024 < 200.
const extensions = new Set('.jpg .jpeg .png .svg .webp .gif .flac .m4a .ogg .ape .amr .wma .wav .mp3 .mp4 .aac .aiff .caf'.split(' '));
function inspectMedia(directory) {
 const files=[];
 function walk(dir){ for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);
  if(entry.isSymbolicLink())throw Error('Unexpected package symlink: '+file);
  if(entry.isDirectory())walk(file);
  else if(extensions.has(path.extname(file).toLowerCase()))files.push({path:path.relative(directory,file).split(path.sep).join('/'),bytes:fs.statSync(file).size});
 }}
 walk(directory);
 const bytes=files.reduce((sum,item)=>sum+item.bytes,0);
 return {files:files.length,bytes,limitBytes:200*1024,passed:bytes<200*1024};
}
function assertMediaBudget(directory){const report=inspectMedia(directory);if(!report.passed)throw Error('Packaged image/audio total '+report.bytes+' bytes must be below '+report.limitBytes+' bytes');return report;}
module.exports={inspectMedia,assertMediaBudget};
if(require.main===module){try{const mode=process.argv[2]||'build';if(!['dev','build'].includes(mode))throw Error('Use dev or build');console.log(JSON.stringify(assertMediaBudget(path.resolve(__dirname,'../apps/miniprogram/dist',mode,'mp-weixin'))));}catch(error){console.error(error.message);process.exitCode=1;}}
