import { Defuddle } from 'defuddle/node'
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'bun:test'

describe('defuddle', () => {
  it('extracts main content from a simple document', async () => {
    const html = `<!doctype html>
      <html>
        <head>
          <title>Hello</title>
        </head>
        <body>
          <header>Header</header>
          <main>
            <article>
              <h1>Hello</h1>
              <p>Main content lives here.</p>
            </article>
          </main>
          <footer>Footer</footer>
        </body>
      </html>`
    const url = 'https://example.com/post'
    const dom = new JSDOM(html, { url })
    const result = await Defuddle(dom, url)

    expect(result.title).toBe('Hello')
    expect(result.content).toContain('Main content lives here.')
    expect(result.wordCount).toBeGreaterThan(0)
  })
})
