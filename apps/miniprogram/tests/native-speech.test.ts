import { afterEach, expect, it, vi } from 'vitest'
import { createApi } from '../src/http'
import { createNativeSpeech } from '../src/native-speech'

afterEach(()=>vi.unstubAllGlobals())
it('downloads MP3 with session authorization, classifies weak-network errors and cleans failed files',async()=>{
  const unlink=vi.fn(),createAudio=vi.fn()
  const download=vi.fn(options=>{options.success({statusCode:503,tempFilePath:'wxfile://tmp/failed'});return {abort:vi.fn()}})
  vi.stubGlobal('uni',{downloadFile:download,getFileSystemManager:()=>({unlink}),createInnerAudioContext:createAudio})
  const api=createApi(options=>{
    options.success({statusCode:200,data:options.url.endsWith('/config')
      ?{consented:true,mode:'mock',available:true,cache_seconds:3600}:{mode:'mock',parts:['/speech/audio/test/0']}})
    return {abort:vi.fn()}
  },()=> 'test-session',()=>{},'https://mock.invalid/api')
  const speech=createNativeSpeech(api,()=> 'test-session',()=> 'conversation','https://mock.invalid/api')
  await speech.toggle({id:'reply',role:'assistant',content:'最终回复'})
  expect(download.mock.calls[0][0].url).toBe('https://mock.invalid/api/speech/audio/test/0')
  expect(download.mock.calls[0][0].header).toEqual({Authorization:'Bearer test-session'})
  expect(speech.error.value).toContain('下载未完成')
  expect(speech.error.value).not.toContain('授权已失效')
  expect(createAudio).not.toHaveBeenCalled()
  expect(unlink.mock.calls[0][0].filePath).toBe('wxfile://tmp/failed')
})
