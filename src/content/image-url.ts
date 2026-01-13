const SKIP_SCHEMES = [
  'http:',
  'https:',
  'data:',
  'blob:',
  'chrome-extension:',
  'moz-extension:',
  'file:',
  'about:',
]

function hasScheme(url: string) {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)
}

export function resolveUrl(input: string, baseUrl: string) {
  const url = (input || '').trim()
  if (!url) return ''
  if (url.startsWith('#')) return url
  if (url.startsWith('//')) {
    try {
      const base = new URL(baseUrl)
      return `${base.protocol}${url}`
    } catch {
      return url
    }
  }
  if (hasScheme(url)) {
    const lower = url.toLowerCase()
    if (SKIP_SCHEMES.some((scheme) => lower.startsWith(scheme))) return url
  }
  try {
    return new URL(url, baseUrl).toString()
  } catch {
    return url
  }
}

export function resolveSrcset(input: string, baseUrl: string) {
  const srcset = (input || '').trim()
  if (!srcset) return ''
  const parts = srcset
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  const rewritten = parts.map((part) => {
    const tokens = part.split(/\s+/)
    const url = tokens.shift() || ''
    const descriptor = tokens.join(' ')
    const resolved = resolveUrl(url, baseUrl)
    return descriptor ? `${resolved} ${descriptor}` : resolved
  })
  return rewritten.join(', ')
}

export function chooseImageSrc(current: string, candidates: Array<string | null | undefined>) {
  const cur = (current || '').trim()
  if (cur && !cur.startsWith('data:')) return cur
  for (const candidate of candidates) {
    const value = (candidate || '').trim()
    if (value) return value
  }
  return cur
}
