interface BotanicalPose { x: number; y: number; rotation: number }

/** Absolute scroll position makes the paths reversible without a running timer. */
export function discoverScrollPose(scrollTop: number): { petals: BotanicalPose; leaves: BotanicalPose } {
  const distance = Number.isFinite(scrollTop) ? Math.max(0, scrollTop) : 0
  if (!distance) return { petals: { x: 0, y: 0, rotation: 0 }, leaves: { x: 0, y: 0, rotation: 0 } }
  // Ease into the end of the path rather than hitting a hard scroll limit.
  const t = 1 - Math.exp(-distance / 260), u = 1 - t
  const curve = (a: number, b: number, end: number) => 3 * u * u * t * a + 3 * u * t * t * b + t * t * t * end
  return {
    // Opposite control handles create two visible lobes, mirrored between layers.
    // Keep each form near its corner instead of translating the canvas offscreen.
    petals: { x: curve(-120, 120, 0), y: 36 * t, rotation: -1.2 * Math.sin(2 * Math.PI * t) },
    leaves: { x: curve(140, -140, 0), y: -48 * t, rotation: 1.5 * Math.sin(2 * Math.PI * t) },
  }
}
