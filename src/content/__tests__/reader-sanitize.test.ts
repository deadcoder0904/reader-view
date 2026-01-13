import { describe, expect, it } from 'bun:test'
import { type ElementLike, normalizeImages, unwrapImageLinks } from '../reader-sanitize'

class MockElement {
  tagName: string
  attributes: Record<string, string>
  children: MockElement[]
  parentNode: MockElement | null
  textContent: string

  constructor(tagName: string, attrs: Record<string, string> = {}, text = '') {
    this.tagName = tagName.toLowerCase()
    this.attributes = { ...attrs }
    this.children = []
    this.parentNode = null
    this.textContent = text
  }

  getAttribute(name: string) {
    return this.attributes[name] ?? null
  }

  setAttribute(name: string, value: string) {
    this.attributes[name] = value
  }

  appendChild(child: ElementLike) {
    const childEl = child as MockElement
    childEl.parentNode = this
    this.children.push(childEl)
  }

  insertBefore(child: ElementLike, ref: ElementLike | null) {
    const childEl = child as MockElement
    const refEl = ref as MockElement | null
    if (childEl.parentNode) {
      childEl.parentNode.removeChild(childEl)
    }
    const index = refEl ? this.children.indexOf(refEl) : -1
    if (index === -1) {
      this.children.push(childEl)
    } else {
      this.children.splice(index, 0, childEl)
    }
    childEl.parentNode = this
  }

  removeChild(child: ElementLike) {
    const childEl = child as MockElement
    const index = this.children.indexOf(childEl)
    if (index !== -1) this.children.splice(index, 1)
    childEl.parentNode = null
  }

  remove() {
    if (this.parentNode) this.parentNode.removeChild(this)
  }

  get firstChild() {
    return this.children[0] ?? null
  }

  querySelector(selector: string) {
    return this.querySelectorAll(selector)[0] ?? null
  }

  querySelectorAll(selector: string) {
    const selectorSet = new Set(
      selector
        .split(',')
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean)
    )
    const results: MockElement[] = []
    const visit = (node: MockElement) => {
      node.children.forEach((child) => {
        if (selectorSet.has(child.tagName)) results.push(child)
        visit(child)
      })
    }
    visit(this)
    return results
  }
}

describe('unwrapImageLinks', () => {
  it('unwraps image-only links instead of removing images', () => {
    const root = new MockElement('div')
    const anchor = new MockElement('a')
    const img = new MockElement('img', { src: '/hero.png' })
    anchor.appendChild(img)
    root.appendChild(anchor)

    unwrapImageLinks(root)

    expect(root.children.length).toBe(1)
    expect(root.children[0].tagName).toBe('img')
    expect(root.querySelectorAll('a').length).toBe(0)
  })

  it('keeps linked images when link has text', () => {
    const root = new MockElement('div')
    const anchor = new MockElement('a', {}, 'Read')
    const img = new MockElement('img', { src: '/hero.png' })
    anchor.appendChild(img)
    root.appendChild(anchor)

    unwrapImageLinks(root)

    expect(root.querySelectorAll('a').length).toBe(1)
    expect(root.querySelectorAll('img').length).toBe(1)
  })
})

describe('normalizeImages', () => {
  it('resolves lazy src and srcset attributes', () => {
    const root = new MockElement('div')
    const img = new MockElement('img', {
      src: 'data:image/png;base64,abc',
      'data-src': '/images/hero.jpg',
      'data-srcset': '/images/hero.jpg 1x, /images/hero@2x.jpg 2x',
    })
    root.appendChild(img)

    normalizeImages(root, 'https://example.com/post')

    expect(img.getAttribute('src')).toBe('https://example.com/images/hero.jpg')
    expect(img.getAttribute('srcset')).toBe(
      'https://example.com/images/hero.jpg 1x, https://example.com/images/hero@2x.jpg 2x'
    )
  })
})
