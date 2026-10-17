interface Storage {
  read: (key: string) => string
  write: (key: string, path: string) => void
  save: (temporaryPath: string) => Promise<string>
  remove: (savedPath: string) => Promise<void>
}

// Avatars stay on this device, separate from chat, profile and model requests
export function createAvatarStore(storage: Storage) {
  const key = (userId: string) => `agency.avatar.${userId}`
  const read = (userId: string) => storage.read(key(userId)) || ''
  async function clear(userId: string) {
    const previous = read(userId)
    storage.write(key(userId), '')
    if (previous) await storage.remove(previous).catch(() => {})
  }
  async function choose(userId: string, temporaryPath: string) {
    if (!userId || !temporaryPath) return
    const path = await storage.save(temporaryPath)
    const previous = read(userId)
    storage.write(key(userId), path)
    if (previous && previous !== path) await storage.remove(previous).catch(() => {})
  }
  return { read, choose, clear }
}
