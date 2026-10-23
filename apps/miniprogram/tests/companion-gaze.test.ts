import { describe, expect, it, vi } from 'vitest'
import { createCompanionGaze, createNativeGazeFeed, type Acceleration } from '../src/companion-gaze'

function fixture() {
  let sample: (sample: Acceleration) => void = () => {}, clock = 0
  const stop = vi.fn(), render = vi.fn(), listeners: Array<(sample: Acceleration) => void> = []
  const feed = vi.fn(callback => { sample = callback; listeners.push(callback); return stop })
  const gaze = createCompanionGaze(feed, render, () => clock)
  return { gaze, render, feed, stop, listeners, sample: (data: Acceleration) => sample(data), advance: () => { clock += 100 } }
}
describe('Moment companion local motion', () => {
  it('calibrates a comfortable holding angle and follows bounded tilt without a timer loop', () => {
    const f = fixture(); f.gaze.setActive(true)
    f.sample({ x: 0, y: -1, z: 0 }); expect(f.render).toHaveBeenLastCalledWith({ x: 0, y: 0 })
    f.advance(); f.sample({ x: .4, y: -.8, z: .3 })
    const result = f.render.mock.lastCall![0]
    expect(result.x).toBeGreaterThan(0); expect(Math.abs(result.x)).toBeLessThanOrEqual(1)
    expect(result.y).toBeLessThan(0); expect(Math.abs(result.y)).toBeLessThanOrEqual(1)
    f.gaze.dispose(); expect(f.stop).toHaveBeenCalledTimes(1)
  })
  it('ignores invalid values, shakes and events faster than the UI cadence', () => {
    const f = fixture(); f.gaze.setActive(true); f.sample({ x: 0, y: -1, z: 0 })
    const before = f.render.mock.calls.length
    f.sample({ x: NaN, y: 1, z: 0 }); f.sample({ x: 3, y: 0, z: 0 }); expect(f.render).toHaveBeenCalledTimes(before)
    f.sample({ x: .3, y: -.9, z: 0 }); const first = f.render.mock.calls.length
    f.sample({ x: .4, y: -.9, z: 0 }); expect(f.render).toHaveBeenCalledTimes(first)
  })
  it('stops on hidden/collapsed states, ignores late events and recalibrates on return', () => {
    const f = fixture(); f.gaze.setActive(true); f.gaze.setActive(true); expect(f.feed).toHaveBeenCalledTimes(1)
    const oldFeed = f.listeners[0]; f.gaze.setActive(false); f.gaze.setActive(false)
    oldFeed({ x: .8, y: -.3, z: 0 }); expect(f.render).toHaveBeenLastCalledWith({ x: 0, y: 0 })
    f.gaze.setActive(true); oldFeed({ x: -.7, y: .6, z: 0 }); f.sample({ x: .5, y: -.5, z: .3 })
    expect(f.render).toHaveBeenLastCalledWith({ x: 0, y: 0 }); expect(f.stop).toHaveBeenCalledTimes(1)
    f.gaze.dispose()
  })
  it('lets touch/pointer take over without sensor jitter, then returns to center', () => {
    const f = fixture(); f.gaze.setActive(true); f.gaze.point(5, -5)
    expect(f.render).toHaveBeenLastCalledWith({ x: 1, y: -1 })
    f.sample({ x: 0, y: -1, z: 0 }); expect(f.render).toHaveBeenLastCalledWith({ x: 1, y: -1 })
    f.gaze.release(); expect(f.render).toHaveBeenLastCalledWith({ x: 0, y: 0 }); f.gaze.dispose()
  })
  it('falls back quietly if a sensor cannot start', () => {
    const render = vi.fn(), gaze = createCompanionGaze(() => { throw Error('unavailable') }, render)
    expect(() => gaze.setActive(true)).not.toThrow(); expect(render).toHaveBeenLastCalledWith({ x: 0, y: 0 })
    gaze.point(.5, -.3); expect(render).toHaveBeenLastCalledWith({ x: .5, y: -.3 })
    gaze.dispose()
  })
  it('removes only its own native listener and does not let a late start stop a newer feed', () => {
    const starts: Array<{ success: () => void; fail: () => void }> = []
    const api = { startAccelerometer: vi.fn(options => starts.push(options)), stopAccelerometer: vi.fn(), onAccelerometerChange: vi.fn(), offAccelerometerChange: vi.fn() }
    const feed = createNativeGazeFeed(api), first = vi.fn(), second = vi.fn()
    const closeFirst = feed(first); closeFirst()
    const closeSecond = feed(second), stopped = api.stopAccelerometer.mock.calls.length
    starts[0].success(); expect(api.stopAccelerometer).toHaveBeenCalledTimes(stopped)
    expect(api.onAccelerometerChange).not.toHaveBeenCalled()
    starts[1].success(); expect(api.onAccelerometerChange).toHaveBeenCalledWith(second)
    closeSecond(); expect(api.offAccelerometerChange).toHaveBeenCalledWith(second)
    expect(api.offAccelerometerChange).not.toHaveBeenCalledWith(first)
  })
})
