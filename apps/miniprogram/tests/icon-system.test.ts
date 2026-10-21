import { expect, it } from 'vitest'
import { iconBodies, iconDataUri, iconSvg, iconStrokeWidth, type IconName } from '../src/icon-system'
import { concernOptions, startingConcernOptions, supportStyles, uncertaintyStarts } from '../src/onboarding'

it('normalizes every icon to one Lucide line canvas and project stroke', () => {
  expect(iconStrokeWidth).toBe(1.75)
  for (const name of Object.keys(iconBodies) as IconName[]) {
    const svg = iconSvg(name, '#123456')
    expect(svg, name).toContain('width="24" height="24" viewBox="0 0 24 24"')
    expect(svg, name).toContain('fill="none"')
    expect(svg, name).toContain('stroke="#123456"')
    expect(svg, name).toContain('stroke-width="1.75"')
    expect(svg, name).toContain('stroke-linecap="round"')
    expect(svg, name).toContain('stroke-linejoin="round"')
  }
})

it('packages icons as cached base64 image sources and falls back safely', () => {
  const first = iconDataUri('compass', '#123456')
  expect(first).toMatch(/^data:image\/svg\+xml;base64,/)
  expect(iconDataUri('compass', '#123456')).toBe(first)
  expect(iconDataUri('missing' as IconName, '#123456')).toBe(iconDataUri('arrow', '#123456'))
  expect(iconSvg('missing' as IconName, '#123456')).toBe(iconSvg('arrow', '#123456'))
})

it('keeps every onboarding choice on the same semantic icon set', () => {
  const used = [...concernOptions, ...startingConcernOptions, ...supportStyles, ...uncertaintyStarts]
  for (const option of used) expect(iconBodies[option.icon as IconName], option.title + ':' + option.icon).toBeTruthy()
  expect(new Set(startingConcernOptions.map(option => option.icon)).size).toBe(startingConcernOptions.length)
  expect(new Set(supportStyles.map(option => option.icon)).size).toBe(supportStyles.length)
  expect(uncertaintyStarts.map(option => option.icon)).toEqual(['chat', 'user', 'sunrise'])
})
