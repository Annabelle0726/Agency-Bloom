import { expect, it } from 'vitest'
import { resolveAppMedia } from '../src/app-media'
import { resolveStoredVisualPath } from '../src/visual-storage'
import catalog from '../src/app-media.json'

it('routes every uploaded legacy image to its exact verified object', () => {
  expect(catalog.objects).toHaveLength(32)
  for (const item of catalog.objects) {
    expect(item.verifiedAt).toBeTruthy()
    expect(resolveAppMedia(item.localPath)).toBe(item.url)
    expect(resolveStoredVisualPath(item.localPath)).toBe(item.url)
    expect(item.url).toBe(catalog.publicBaseUrl + item.key)
  }
})
it('keeps small controls, unknown paths and remote avatars unchanged', () => {
  for (const value of ['/static/avatar-user.png', '/static/icons/home.png', '/static/missing.jpg', 'https://example.test/avatar.jpg']) {
    expect(resolveAppMedia(value)).toBe(value)
  }
})
it('resolves every onboarding slide and the approved legacy page-art fallback', () => {
  for (const name of ['dawn', 'meadow', 'mountain-person', 'path', 'rest', 'water']) {
    expect(resolveAppMedia('/static/opening-' + name + '.jpg')).toContain('/public/visual-library/app-media/opening-')
  }
  expect(resolveStoredVisualPath('/static/bloom/dusk-landscape.jpg')).toContain('/app-media/bloom/dusk-landscape.jpg')
})
