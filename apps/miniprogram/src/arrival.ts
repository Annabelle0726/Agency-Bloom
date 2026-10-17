// Account-scoped, device-local presentation state. Never blocks saved data.
export function createArrivalGate(storage: { read: (key: string) => unknown; write: (key: string, value: string) => void; remove: (key: string) => void }) {
  const memory = new Map<string, string>()
  const key = (id: string) => 'agency.arrival.v1.' + id
  function state(id: string) {
    if (memory.has(id)) return memory.get(id)
    try { return storage.read(key(id)) } catch { return undefined }
  }
  function set(id: string, value: string) {
    memory.set(id, value)
    try { storage.write(key(id), value) } catch { /* Reading remains optional. */ }
  }
  return {
    afterSave(id: string): 'arrival' | 'space' {
      if (state(id) === 'seen') return 'space'
      set(id, 'pending')
      return 'arrival'
    },
    restore(id: string): 'arrival' | 'space' {
      if (state(id) === 'pending') return 'arrival'
      // Existing users bypass the new introduction on normal restoration.
      set(id, 'seen')
      return 'space'
    },
    complete(id: string) { set(id, 'seen') },
    forget(id: string) {
      memory.delete(id)
      try { storage.remove(key(id)) } catch { /* Account deletion still succeeds. */ }
    },
  }
}
