import catalog from './app-media.json'

// Exact, hash-verified mappings only. Small controls and avatars stay local.
export function resolveAppMedia(localPath: string): string {
  const item = catalog.objects.find(object => object.localPath === localPath)
  return catalog.publicBaseUrl === 'https://ycombbpglsmbvjlrjtgc.supabase.co/storage/v1/object/public/visual-library/'
    && item?.verifiedAt && item.url === catalog.publicBaseUrl + item.key
    && /^app-media\/[a-z0-9_/-]+\.(jpg|png)$/.test(item.key)
    ? item.url : localPath
}
