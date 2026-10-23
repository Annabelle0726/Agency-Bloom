import { createSpeech, type SpeechAsset, type SpeechConfig } from './speech'
import type { createApi } from './http'

export function createNativeSpeech(api:ReturnType<typeof createApi>,token:()=>string,conversation:()=>string,base:string) {
  return createSpeech({
    conversation,
    config:()=>api.request<SpeechConfig>('GET','/speech/config').promise,
    consent:accepted=>api.request('PUT','/speech/consent',{accepted}).promise,
    prepare:(id,message)=>api.request<SpeechAsset>('POST',`/conversations/${id}/speech`,message.id
      ?{message_id:message.id}:{text:message.content,proof:message.payload?.speech_proof}),
    download(path) {
      let task:UniApp.DownloadTask|undefined
      const promise=new Promise<string>((resolve,reject)=>{
        task=uni.downloadFile({url:base.replace(/\/$/,'')+path,timeout:20000,
          header:{Authorization:`Bearer ${token()}`},
          success:result=>{
            if(result.statusCode===200)resolve(result.tempFilePath)
            else {
              remove(result.tempFilePath)
              reject(Error(result.statusCode===404?'朗读音频已过期，请再次点击朗读':
                [401,403].includes(result.statusCode)?'朗读授权已失效，请重新打开这条回复':'音频下载未完成，请检查网络后重试'))
            }
          },fail:()=>reject(Error('音频下载中断，请检查网络后再次点击朗读'))})
      })
      return {promise,cancel:()=>task?.abort()}
    },
    remove,
    createAudio:()=>uni.createInnerAudioContext(),
  })
}
function remove(path:string) {
  // Only paths returned by downloadFile enter this function; never saved files.
  if(!path)return
  // #ifdef MP-WEIXIN
  uni.getFileSystemManager().unlink({filePath:path,fail:()=>{}})
  // #endif
  // #ifdef H5
  if(path.startsWith('blob:'))URL.revokeObjectURL(path)
  // #endif
}
