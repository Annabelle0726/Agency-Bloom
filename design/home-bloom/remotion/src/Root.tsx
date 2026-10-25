import {AbsoluteFill, Composition, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {CSSProperties} from 'react';

const imageStyle: CSSProperties={position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'contain'};
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;

/** One short puppet gesture. The right paw stays on the card throughout. */
export const BloomHello=()=>{
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  return <AbsoluteFill style={{backgroundColor:'transparent'}}>
    <Img src={staticFile('bloom.png')} style={{...imageStyle,clipPath:'polygon(0 75%,100% 75%,100% 100%,34% 100%,34% 77%,0 77%)'}} />
    <div data-layer="head-nod" style={{position:'absolute',inset:0,transformOrigin:'50% 78%',
      rotate:interpolate(frame,[0,.13*fps,.33*fps,.55*fps,.8*fps,35/30*fps],['0deg','0deg','2.6deg','0deg','1deg','0deg'],{...clamp,easing:Easing.bezier(.22,.7,.3,1)})}}>
      <Img src={staticFile('bloom.png')} style={{...imageStyle,clipPath:'polygon(0 0,100% 0,100% 78%,0 78%)'}} />
    </div>
    <div data-layer="left-hand-wave" style={{position:'absolute',inset:0,transformOrigin:'31% 87%',
      rotate:interpolate(frame,[0,.1*fps,.28*fps,.43*fps,.58*fps,.73*fps,.96*fps,35/30*fps],['0deg','0deg','28deg','14deg','30deg','16deg','0deg','0deg'],{...clamp,easing:Easing.bezier(.22,.7,.3,1)})}}>
      <Img src={staticFile('bloom.png')} style={{...imageStyle,clipPath:'polygon(0 77%,34% 77%,34% 100%,0 100%)'}} />
    </div>
  </AbsoluteFill>;
};

const GreetingPreview=()=>{
  const frame=useCurrentFrame();const {fps}=useVideoConfig();
  return <AbsoluteFill style={{backgroundColor:'#f2f2e9',fontFamily:'Microsoft YaHei,sans-serif',color:'#354d3d'}}>
    <div style={{position:'absolute',left:24,right:24,top:172,height:156,borderRadius:8,background:'linear-gradient(150deg,#fffef9,#e8eee3)',boxShadow:'inset 0 1px 0 #fff,0 12px 30px #374e3c12',border:'1px solid #fff'}}>
      <div style={{fontFamily:'Georgia,Microsoft YaHei,serif',fontSize:20,margin:'24px 22px 12px'}}>接着聊聊近况</div>
      <div style={{fontSize:13,margin:'0 22px',color:'#687b6b'}}>从上一次留下的话题，或一点新的发现聊起</div>
    </div>
    <div style={{position:'absolute',right:24,top:98,width:76,height:82}}><BloomHello/></div>
    <div data-layer="invitation-after-greeting" style={{position:'absolute',right:108,top:124,fontSize:11.5,padding:'6px 10px',borderRadius:8,background:'#fffef9',boxShadow:'0 4px 12px #30463612',
      opacity:interpolate(frame,[1.2*fps,1.4*fps],[0,1],clamp),
      translate:interpolate(frame,[1.2*fps,1.4*fps],['0 3px','0 0'],clamp)}}>想接着聊，还是有新情况？</div>
  </AbsoluteFill>;
};

export const RemotionRoot=()=> <>
  <Composition id="BloomHello" component={BloomHello} width={152} height={164} fps={30} durationInFrames={36}/>
  <Composition id="BloomGreetingPreview" component={GreetingPreview} width={390} height={390} fps={30} durationInFrames={54}/>
</>;
