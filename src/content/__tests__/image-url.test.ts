import { chooseImageSrc, resolveSrcset, resolveUrl } from '../image-url'
import { describe, expect, it } from 'bun:test'

describe('image url helpers', () => {
  it('resolves relative URLs against base', () => {
    const base = 'https://example.com/path/page'
    expect(resolveUrl('/_next/image?url=%2Fimg.jpg', base)).toBe(
      'https://example.com/_next/image?url=%2Fimg.jpg'
    )
    expect(resolveUrl('img.jpg', base)).toBe('https://example.com/path/img.jpg')
  })

  it('preserves special schemes and anchors', () => {
    const base = 'https://example.com/post'
    expect(resolveUrl('data:image/png;base64,abc', base)).toBe('data:image/png;base64,abc')
    expect(resolveUrl('about:blank', base)).toBe('about:blank')
    expect(resolveUrl('#section', base)).toBe('#section')
  })

  it('resolves protocol-relative URLs', () => {
    const base = 'https://example.com/post'
    expect(resolveUrl('//cdn.example.com/img.png', base)).toBe('https://cdn.example.com/img.png')
  })

  it('rewrites srcset entries', () => {
    const base = 'https://example.com/post'
    expect(resolveSrcset('img.jpg 1x, /img-2.jpg 2x', base)).toBe(
      'https://example.com/img.jpg 1x, https://example.com/img-2.jpg 2x'
    )
  })

  it('prefers non-data candidates for images', () => {
    expect(chooseImageSrc('data:image/png;base64,abc', ['/img.jpg'])).toBe('/img.jpg')
    expect(chooseImageSrc('/img.jpg', ['https://cdn.example.com/hero.png'])).toBe('/img.jpg')
  })
})
