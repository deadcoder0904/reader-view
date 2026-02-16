import { describe, expect, it } from 'bun:test'
import { formatCompactTime, formatVerboseTime, getReaderStatsFromText } from '../stats'

describe('reader stats', () => {
  it('returns zeros and dash times for empty text', () => {
    const stats = getReaderStatsFromText('')
    expect(stats.words).toBe(0)
    expect(stats.chars).toBe(0)
    expect(stats.readTime).toBe('-')
    expect(stats.speakTime).toBe('-')
  })

  it('counts words and characters (with spaces) from raw body text', () => {
    const stats = getReaderStatsFromText('Hello world\nThis is a test.')
    expect(stats.words).toBe(6)
    expect(stats.chars).toBe('Hello world\nThis is a test.'.length)
  })

  it('formats compact read/speak times using expected rates', () => {
    const nineMinRead = 1801
    const stats = getReaderStatsFromText(`word `.repeat(nineMinRead).trim())
    expect(stats.readTime).toBe('9m')
    expect(stats.speakTime).toBe('12m')
  })

  it('uses <1m for short but non-zero content', () => {
    const stats = getReaderStatsFromText('a b c d')
    expect(stats.readTime).toBe('<1m')
    expect(stats.speakTime).toBe('<1m')
  })

  it('keeps verbose formatter parity with word-counter logic', () => {
    expect(formatVerboseTime((200 / 200) * 60 * 1000, 200, 'read')).toBe('~1 min read')
    expect(formatCompactTime((200 / 200) * 60 * 1000, 200, 'read')).toBe('1m')
  })
})
