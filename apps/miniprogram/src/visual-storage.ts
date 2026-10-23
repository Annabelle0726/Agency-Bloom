import storage from './visual-storage.json'

export interface VisualStorageConfig {
  enabled: boolean
  publicBaseUrl: string
  verifiedAt: string | null
  objects: Record<string, string>
}

// The base and object keys come only from the reviewed upload manifest.
// This adapter performs no network or model call.
const publicBaseUrl = 'https://ycombbpglsmbvjlrjtgc.supabase.co/storage/v1/object/public/visual-library/'
const objectKeyPattern = /^(choices|connection|direction|growth|reflection|rest|transition)\/[a-z][a-z0-9_]*\.jpg$/

export function resolveVisualStorageUrl(
  localPath: string,
  config: VisualStorageConfig = storage,
): string | null {
  if (!config.enabled || !config.verifiedAt || config.publicBaseUrl !== publicBaseUrl) return null
  if (!Object.prototype.hasOwnProperty.call(config.objects, localPath)) return null
  const key = config.objects[localPath]
  if (!objectKeyPattern.test(key)) return null
  return publicBaseUrl + key
}

export function resolveStoredVisualPath(localPath: string): string {
  return resolveVisualStorageUrl(localPath) || localPath
}
