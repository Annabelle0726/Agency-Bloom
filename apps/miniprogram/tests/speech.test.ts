import { expect, it, vi } from 'vitest'
import { createSpeech, type SpeechAsset } from '../src/speech'
import { ref } from 'vue'

function harness() {
  const conversation = ref('one')
  const callbacks: Record<string, () => void> = {}
  const audio = { src:'', autoplay:false, loop:false, obeyMuteSwitch:true, playbackRate:1, paused:false,
    play:vi.fn(), pause:vi.fn(), stop:vi.fn(), destroy:vi.fn(),
    onPlay:(f:()=>void)=>{callbacks.play=f}, onPause:(f:()=>void)=>{callbacks.pause=f},
    onEnded:(f:()=>void)=>{callbacks.end=f}, onError:(f:()=>void)=>{callbacks.error=f},
    onWaiting:(f:()=>void)=>{callbacks.wait=f} }
  Object.assign(audio,{onCanplay:(f:()=>void)=>{callbacks.canplay=f},onTimeUpdate:(f:()=>void)=>{callbacks.progress=f}})
  const prepare = vi.fn(() => ({promise:Promise.resolve<SpeechAsset>({mode:'mock',parts:['/audio/1']}),cancel:vi.fn()}))
  const remove = vi.fn()
  const speech = createSpeech({conversation:()=>conversation.value, config:async()=>({consented:false,mode:'mock',available:true,cache_seconds:3600}),
    consent:vi.fn(async()=>{}), prepare, download:()=>({promise:Promise.resolve('temp.mp3'),cancel:vi.fn()}),
    remove, createAudio:()=>audio})
  return {speech,audio,callbacks,prepare,remove,switch:()=>{conversation.value='two';speech.stop()}}
}
const message = {id:'reply',role:'assistant' as const,content:'最终回复'}

it('asks once before synthesis and only enters playing after native onPlay', async()=>{
  const h=harness()
  await h.speech.toggle(message)
  expect(h.speech.consentOpen.value).toBe(true); expect(h.prepare).not.toHaveBeenCalled()
  await h.speech.accept()
  expect(h.audio.play).toHaveBeenCalledTimes(1); expect(h.speech.stage.value).toBe('loading')
  h.callbacks.play(); expect(h.speech.stage.value).toBe('playing')
  await h.speech.toggle(message); expect(h.audio.pause).toHaveBeenCalled()
  h.callbacks.pause(); expect(h.speech.stage.value).toBe('paused')
  h.speech.cycleRate(); expect(h.audio.playbackRate).toBe(1.25)
  await h.speech.toggle(message); expect(h.audio.play).toHaveBeenCalledTimes(2)
  expect(h.prepare).toHaveBeenCalledTimes(1)
  h.speech.stop(); expect(h.remove).toHaveBeenCalledWith('temp.mp3'); expect(h.audio.destroy).toHaveBeenCalled()
})

it('does not play a late download after a conversation switch', async()=>{
  const h=harness()
  await h.speech.toggle(message)
  const pending=h.speech.accept()
  h.switch(); await pending
  expect(h.audio.play).not.toHaveBeenCalled(); expect(h.speech.stage.value).toBe('idle')
  expect(h.speech.consentOpen.value).toBe(false)
})

it('allows declining an inline first-use notice without creating audio or saving consent',async()=>{
  const h=harness();await h.speech.toggle(message)
  expect(h.speech.consentOpen.value).toBe(true)
  h.speech.stop()
  expect(h.speech.consentOpen.value).toBe(false)
  expect(h.prepare).not.toHaveBeenCalled();expect(h.audio.play).not.toHaveBeenCalled()
})

it('preserves a safe error until verified playback, scoped to its conversation', async()=>{
  const h=harness()
  await h.speech.toggle(message); await h.speech.accept()
  h.callbacks.error(); expect(h.speech.error.value).toContain('音频')
  h.speech.stop(); expect(h.speech.error.value).not.toBe('')
  h.switch(); expect(h.speech.error.value).toBe('')
})

it('blocks duplicate taps while preparing and deletes a late download', async()=>{
  let finish!:(path:string)=>void
  const cancel=vi.fn(),remove=vi.fn(),prepare=vi.fn(()=>({promise:Promise.resolve({mode:'mock',parts:['one']}),cancel:vi.fn()}))
  const speech=createSpeech({conversation:()=> 'one',config:async()=>({consented:true,mode:'mock',available:true,cache_seconds:3600}),consent:async()=>{},
    prepare,download:()=>({promise:new Promise<string>(r=>{finish=r}),cancel}),remove,createAudio:()=>{throw Error('A stale download must never create audio')}})
  const first=speech.toggle(message)
  await Promise.resolve();await Promise.resolve()
  await speech.toggle(message);expect(prepare).toHaveBeenCalledTimes(1)
  speech.stop();expect(cancel).toHaveBeenCalledTimes(1)
  finish('late.mp3');await first;expect(remove).toHaveBeenCalledWith('late.mp3')
})

it('advances all segments in order and ignores destroyed-context callbacks', async()=>{
  const h=harness();h.prepare.mockImplementation(()=>({promise:Promise.resolve({mode:'mock',parts:['one','two']}),cancel:vi.fn()}))
  await h.speech.toggle(message);await h.speech.accept()
  h.callbacks.play();const oldPlay=h.callbacks.play
  h.callbacks.end();await Promise.resolve();await Promise.resolve()
  expect(h.audio.play).toHaveBeenCalledTimes(2)
  h.callbacks.play();h.speech.stop();oldPlay()
  expect(h.speech.stage.value).toBe('idle')
  expect(h.remove).toHaveBeenCalledTimes(2)
})

it('times out a stalled native player without retrying synthesis', async()=>{
  vi.useFakeTimers()
  try {
    const h=harness();await h.speech.toggle(message);await h.speech.accept()
    vi.advanceTimersByTime(15001)
    expect(h.speech.error.value).toContain('加载较久');expect(h.audio.destroy).toHaveBeenCalledTimes(1)
    expect(h.prepare).toHaveBeenCalledTimes(1);expect(h.speech.stage.value).toBe('idle')
  } finally {vi.useRealTimers()}
})

it('returns to playing after native buffering without a second onPlay', async()=>{
  const h=harness();await h.speech.toggle(message);await h.speech.accept()
  h.callbacks.play();h.callbacks.wait();expect(h.speech.stage.value).toBe('loading')
  h.callbacks.canplay();expect(h.speech.stage.value).toBe('playing')
  h.audio.paused=true;h.callbacks.pause();h.callbacks.progress()
  expect(h.speech.stage.value).toBe('paused');h.speech.stop()
})
