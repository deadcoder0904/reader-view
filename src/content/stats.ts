import prettyMs from 'pretty-ms'

export type ReaderStats = {
  words: number
  chars: number
  readTime: string
  speakTime: string
}

export function getReaderStatsFromText(rawText: string): ReaderStats {
  const trimmedText = rawText.trim()
  const words = trimmedText.length === 0 ? 0 : trimmedText.split(/\s+/).length
  const chars = rawText.length
  const readMs = (words / 200) * 60 * 1000
  const speakMs = (words / 150) * 60 * 1000

  return {
    words,
    chars,
    readTime: formatCompactTime(readMs, words, 'read'),
    speakTime: formatCompactTime(speakMs, words, 'speak'),
  }
}

export function formatVerboseTime(ms: number, words: number, label: 'read' | 'speak') {
  if (words === 0) return '-'
  if (ms < 60_000) return `<1 min ${label}`

  const compact = prettyMs(ms, { unitCount: 1 })
  const match = compact.match(/^(\d+(?:\.\d+)?)([a-z]+)$/i)
  if (!match) return `~${compact} ${label}`

  const [, value, unit] = match
  const unitMap: Record<string, string> = {
    ms: 'ms',
    s: 'sec',
    m: 'min',
    h: 'hr',
    d: 'day',
  }

  return `~${value} ${unitMap[unit] ?? unit} ${label}`
}

export function formatCompactTime(ms: number, words: number, label: 'read' | 'speak') {
  if (words === 0) return '-'
  if (ms < 60_000) return '<1m'

  const formatted = formatVerboseTime(ms, words, label)
  const match = formatted.match(/~?(\d+(?:\.\d+)?)\s*(min|hr|day|sec|ms)\s+(?:read|speak)$/i)
  if (!match) return formatted

  const [, value, unit] = match
  const compactUnits: Record<string, string> = {
    min: 'm',
    hr: 'h',
    day: 'd',
    sec: 's',
    ms: 'ms',
  }
  return `${value}${compactUnits[unit.toLowerCase()] ?? unit}`
}
