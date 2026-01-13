// content/overlay.ts
import Defuddle from 'defuddle'
import { sanitizeArticle } from './reader-sanitize'

declare const TurndownService: any
declare const chrome: any

declare global {
  interface Window {
    __READER_OPEN__?: () => void
    __VESPER_READER_OPEN__?: () => void
  }
}

type Theme = 'light' | 'dark'
type Meta = {
  title: string
  subtitle: string
  author: string
  section: string
  date: string
}

type ArticleResult = {
  articleEl: HTMLElement | null
  meta: Meta
  titleText: string
}

const SVG_MOON =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 12.79A9 9 0 0 1 11.21 3a7 7 0 1 0 9.79 9.79Z"/></svg>'
const SVG_SUN =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0 4a1 1 0 0 1-1-1v-1.5a1 1 0 1 1 2 0V21a1 1 0 0 1-1 1Zm0-17.5a1 1 0 0 1-1-1V2a1 1 0 1 1 2 0v1.5a1 1 0 0 1-1 1ZM3 13a1 1 0 1 1 0-2h1.5a1 1 0 1 1 0 2H3Zm16.5 0a1 1 0 1 1 0-2H21a1 1 0 1 1 0 2h-1.5ZM5.05 19.95a1 1 0 0 1 0-1.41l1.06-1.06a1 1 0 1 1 1.41 1.41L6.46 19.95a1 1 0 0 1-1.41 0Zm11.02-11.02a1 1 0 0 1 0-1.41l1.06-1.06a1 1 0 1 1 1.41 1.41l-1.06 1.06a1 1 0 0 1-1.41 0Zm0 11.02 1.06-1.06a1 1 0 1 1 1.41 1.41l-1.06 1.06a1 1 0 1 1-1.41-1.41ZM5.05 4.05 6.11 3a1 1 0 1 1 1.41 1.41L6.46 5.46A1 1 0 1 1 5.05 4.05Z"/></svg>'

const THEME_KEY = '__reader_theme'

;(() => {
  if (closeExistingOverlay()) return

  const { host, shadow, container } = createOverlayShell()
  const closeOverlay = setupCloseBehavior(host)

  applyTheme(getStoredTheme(), host)

  const { articleEl, meta, titleText } = buildArticle(container)
  if (articleEl) {
    container.appendChild(buildTopBar({ titleText, meta, host, shadow, container, closeOverlay }))
    const scroller = document.createElement('div')
    scroller.className = 'reader-scroll'
    scroller.appendChild(articleEl)
    container.appendChild(scroller)
  }

  mountOverlay({ host, shadow, container })
  lockPageScroll()
  registerEscapeHandler(closeOverlay, shadow)
})()

function closeExistingOverlay() {
  try {
    if (typeof window.__READER_OPEN__ === 'function') {
      window.__READER_OPEN__()
      return true
    }
    if (typeof window.__VESPER_READER_OPEN__ === 'function') {
      window.__VESPER_READER_OPEN__()
      return true
    }
  } catch {
    /* ignore */
  }

  const existing = document.getElementById('reader-root')
  if (!existing) return false
  const prevHtml = existing.getAttribute('data-prev-html-overflow') || ''
  const prevBody = existing.getAttribute('data-prev-body-overflow') || ''
  document.documentElement.style.overflow = prevHtml
  document.body.style.overflow = prevBody
  try {
    existing.remove()
  } catch {
    /* ignore */
  }
  return true
}

function createOverlayShell() {
  const host = document.createElement('div')
  host.id = 'reader-root'
  const shadow = host.attachShadow({ mode: 'open' })

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = chrome.runtime.getURL('content/overlay.css')
  shadow.append(link)

  const container = document.createElement('div')
  container.className = 'reader-container'

  return { host, shadow, container }
}

function setupCloseBehavior(host: HTMLElement) {
  const prevHtmlOverflow = document.documentElement.style.overflow
  const prevBodyOverflow = document.body.style.overflow
  host.setAttribute('data-prev-html-overflow', prevHtmlOverflow || '')
  host.setAttribute('data-prev-body-overflow', prevBodyOverflow || '')

  const closeOverlay = () => {
    try {
      host.remove()
    } catch {
      /* ignore */
    }
    document.documentElement.style.overflow = prevHtmlOverflow
    document.body.style.overflow = prevBodyOverflow
    try {
      delete window.__READER_OPEN__
      delete window.__VESPER_READER_OPEN__
    } catch {
      /* ignore */
    }
  }

  window.__READER_OPEN__ = closeOverlay
  try {
    window.__VESPER_READER_OPEN__ = closeOverlay
  } catch {
    /* ignore */
  }

  return closeOverlay
}

function mountOverlay({ host, shadow, container }: { host: HTMLElement; shadow: ShadowRoot; container: HTMLElement }) {
  shadow.append(container)
  document.documentElement.appendChild(host)
}

function lockPageScroll() {
  document.documentElement.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'
}

function registerEscapeHandler(closeOverlay: () => void, shadow: ShadowRoot) {
  const onKey = (e: Event) => {
    if ((e as KeyboardEvent).key === 'Escape') closeOverlay()
  }
  shadow.addEventListener('keydown', onKey, { capture: true })
  document.addEventListener('keydown', onKey, { capture: true })
}

function buildArticle(container: HTMLElement): ArticleResult {
  try {
    const clone = document.cloneNode(true) as Document
    clone.querySelectorAll('script, style, link[rel="stylesheet"]').forEach((el) => el.remove())

    const defuddle = new Defuddle(clone, { url: document.baseURI || location.href })
    const article = defuddle.parse()
    if (!article || !article.content) {
      container.innerHTML = `<div class="reader-empty">No readable article found.</div>`
      return { articleEl: null, meta: emptyMeta(), titleText: '' }
    }

    const articleEl = document.createElement('article')
    articleEl.className = 'reader-article'
    articleEl.innerHTML = article.content
    sanitizeArticle(articleEl, document.baseURI || location.href)

    const meta = extractMeta()
    ensureTitleBlock(articleEl, meta)

    const titleText = deriveTitle(articleEl, meta.title || article.title || document.title)
    return { articleEl, meta, titleText }
  } catch (e) {
    container.innerHTML = `<div class="reader-empty">Reader error: ${escapeHtml(String(e))}</div>`
    return { articleEl: null, meta: emptyMeta(), titleText: '' }
  }
}

function buildTopBar({
  titleText,
  meta,
  host,
  shadow,
  container,
  closeOverlay,
}: {
  titleText: string
  meta: Meta
  host: HTMLElement
  shadow: ShadowRoot
  container: HTMLElement
  closeOverlay: () => void
}) {
  const bar = document.createElement('header')
  bar.className = 'reader-toolbar'
  bar.innerHTML = `
      <div class="reader-title">${escapeHtml(titleText || '')}</div>
      <div class="reader-actions">
        <button id="reader-theme" class="icon-btn" title="Toggle theme" aria-label="Toggle theme"></button>
        <button id="reader-copy"><span class="label">Copy Markdown</span></button>
        <button id="reader-download"><span class="label">Download Markdown</span></button>
        <button id="reader-close" aria-label="Close">×</button>
      </div>`

  const closeBtn = bar.querySelector<HTMLButtonElement>('#reader-close')!
  closeBtn.addEventListener('click', () => closeOverlay())

  const themeBtn = bar.querySelector<HTMLButtonElement>('#reader-theme')!
  const setThemeButtonIcon = () => {
    const cur = host.getAttribute('data-theme') || 'dark'
    themeBtn.innerHTML = cur === 'dark' ? SVG_SUN : SVG_MOON
    themeBtn.title = cur === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
    themeBtn.setAttribute('aria-label', themeBtn.title)
  }
  setThemeButtonIcon()
  themeBtn.addEventListener('click', () => {
    const cur = host.getAttribute('data-theme') || 'dark'
    const next = cur === 'dark' ? 'light' : 'dark'
    applyTheme(next, host)
    storeTheme(next)
    setThemeButtonIcon()
  })

  const titleName = safeName(meta.title || titleText) + '.md'
  const genMarkdown = createMarkdownGenerator(container)

  const copyBtn = bar.querySelector<HTMLButtonElement>('#reader-copy')!
  const copyLabel = copyBtn.querySelector<HTMLElement>('.label')!
  const downloadBtn = bar.querySelector<HTMLButtonElement>('#reader-download')!
  const downloadLabel = downloadBtn.querySelector<HTMLElement>('.label')!

  copyBtn.addEventListener('click', async () => {
    const md = genMarkdown()
    try {
      await chrome.runtime.sendMessage({
        type: 'COPY_MD',
        md,
        filename: titleName,
      })
    } catch {
      /* ignore */
    }
    withCountdown(copyBtn, copyLabel, 'Copied', 3)
  })

  downloadBtn.addEventListener('click', async () => {
    const md = genMarkdown()
    const payload = { type: 'DOWNLOAD_MD', md, filename: titleName, title: titleText }

    const ok = await sendDownloadMessage(payload)
    if (!ok) fallbackDownload(md, titleName, shadow)

    withCountdown(downloadBtn, downloadLabel, 'Downloaded', 3)
  })

  return bar
}

function createMarkdownGenerator(container: HTMLElement) {
  return () => {
    const articleNode = container.querySelector<HTMLElement>('.reader-article')
    if (!articleNode) return ''
    try {
      const turndown = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
      })
      turndown.addRule('preCode', {
        filter: (node: Element) => node.nodeName === 'PRE' && !!node.querySelector('code'),
        replacement: (_content: string, node: Element) => '```\n' + (node.textContent || '') + '\n```',
      })
      turndown.addRule('dropSmallLinks', {
        filter: (node: Element) =>
          node.nodeName === 'A' && (node.textContent || '').trim().length <= 2,
        replacement: () => '',
      })
      turndown.addRule('dropBadges', {
        filter: (node: Element) =>
          /badge|tag|chip|pill|avatar|logo|icon|subscribe|share|comments|related/i.test(
            node.className || ''
          ),
        replacement: () => '',
      })
      return turndown.turndown(articleNode)
    } catch {
      return (articleNode.textContent || '').trim()
    }
  }
}

async function sendDownloadMessage(payload: { type: string; md: string; filename: string; title: string }) {
  try {
    const res = await new Promise<{ ok: boolean }>((resolve) => {
      try {
        chrome.runtime.sendMessage(payload, (resp: { ok?: boolean } | undefined) =>
          resolve({ ok: !!resp?.ok })
        )
      } catch {
        resolve({ ok: false })
      }
      setTimeout(() => resolve({ ok: false }), 4000)
    })
    return !!res?.ok
  } catch {
    return false
  }
}

function fallbackDownload(md: string, filename: string, shadow: ShadowRoot) {
  try {
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.style.display = 'none'
    shadow.appendChild(a)
    a.click()
    setTimeout(() => {
      URL.revokeObjectURL(url)
      a.remove()
    }, 1000)
  } catch {
    /* ignore */
  }
}

function withCountdown(
  btn: HTMLButtonElement,
  labelEl: HTMLElement,
  baseText: string,
  seconds = 3
) {
  const original = labelEl.textContent
  let remaining = seconds
  btn.disabled = true
  const step = () => {
    if (remaining > 0) {
      labelEl.textContent = `${baseText} (${remaining})`
      remaining -= 1
      setTimeout(step, 1000)
    } else {
      labelEl.textContent = original
      btn.disabled = false
    }
  }
  step()
}

function getMetaContent(sel: string, attr = 'content') {
  return document.querySelector(sel)?.getAttribute(attr) || ''
}

function getStoredTheme(): Theme {
  try {
    return (localStorage.getItem(THEME_KEY) as Theme) || 'dark'
  } catch {
    return 'dark'
  }
}

function storeTheme(v: Theme) {
  try {
    localStorage.setItem(THEME_KEY, v)
  } catch {
    /* ignore */
  }
}

function applyTheme(v: Theme, host: HTMLElement): Theme {
  const t: Theme = v === 'light' ? 'light' : 'dark'
  host.setAttribute('data-theme', t)
  return t
}

function escapeHtml(s: string) {
  const ESCAPE_MAP: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  }
  return String(s).replace(/[&<>"]/g, (m) => ESCAPE_MAP[m] ?? m)
}

function safeName(s: string | undefined = 'article') {
  return (
    String(s)
      .replace(/[\\/:*?"<>|]+/g, ' ')
      .trim()
      .slice(0, 80) || 'article'
  )
}

function deriveTitle(articleEl: HTMLElement, fallback?: string) {
  const h = articleEl.querySelector('h1')
  const t = (h?.textContent || '').trim()
  if (t && t.length > 10) return t
  return fallback || document.title || 'Article'
}

function emptyMeta(): Meta {
  return { title: '', subtitle: '', author: '', section: '', date: '' }
}

function extractMeta(): Meta {
  const meta: Meta = {
    title: getMetaContent('meta[property="og:title"]') || document.title || '',
    subtitle:
      getMetaContent('meta[name="description"]') ||
      getMetaContent('meta[property="og:description"]') ||
      '',
    author:
      getMetaContent('meta[name="author"]') ||
      getMetaContent('meta[property="article:author"]') ||
      '',
    section: getMetaContent('meta[property="article:section"]') || '',
    date: getMetaContent('meta[property="article:published_time"]') || '',
  }
  try {
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    for (const s of scripts) {
      const txt = s.textContent || ''
      if (!txt.trim()) continue
      const json = JSON.parse(txt)
      const data = Array.isArray(json)
        ? json.find((x) => x && (x['@type'] === 'Article' || x['@type'] === 'BlogPosting'))
        : json
      if (data && (data['@type'] === 'Article' || data['@type'] === 'BlogPosting')) {
        meta.title = data.headline || meta.title
        meta.subtitle = data.description || meta.subtitle
        meta.author =
          typeof data.author === 'string' ? data.author : data.author?.name || meta.author
        meta.section = data.articleSection || meta.section
        meta.date = data.datePublished || meta.date
        break
      }
    }
  } catch {
    /* ignore */
  }
  return meta
}

function ensureTitleBlock(articleEl: HTMLElement, meta: Meta) {
  const existing = articleEl.querySelector('h1')
  if (existing && (existing.textContent || '').trim().length > 0) return
  const header = document.createElement('header')
  header.className = 'reader-title-block'
  const h1 = document.createElement('h1')
  h1.textContent = meta.title || document.title || 'Untitled'
  header.appendChild(h1)
  if (meta.subtitle) {
    const p = document.createElement('p')
    p.style.fontStyle = 'italic'
    p.textContent = meta.subtitle
    header.appendChild(p)
  }
  const bits = []
  if (meta.author) bits.push(`By ${meta.author}`)
  if (meta.section) bits.push(meta.section)
  if (meta.date) {
    let d = meta.date
    try {
      d = new Date(meta.date).toLocaleDateString()
    } catch {
      /* ignore */
    }
    bits.push(d)
  }
  if (bits.length) {
    const small = document.createElement('p')
    small.textContent = bits.join(' · ')
    header.appendChild(small)
  }
  articleEl.insertBefore(header, articleEl.firstChild)
}
