function normalizeCardPinyin(value: string): string {
  // Keep in sync with dictionaryQuality.normalizeDictionaryPinyin.
  return value.toLowerCase().normalize('NFC').replace(/\s+/g, '')
}

export type LessonCardWord = { hanzi: string; pinyin: string }

/**
 * Preserve every distinct Chinese headword/pronunciation pair while collapsing
 * duplicate source rows, even when their database IDs differ.
 */
export function uniqueLessonCards<T extends LessonCardWord>(words: T[]): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const word of words) {
    const hanzi = word.hanzi.trim().normalize('NFKC')
    const pinyin = normalizeCardPinyin(word.pinyin)
    if (!hanzi || !pinyin) continue
    const key = hanzi + '|' + pinyin
    if (seen.has(key)) continue
    seen.add(key)
    result.push(word)
  }
  return result
}
