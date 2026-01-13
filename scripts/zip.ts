import { spawn } from 'bun'

import { stat } from 'node:fs/promises'
import path from 'node:path'

async function ensureManifestPresent(dir: string) {
  try {
    await stat(path.join(dir, 'manifest.json'))
  } catch {
    throw new Error(`manifest.json not found in ${dir}. Did you run build for this target?`)
  }
}

function getArchiveName(target: string) {
  return target === 'firefox' ? 'reader-view-firefox.xpi' : 'reader-view-chrome.zip'
}

async function zipDirectory(dir: string, outPath: string) {
  // Zip contents of target dir so manifest.json is at archive root
  const cmd = ['zip', '-r', '-FS', '-X', outPath, '.', '-x', '*.DS_Store']
  const proc = spawn({ cmd, cwd: dir, stdout: 'inherit', stderr: 'inherit' })
  const code = await proc.exited
  if (code !== 0) throw new Error('zip failed')
}

async function main() {
  const target = process.env.BROWSER || process.env.TARGET || 'chrome'
  const dir = path.resolve('dist', target)
  await ensureManifestPresent(dir)
  const outName = getArchiveName(target)
  const outPath = path.resolve('dist', outName)
  await zipDirectory(dir, outPath)
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
