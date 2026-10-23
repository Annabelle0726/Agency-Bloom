/** Local decorative input only: no storage, telemetry, camera or model calls. */
export interface Gaze { x: number; y: number }
export interface Acceleration { x: number; y: number; z: number }
export type GazeFeed = (listener: (sample: Acceleration) => void) => () => void
const clamp = (value: number) => Math.max(-1, Math.min(1, value))
const center = (): Gaze => ({ x: 0, y: 0 })
const wrapAngle = (value: number) => Math.atan2(Math.sin(value), Math.cos(value))

export function createCompanionGaze(feed: GazeFeed, render: (gaze: Gaze) => void, now = Date.now) {
  let active = false, epoch = 0, detach: (() => void) | undefined
  let baseline: Gaze | null = null, current = center(), last = -Infinity, touching = false
  function setActive(next: boolean) {
    if (next === active) return
    active = next; epoch++; baseline = null; current = center(); last = -Infinity; touching = false
    detach?.(); detach = undefined; render(center())
    if (!active) return
    const run = epoch
    try {
      const cleanup = feed(sample => {
        if (!active || run !== epoch || touching || ![sample.x, sample.y, sample.z].every(Number.isFinite)) return
        const magnitude = Math.hypot(sample.x, sample.y, sample.z)
        if (magnitude < .55 || magnitude > 1.6) return // Ignore shakes/free-fall, not a gesture.
        const angle = { x: Math.atan2(sample.x, Math.hypot(sample.y, sample.z)), y: Math.atan2(sample.y, sample.z) }
        if (!baseline) { baseline = angle; return }
        const timestamp = now()
        if (timestamp - last < 80) return
        last = timestamp
        const target = { x: clamp((angle.x - baseline.x) / .42), y: clamp(-wrapAngle(angle.y - baseline.y) / .45) }
        current = { x: current.x + (target.x - current.x) * .4, y: current.y + (target.y - current.y) * .4 }
        render({ ...current })
      })
      // A feed may synchronously trigger a lifecycle change while starting.
      if (!active || run !== epoch) cleanup(); else detach = cleanup
    } catch { render(center()) } // Pointer/touch remain available without a sensor.
  }
  function point(x: number, y: number) {
    if (!active || !Number.isFinite(x) || !Number.isFinite(y)) return
    touching = true; current = { x: clamp(x), y: clamp(y) }; render({ ...current })
  }
  function release() { touching = false; current = center(); render(center()) }
  return { setActive, point, release, dispose: () => setActive(false) }
}

// One owned native subscription. Late start callbacks cannot stop a newer feed.
let sensorOwner: symbol | null = null
export function createNativeGazeFeed(api: {
  startAccelerometer: (options: { interval: 'ui'; success: () => void; fail: () => void }) => void
  stopAccelerometer: (options: { fail: () => void }) => void
  onAccelerometerChange: (listener: (sample: Acceleration) => void) => void
  offAccelerometerChange: (listener: (sample: Acceleration) => void) => void
}): GazeFeed {
  return listener => {
    const owner = Symbol('moment-gaze'); sensorOwner = owner
    let closed = false, attached = false
    const close = () => {
      closed = true
      if (attached) { api.offAccelerometerChange(listener); attached = false }
      if (sensorOwner === owner) {
        sensorOwner = null
        api.stopAccelerometer({ fail: () => {} })
      }
    }
    try {
      api.startAccelerometer({ interval: 'ui', success: () => {
        if (closed || sensorOwner !== owner) return
        api.onAccelerometerChange(listener); attached = true
      }, fail: close })
    } catch { close() }
    return close
  }
}
