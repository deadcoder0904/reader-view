import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type Target = 'chrome' | 'firefox'

function getBuildEnv() {
  const TARGET: Target = (process.env.BROWSER as Target) || 'chrome'
  const PROD = process.env.NODE_ENV === 'production'
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const ROOT = path.resolve(__dirname, '..')
  const OUT_BASE = path.resolve(ROOT, 'dist')
  const DIST = path.resolve(OUT_BASE, TARGET)
  const ENTRIES = [
    path.resolve('src/background/service-worker.ts'),
    path.resolve('src/popup/popup.ts'),
    path.resolve('src/content/overlay.ts'),
    path.resolve('src/offscreen/offscreen.ts'),
  ]
  return { TARGET, PROD, OUT_BASE, DIST, ENTRIES }
}

async function clean(dist: string, outBase: string) {
  await rm(dist, { recursive: true, force: true })
  await mkdir(outBase, { recursive: true })
  await mkdir(dist, { recursive: true })
}

async function runTypeScriptBuild(
  entrypoints: string[],
  outdir: string,
  minify: boolean,
  sourcemap: 'external' | 'none'
) {
  const result = await Bun.build({ entrypoints, outdir, target: 'browser', minify, sourcemap })
  if (!result.success) {
    console.error('[build] TS build failed')
    result.logs.forEach((l) => {
      console.error(l)
    })
    throw new Error('Build failed')
  }
}

async function relocateCompiledOutputs(dist: string) {
  // Bun preserves entry subdirectories (background/service-worker.js, popup/popup.js)
  // We want: background.js, popup.js at dist root
  const pairs: Array<[string, string]> = [
    [path.join(dist, 'background', 'service-worker.js'), path.join(dist, 'background.js')],
    [path.join(dist, 'popup', 'popup.js'), path.join(dist, 'popup.js')],
    [path.join(dist, 'offscreen', 'offscreen.js'), path.join(dist, 'offscreen.js')],
  ]

  for (const [src, out] of pairs) {
    try {
      const code = await Bun.file(src).text()
      await Bun.write(out, code)
    } catch {
      console.warn(`[build] Missing output for ${path.basename(out)}?`)
    }
  }
}

async function buildFirefoxBackgroundIIFE(dist: string, prod: boolean) {
  const res2 = await Bun.build({
    entrypoints: [path.resolve('src/background/service-worker.ts')],
    outdir: dist,
    target: 'browser',
    sourcemap: !prod ? 'external' : 'none',
    minify: prod,
    format: 'iife',
    naming: { entry: 'background.js' },
  })
  if (!res2.success) {
    console.error('[build] Firefox background (iife) build failed')
    res2.logs.forEach((l) => {
      console.error(l)
    })
    throw new Error('Build failed')
  }
  // Ensure expected filename if bundler named it differently
  try {
    const iifeFile = path.join(dist, 'service-worker.js')
    const code = await Bun.file(iifeFile).text()
    await Bun.write(path.join(dist, 'background.js'), code)
  } catch {
    // noop if naming worked
  }
}

async function bundle(env: ReturnType<typeof getBuildEnv>) {
  await runTypeScriptBuild(env.ENTRIES, env.DIST, env.PROD, !env.PROD ? 'external' : 'none')
  await relocateCompiledOutputs(env.DIST)
  if (env.TARGET === 'firefox') await buildFirefoxBackgroundIIFE(env.DIST, env.PROD)
}

async function runTailwind(input: string, output: string, prod: boolean) {
  await mkdir(path.dirname(output), { recursive: true })
  const args = [
    'x',
    '@tailwindcss/cli',
    '-i',
    input,
    '-o',
    output,
    '--content',
    'src/**/*.{html,ts,tsx,js}',
  ]
  if (prod) args.push('--minify')
  const proc = Bun.spawn({ cmd: ['bun', ...args], stdout: 'inherit', stderr: 'inherit' })
  const code = await proc.exited
  if (code !== 0) throw new Error(`[css] Tailwind failed for ${input}`)
}

async function css(env: ReturnType<typeof getBuildEnv>) {
  await runTailwind('src/styles/popup.css', path.join(env.DIST, 'styles/popup.css'), env.PROD)
  await runTailwind('src/content/overlay.css', path.join(env.DIST, 'content/overlay.css'), env.PROD)
}

async function html(env: ReturnType<typeof getBuildEnv>) {
  await cp('src/popup/popup.html', path.join(env.DIST, 'popup.html'))
}

async function copyFile(src: string, dest: string) {
  await mkdir(path.dirname(dest), { recursive: true })
  await cp(src, dest)
}

async function assets(env: ReturnType<typeof getBuildEnv>) {
  await Promise.all([
    copyFile('src/offscreen/offscreen.html', path.join(env.DIST, 'offscreen.html')),
  ])

  try {
    await copyFile(
      'node_modules/turndown/dist/turndown.js',
      path.join(env.DIST, 'node_modules/turndown/dist/turndown.js')
    )
  } catch (err) {
    console.warn('[build] Vendor libs not copied:', err)
  }
}

async function icons(env: ReturnType<typeof getBuildEnv>) {
  // Generate icons fresh each build after cleaning
  const proc = Bun.spawn({
    cmd: ['bun', 'run', 'scripts/generate-icons.ts'],
    stdout: 'inherit',
    stderr: 'inherit',
    env: { ...process.env, ICONS_OUT_DIR: path.join(env.DIST, 'icons') },
  })
  const code = await proc.exited
  if (code !== 0) throw new Error('[icons] generation failed')
}

async function manifest(env: ReturnType<typeof getBuildEnv>) {
  const pkg = JSON.parse(await readFile(path.resolve('package.json'), 'utf8'))
  const basePath = path.resolve('manifests', `manifest.${env.TARGET}.json`)
  const base = JSON.parse(await readFile(basePath, 'utf8'))
  // Enrich with version from package.json
  const merged = { ...base, version: pkg.version ?? '1.0.0' }
  await writeFile(path.join(env.DIST, 'manifest.json'), JSON.stringify(merged, null, 2))
}

async function main() {
  const env = getBuildEnv()
  await clean(env.DIST, env.OUT_BASE)
  await icons(env)
  await Promise.all([bundle(env), css(env), html(env), assets(env)])
  await manifest(env)
  console.log(`[build] Done for ${env.TARGET} (${env.PROD ? 'prod' : 'dev'})`)
}

await main()
