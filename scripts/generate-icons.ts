import { mkdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

// Lazy import to avoid hard dependency when running --check
async function loadSharp() {
  return (await import('sharp')).default
}

const DEFAULT_CANDIDATES = [
  'src/assets/icon.svg',
  'src/assets/icon.png',
  'src/assets/icon-source.svg',
  'src/assets/icon-source.png',
].map((p) => path.resolve(p))
const OUT_DIR = process.env.ICONS_OUT_DIR
  ? path.resolve(process.env.ICONS_OUT_DIR)
  : path.resolve('dist/icons')
const SIZES = [16, 32, 48, 128, 256]

async function exists(p: string) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function ensureDir(p: string) {
  await mkdir(p, { recursive: true })
}

/**
 * Parse CLI arguments for --check and optional --src path.
 */
function parseArgs() {
  const args = process.argv.slice(2)
  const out: { check: boolean; src?: string } = { check: false }
  for (const a of args) {
    if (a === '--check') out.check = true
    else if (a.startsWith('--src=')) out.src = a.slice('--src='.length)
    else if (!a.startsWith('--') && !out.src) out.src = a
  }
  return out
}

/**
 * Resolve preferred icon source, trying CLI path first then default candidates.
 */
async function resolveSource(cliSrc?: string) {
  if (cliSrc && (await exists(cliSrc))) return path.resolve(cliSrc)
  for (const p of DEFAULT_CANDIDATES) {
    if (await exists(p)) return p
  }
  return null
}

async function main() {
  const { check: checkOnly, src: cliSrc } = parseArgs()

  const resolved = await resolveSource(cliSrc)
  let srcType: 'svg' | 'png' | 'none' = 'none'
  if (resolved) {
    const ext = path.extname(resolved).toLowerCase()
    srcType = ext === '.svg' ? 'svg' : 'png'
  }

  // Validate source readability if present
  let usableSource = false
  let sourceBuffer: Buffer | null = null
  if (resolved) {
    try {
      sourceBuffer = await readFile(resolved)
      const sharp = await loadSharp()
      // For SVG set a high density for crisper rasterization
      if (srcType === 'svg') {
        await sharp(sourceBuffer, { density: 1024 }).metadata()
      } else {
        await sharp(sourceBuffer).metadata()
      }
      usableSource = true
    } catch {
      usableSource = false
      sourceBuffer = null
    }
  }
  await ensureDir(OUT_DIR)
  const outputs = await Promise.all(
    SIZES.map(async (size) => {
      const out = path.join(OUT_DIR, `icon${size}.png`)
      if (checkOnly) return { size, out }
      const sharp = await loadSharp()
      if (usableSource && sourceBuffer) {
        const input =
          srcType === 'svg' ? sharp(sourceBuffer, { density: 1024 }) : sharp(sourceBuffer)
        await input.resize(size, size).png().toFile(out)
      } else {
        // Fallback: generate a simple placeholder icon if no source is present
        await sharp({
          create: {
            width: size,
            height: size,
            channels: 4,
            background: { r: 26, g: 140, b: 255, alpha: 1 }, // #1a8cff
          },
        })
          .png()
          .toFile(out)
      }
      return { size, out }
    })
  )
  if (checkOnly) {
    const missing = (
      await Promise.all(outputs.map(async (o) => ({ ...o, present: await exists(o.out) })))
    ).filter((o) => !o.present)
    if (missing.length) {
      console.log('[icons] Missing sizes:', missing.map((m) => m.size).join(', '))
    } else {
      console.log('[icons] All icon sizes present')
    }
    return
  }
  if (usableSource) {
    console.log(
      `[icons] Generated from ${srcType.toUpperCase()} source:`,
      outputs.map((o) => path.basename(o.out)).join(', ')
    )
  } else {
    console.log(
      '[icons] Generated placeholder icons (no valid source found). Provide src/assets/icon.svg or icon-source.png, or pass --src=path'
    )
  }
}

main().catch((err) => {
  console.error('[icons] Failed:', err)
  process.exitCode = 1
})
