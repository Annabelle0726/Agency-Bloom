export function messageUnits(text: string) {
  const units: string[] = []
  for (const char of Array.from(text)) {
    const last = units[units.length - 1]
    if (last && (/^[\u0300-\u036f\ufe00-\ufe0f\u200d]$/.test(char) || last.endsWith('\u200d') || /^[\u{1f3fb}-\u{1f3ff}]$/u.test(char))) units[units.length - 1] += char
    else units.push(char)
  }
  return units
}
export function selectedExcerpt(units: string[], start: number, end: number) {
  return units.slice(Math.max(0, Math.min(start, end)), Math.max(start, end)).join('')
}
export interface CharacterRect { left: number; top: number; right: number; bottom: number }
export function nearestCharacter(rects: CharacterRect[], x: number, y: number) {
  let nearest = 0, distance = Infinity
  rects.forEach((rect, index) => {
    const dx = Math.max(rect.left - x, 0, x - rect.right), dy = Math.max(rect.top - y, 0, y - rect.bottom)
    const value = dx * dx + dy * dy * 4
    if (value < distance) { nearest = index; distance = value }
  })
  return nearest
}
