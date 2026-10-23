import { expect, it } from 'vitest'
import { themes, themeStyle } from '../src/themes'

function luminance(hex: string) {
  const c = hex.slice(1).match(/../g)!.map(value => parseInt(value, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722
}

it('gives plan, reflection and conversation distinct readable colors in all six themes', () => {
  for (const theme of themes) {
    const style = themeStyle(theme), colors = []
    for (const kind of ['plan', 'reflect', 'chat']) {
      const ink = style[`--focus-${kind}-ink`], fill = style[`--focus-${kind}-fill`]
      expect(ink).toMatch(/^#[a-f\d]{6}$/i)
      expect(fill).toMatch(/^#[a-f\d]{6}$/i)
      const a = luminance(ink), b = luminance(fill)
      expect((Math.max(a, b) + .05) / (Math.min(a, b) + .05), `${theme.id}/${kind}`).toBeGreaterThanOrEqual(4.5)
      colors.push(ink)
    }
    expect(new Set(colors).size).toBe(3)
  }
})
