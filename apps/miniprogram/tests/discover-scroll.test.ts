import { expect, it } from 'vitest'
import { discoverScrollPose } from '../src/discover-scroll'

it('rests without scroll and returns exactly along the same curve when scrolling back', () => {
  const rest = discoverScrollPose(0)
  expect(rest.petals).toEqual({ x: 0, y: 0, rotation: 0 })
  expect(rest.leaves).toEqual({ x: 0, y: 0, rotation: 0 })
  const outward = discoverScrollPose(260)
  discoverScrollPose(800)
  expect(discoverScrollPose(260)).toEqual(outward)
  expect(discoverScrollPose(-40)).toEqual(rest)
  expect(discoverScrollPose(NaN)).toEqual(rest)
  expect(discoverScrollPose(Infinity)).toEqual(rest)
})

it('follows distinct curved paths with continuous, bounded movement even on very long pages', () => {
  const early = discoverScrollPose(120), later = discoverScrollPose(420)
  for (const layer of ['petals', 'leaves'] as const) {
    // A straight translation would have an equal x/y ratio throughout the path.
    expect(Math.abs(early[layer].x * later[layer].y - later[layer].x * early[layer].y)).toBeGreaterThan(50)
  }
  for (let scroll = 0; scroll < 4000; scroll += 5) {
    const pose = discoverScrollPose(scroll), next = discoverScrollPose(scroll + 1)
    for (const layer of ['petals', 'leaves'] as const) {
      expect(Math.abs(pose[layer].x)).toBeLessThan(41)
      expect(Math.abs(pose[layer].y)).toBeLessThan(49)
      expect(Math.abs(next[layer].x - pose[layer].x)).toBeLessThan(1.7)
      expect(Math.abs(next[layer].y - pose[layer].y)).toBeLessThan(.2)
      expect(Math.abs(pose[layer].rotation)).toBeLessThanOrEqual(1.5)
    }
  }
  expect(early.petals.x).toBeLessThan(0)
  expect(early.leaves.x).toBeGreaterThan(0)
})

it('retains both S bends while keeping the artwork near its screen-edge anchors', () => {
  const firstBend = discoverScrollPose(60), secondBend = discoverScrollPose(360)
  expect(firstBend.petals.x).toBeLessThan(-30)
  expect(secondBend.petals.x).toBeGreaterThan(30)
  expect(firstBend.leaves.x).toBeGreaterThan(35)
  expect(secondBend.leaves.x).toBeLessThan(-35)
  expect(secondBend.petals.y).toBeGreaterThan(26)
  expect(secondBend.leaves.y).toBeGreaterThan(-48)
  const inflection = discoverScrollPose(260 * Math.log(2))
  expect(inflection.petals.x).toBeCloseTo(0)
  expect(inflection.leaves.x).toBeCloseTo(0)
})

it('does not send either decoration up and out of the viewport at the bottom of short or long pages', () => {
  for (const bottom of [305, 500, 900, 2000, 10000]) {
    const pose = discoverScrollPose(bottom)
    expect(pose.petals.y).toBeGreaterThanOrEqual(0)
    expect(pose.petals.y).toBeLessThanOrEqual(36)
    expect(pose.leaves.y).toBeGreaterThanOrEqual(-48)
    expect(pose.leaves.y).toBeLessThanOrEqual(0)
    expect(Math.abs(pose.petals.rotation)).toBeLessThanOrEqual(1.2)
    expect(Math.abs(pose.leaves.rotation)).toBeLessThanOrEqual(1.5)
  }
})
