import { computed, reactive, ref, type InjectionKey } from 'vue'
import type { ChatMessage } from './domain'

interface Task<T> { promise: Promise<T>; cancel: () => void }
export interface SpeechAsset { mode: string; parts: string[] }
export interface SpeechConfig { consented: boolean; mode: string; available: boolean; cache_seconds: number }
interface Audio {
  src:string; autoplay:boolean; loop:boolean; obeyMuteSwitch:boolean; playbackRate?:number;
  play:()=>void; pause:()=>void; stop:()=>void; destroy:()=>void;
  onPlay:(f:()=>void)=>void; onPause:(f:()=>void)=>void; onEnded:(f:()=>void)=>void;
  onError:(f:()=>void)=>void; onWaiting:(f:()=>void)=>void;
  onStop?:(f:()=>void)=>void;
  onCanplay?:(f:()=>void)=>void; onTimeUpdate?:(f:()=>void)=>void; readonly paused?:boolean;
}
interface Ports {
  conversation:()=>string; config:()=>Promise<SpeechConfig>; consent:(accepted:boolean)=>Promise<unknown>;
  prepare:(conversation:string,message:ChatMessage)=>Task<SpeechAsset>;
  download:(path:string)=>Task<string>; remove:(path:string)=>void; createAudio:()=>Audio;
}
export function speechKey(message:ChatMessage) { return message.id || message.payload?.speech_proof || '' }
export function createSpeech(ports:Ports) {
  const activeKey=ref(''), stage=ref<'idle'|'loading'|'playing'|'paused'>('idle'), rate=ref(1)
  const mode=ref(''), consentOpen=ref(false), consentBusy=ref(false), consentError=ref('')
  const settings=ref<SpeechConfig|null>(null), errors=reactive<Record<string,string>>({})
  const error=computed(()=>errors[ports.conversation()] || '')
  let epoch=0, pending:{message:ChatMessage;conversation:string}|null=null
  let audio:Audio|null=null, task:{cancel:()=>void}|null=null, paths:string[]=[]
  let watchdog:ReturnType<typeof setTimeout>|undefined
  const clearWatch=()=>{if(watchdog)clearTimeout(watchdog);watchdog=undefined}
  function release() {
    clearWatch(); const old=audio;audio=null
    if(old){try{old.stop()}catch{}try{old.destroy()}catch{}}
    for(const path of paths)ports.remove(path)
    paths=[]
  }
  function stop() {
    epoch++; task?.cancel(); task=null; pending=null;consentOpen.value=false
    release();activeKey.value='';stage.value='idle'
  }
  function fail(conversation:string, message:string) {
    stop();errors[conversation]=message
  }
  function arm(id:number,conversation:string) {
    clearWatch();watchdog=setTimeout(()=>{
      if(id===epoch)fail(conversation,'音频加载较久，请检查网络后再次点击朗读')
    },15000)
  }
  async function playPart(asset:SpeechAsset,index:number,id:number,conversation:string) {
    if(id!==epoch)return
    stage.value='loading'
    const download=ports.download(asset.parts[index]);task=download
    const path=await download.promise
    if(id!==epoch){ports.remove(path);return}
    paths.push(path);task=null
    const a=ports.createAudio();audio=a
    let didPlay=false
    const current=()=>id===epoch&&audio===a
    a.autoplay=false;a.loop=false;a.obeyMuteSwitch=true;a.playbackRate=rate.value
    a.onPlay(()=>{if(current()){didPlay=true;clearWatch();stage.value='playing';delete errors[conversation]}})
    a.onPause(()=>{if(current()){clearWatch();stage.value='paused'}})
    a.onWaiting(()=>{if(current()){stage.value='loading';arm(id,conversation)}})
    // Some native players resume from buffering without a second onPlay.
    const resumed=()=>{if(current()&&didPlay&&a.paused===false){clearWatch();stage.value='playing';delete errors[conversation]}}
    a.onCanplay?.(resumed);a.onTimeUpdate?.(resumed)
    a.onError(()=>{if(current())fail(conversation,'音频暂时无法播放，请检查网络和设备声音设置后重试')})
    a.onStop?.(()=>{if(current())stop()})
    a.onEnded(()=>{
      if(!current())return
      clearWatch();audio=null;a.destroy()
      if(index+1<asset.parts.length)void playPart(asset,index+1,id,conversation).catch(()=>{
        if(id===epoch)fail(conversation,'音频下载中断，请检查网络后再次点击朗读')
      })
      else stop()
    })
    a.src=path;arm(id,conversation);a.play()
  }
  async function begin(message:ChatMessage,conversation:string) {
    stop();const id=epoch;activeKey.value=speechKey(message);stage.value='loading'
    try {
      const prepared=ports.prepare(conversation,message);task=prepared
      const asset=await prepared.promise
      if(id!==epoch)return
      task=null;mode.value=asset.mode
      if(!asset.parts.length)throw Error('朗读没有返回可播放的音频')
      await playPart(asset,0,id,conversation)
    } catch(err) {
      if(id===epoch)fail(conversation,err instanceof Error?err.message:'朗读暂时无法完成，请稍后重试')
    }
  }
  async function toggle(message:ChatMessage) {
    if(message.role!=='assistant'||!speechKey(message))return
    const conversation=ports.conversation()
    if(activeKey.value===speechKey(message)) {
      if(stage.value==='playing')audio?.pause()
      else if(stage.value==='paused'){stage.value='loading';arm(epoch,conversation);audio?.play()}
      return
    }
    stop();const id=epoch
    // Pending key suppresses double taps while consent/config is being fetched.
    activeKey.value=speechKey(message);stage.value='loading'
    try {
      const config=await ports.config()
      if(id!==epoch)return
      settings.value=config;mode.value=config.mode
      if(!config.available){fail(conversation,'真实语音服务尚未开启，文字对话仍可继续');return}
      if(!config.consented){pending={message,conversation};consentOpen.value=true;stage.value='idle';return}
      await begin(message,conversation)
    } catch(err) {if(id===epoch)fail(conversation,err instanceof Error?err.message:'暂时无法连接朗读服务')}
  }
  async function accept() {
    if(consentBusy.value)return
    const target=pending, id=epoch
    consentBusy.value=true;consentError.value=''
    try {
      await ports.consent(true)
      if(id!==epoch)return
      if(settings.value)settings.value.consented=true
      consentOpen.value=false
      if(target&&target.conversation===ports.conversation())await begin(target.message,target.conversation)
    } catch {if(id===epoch)consentError.value='授权未能保存，请检查网络后重试'}
    finally {consentBusy.value=false}
  }
  async function manage() {
    stop();const id=epoch
    try {const config=await ports.config();if(id!==epoch)return;settings.value=config;mode.value=config.mode;consentOpen.value=true}
    catch {errors[ports.conversation()]='暂时无法读取朗读设置，请稍后重试'}
  }
  async function revoke() {
    if(consentBusy.value)return
    stop();consentBusy.value=true
    try {await ports.consent(false);if(settings.value)settings.value.consented=false}
    catch {consentOpen.value=true;consentError.value='撤回未能保存，请检查网络后重试'}
    finally {consentBusy.value=false}
  }
  function cycleRate() {
    const rates=[0.8,1,1.25,1.5];rate.value=rates[(rates.indexOf(rate.value)+1)%rates.length]
    if(audio)audio.playbackRate=rate.value
  }
  return {activeKey,stage,rate,mode,error,settings,consentOpen,consentBusy,consentError,
    toggle,accept,stop,cycleRate,manage,revoke, dismissError:()=>{delete errors[ports.conversation()]},
    reset:()=>{stop();settings.value=null;for(const key of Object.keys(errors))delete errors[key]}}
}
export type SpeechController=ReturnType<typeof createSpeech>
export const SPEECH_KEY:InjectionKey<SpeechController>=Symbol('read-aloud')
