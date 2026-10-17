import { describe, it, expect } from 'vitest'
import { createArrivalGate } from '../src/arrival'
function setup() {
  const data = new Map<string, string>()
  const storage = { read: (k: string) => data.get(k), write: (k: string, v: string) => { data.set(k, v) }, remove: (k: string) => { data.delete(k) } }
  return { data, storage, gate: createArrivalGate(storage) }
}
describe('first arrival navigation', () => {
  it('resumes an unfinished introduction after successful save and reload', () => {
    const { storage, gate } = setup()
    expect(gate.afterSave('new')).toBe('arrival')
    expect(createArrivalGate(storage).restore('new')).toBe('arrival')
  })
  it('continues directly after completion, including new explorations', () => {
    const { storage, gate } = setup()
    gate.afterSave('new'); gate.complete('new')
    const reloaded = createArrivalGate(storage)
    expect(reloaded.restore('new')).toBe('space')
    expect(reloaded.afterSave('new')).toBe('space')
  })
  it('does not interrupt existing accounts and isolates other accounts', () => {
    const { gate } = setup()
    expect(gate.restore('existing')).toBe('space')
    expect(gate.afterSave('existing')).toBe('space')
    expect(gate.afterSave('another')).toBe('arrival')
  })
  it('allows entry when local storage is unavailable', () => {
    const fail = () => { throw Error('storage unavailable') }
    const gate = createArrivalGate({ read: fail, write: fail, remove: fail })
    expect(gate.afterSave('new')).toBe('arrival')
    gate.complete('new')
    expect(gate.restore('new')).toBe('space')
    expect(gate.afterSave('new')).toBe('space')
  })
  it('removes only the deleted account presentation state', () => {
    const { data, gate } = setup()
    gate.complete('one'); gate.complete('two'); gate.forget('one')
    expect(data.has('agency.arrival.v1.one')).toBe(false)
    expect(gate.afterSave('two')).toBe('space')
  })
})
