import { chooseImageSrc, resolveSrcset, resolveUrl } from './image-url'

export type ElementLike = {
  getAttribute(name: string): string | null
  setAttribute(name: string, value: string): void
  removeAttribute?: (name: string) => void
  querySelector?: (selector: string) => ElementLike | null
  querySelectorAll?: (selector: string) => ArrayLike<ElementLike> & {
    forEach?: (cb: (el: ElementLike) => void) => void
  }
  parentNode?: any
  firstChild?: any
  textContent?: string | null
  insertBefore?: (...args: any[]) => any
  remove?: () => void
}

export function normalizeImages(root: ElementLike, baseUrl: string) {
  const imgs = root.querySelectorAll ? Array.from(root.querySelectorAll('img')) : []
  imgs.forEach((img) => {
    const src = chooseImageSrc(img.getAttribute('src') || '', [
      img.getAttribute('data-src'),
      img.getAttribute('data-lazy-src'),
      img.getAttribute('data-original'),
      img.getAttribute('data-url'),
      img.getAttribute('data-image'),
      img.getAttribute('data-img'),
    ])
    const resolved = resolveUrl(src, baseUrl)
    if (resolved) img.setAttribute('src', resolved)

    const rawSrcset =
      img.getAttribute('srcset') ||
      img.getAttribute('data-srcset') ||
      img.getAttribute('data-lazy-srcset') ||
      ''
    if (rawSrcset) {
      img.setAttribute('srcset', resolveSrcset(rawSrcset, baseUrl))
    }

    const dataSizes = img.getAttribute('data-sizes')
    if (dataSizes && !img.getAttribute('sizes')) {
      img.setAttribute('sizes', dataSizes)
    }
  })

  const sources = root.querySelectorAll ? Array.from(root.querySelectorAll('source')) : []
  sources.forEach((source) => {
    const src = source.getAttribute('src') || source.getAttribute('data-src') || ''
    if (src) source.setAttribute('src', resolveUrl(src, baseUrl))

    const rawSrcset =
      source.getAttribute('srcset') ||
      source.getAttribute('data-srcset') ||
      source.getAttribute('data-lazy-srcset') ||
      ''
    if (rawSrcset) {
      source.setAttribute('srcset', resolveSrcset(rawSrcset, baseUrl))
    }
  })
}

export function unwrapImageLinks(root: ElementLike) {
  const anchors = root.querySelectorAll ? Array.from(root.querySelectorAll('a')) : []
  anchors.forEach((a) => {
    const text = (a.textContent || '').trim()
    const hasImg = !!a.querySelector?.('img, svg')
    if (!hasImg || (text && text.length > 2)) return
    const parent = a.parentNode
    if (!parent || !a.remove || !('insertBefore' in parent)) return
    while (a.firstChild) {
      const child = a.firstChild
      ;(parent as ElementLike).insertBefore?.(child, a)
    }
    a.remove()
  })
}

export function sanitizeArticle(root: HTMLElement, baseUrl: string) {
  const DROP = [
    'script',
    'style',
    'noscript',
    'svg',
    'iframe',
    'form',
    'input',
    'button',
    'select',
    'textarea',
    'label',
    'nav',
    'header',
    'footer',
    'aside',
  ]
  root.querySelectorAll(DROP.join(',')).forEach((n) => n.remove())
  const noisy =
    /share|social|promo|advert|ad-|ads|banner|subscribe|newsletter|paywall|modal|overlay|tooltip|icon|badge|tag|chip|pill|avatar|logo|breadcrumbs|related|comments|popup/i
  root.querySelectorAll<HTMLElement>('[class], [id]').forEach((el) => {
    const s = `${el.className || ''} ${el.id || ''}`
    if (noisy.test(s)) el.remove()
  })
  unwrapImageLinks(root)
  Array.from(root.querySelectorAll('p') as NodeListOf<HTMLParagraphElement>).forEach((p) => {
    if (!p.textContent || p.textContent.trim().length === 0) p.remove()
  })
  normalizeImages(root, baseUrl)
}
