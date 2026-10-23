import { describe, expect, it } from 'vitest'
import { resolveStoredVisualPath, resolveVisualStorageUrl, type VisualStorageConfig } from '../src/visual-storage'

const local = '/static/visuals/growth/growth_handcraft_stitching_01.jpg'
const base = 'https://ycombbpglsmbvjlrjtgc.supabase.co/storage/v1/object/public/visual-library/'
const config: VisualStorageConfig = {
  enabled: true,
  verifiedAt: '2026-10-23T04:00:00.000Z',
  publicBaseUrl: base,
  objects: { [local]: 'growth/growth_handcraft_stitching_01.jpg' },
}
describe('reviewed visual storage paths', () => {
  it('keeps local assets active until manual uploads have been verified', () => {
    expect(resolveStoredVisualPath(local)).toBe(local)
    expect(resolveVisualStorageUrl(local, { ...config, enabled: false })).toBeNull()
    expect(resolveVisualStorageUrl(local, { ...config, verifiedAt: null })).toBeNull()
  })
  it('builds the public URL only from an exact curated mapping', () => {
    expect(resolveVisualStorageUrl(local, config)).toBe(base + 'growth/growth_handcraft_stitching_01.jpg')
    expect(resolveVisualStorageUrl('/static/unknown.jpg', config)).toBeNull()
    expect(resolveVisualStorageUrl('https://example.test/other.jpg', config)).toBeNull()
  })
  it('rejects altered hosts, traversal, URL fragments and unsupported categories', () => {
    expect(resolveVisualStorageUrl(local, { ...config, publicBaseUrl: 'https://example.test/' })).toBeNull()
    for (const key of ['growth/../rest/x.jpg', 'growth/x.jpg?x=1', 'growth/x.jpg#x', 'experiment/x.jpg', '//example.test/x.jpg']) {
      expect(resolveVisualStorageUrl(local, { ...config, objects: { [local]: key } })).toBeNull()
    }
  })
})
