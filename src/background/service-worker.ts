const api = ((globalThis as any).browser ?? (globalThis as any).chrome) as any
const chromeApi = (globalThis as any).chrome as any

api.runtime.onInstalled.addListener(() => {
  console.log('[reader-view] installed')
})

api.action.onClicked.addListener(async (tab: any) => {
  try {
    if (!tab || !tab.id) return
    const url = tab.url || ''
    if (
      /^(chrome|edge|about|devtools|view-source):/i.test(url) ||
      url.startsWith('chrome-extension://')
    ) {
      try {
        await api.action.setBadgeBackgroundColor?.({ color: '#cc3333' })
        await api.action.setBadgeText?.({ text: 'X', tabId: tab.id })
        setTimeout(() => api.action.setBadgeText?.({ text: '', tabId: tab.id }), 2000)
      } catch {
        /* ignore */
      }
      console.warn('Reader View: cannot run on restricted URL:', url)
      return
    }

    await api.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['node_modules/turndown/dist/turndown.js', 'content/overlay.js'],
    })
  } catch (e) {
    console.error('Reader View injection failed:', e)
  }
})

async function ensureOffscreen() {
  const OFFSCREEN_URL = chromeApi?.runtime?.getURL?.('offscreen.html')
  if (!chromeApi?.offscreen || !OFFSCREEN_URL) return
  try {
    const has = await chromeApi.offscreen.hasDocument?.()
    if (!has) {
      await chromeApi.offscreen.createDocument({
        url: OFFSCREEN_URL,
        reasons: [chromeApi.offscreen.Reason.CLIPBOARD],
        justification: 'Write Markdown to clipboard.',
      })
    }
  } catch {
    try {
      await chromeApi.offscreen.createDocument({
        url: OFFSCREEN_URL,
        reasons: [chromeApi.offscreen.Reason.CLIPBOARD],
        justification: 'Write Markdown to clipboard.',
      })
    } catch {
      // ignore if already exists
    }
  }
}

api.runtime.onMessage.addListener((msg: any, sender: any, sendResponse: any) => {
  void (async () => {
    try {
      if (msg?.type === 'COPY_MD') {
        await ensureOffscreen()
        if (chromeApi?.runtime?.sendMessage) {
          chromeApi.runtime.sendMessage({ type: 'OFFSCREEN_COPY', md: msg.md })
          sendResponse({ ok: true })
        } else {
          sendResponse({ ok: false })
        }
      } else if (msg?.type === 'DOWNLOAD_MD') {
        const filename = deriveFilename(msg, sender) + '.md'
        await ensureOffscreen()
        if (!chromeApi?.runtime?.sendMessage) {
          sendResponse({ ok: false })
          return
        }
        const ok = await new Promise((resolve) => {
          try {
            chromeApi.runtime.sendMessage(
              {
                type: 'OFFSCREEN_DOWNLOAD',
                md: msg.md || '',
                filename,
              },
              (resp: any) => {
                resolve(!!(resp && resp.ok))
              }
            )
            setTimeout(() => resolve(false), 5000)
          } catch {
            resolve(false)
          }
        })
        sendResponse({ ok })
      }
    } catch (e) {
      console.error('Reader View message handling error:', e)
      sendResponse({ ok: false, error: String(e) })
    }
  })()
  return true
})

function deriveFilename(msg: any, sender: any) {
  const base =
    msg && typeof msg.filename === 'string' && msg.filename.trim()
      ? msg.filename.replace(/\.(md|markdown)$/i, '')
      : msg && typeof msg.title === 'string' && msg.title.trim()
        ? msg.title
        : sender?.tab?.title || 'article'
  return sanitizeFilename(base).slice(0, 120) || 'article'
}

function sanitizeFilename(name: string) {
  return String(name)
    .replace(/[\n\r]+/g, ' ')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
