export type DictionaryQualityEntry = {
  sourceEntryKey?: string
  hanzi: string
  pinyin: string
  ru: string
  en: string
  uz?: string | null
  level20: number | string | null
  level30: number | string | null
  level20Memberships?: Array<number | string>
  level30Memberships?: Array<number | string>
  legacyIds?: string[]
  example?: string
  examplePinyin?: string
  exampleRu?: string
  exampleEn?: string
  exampleUz?: string | null
  partOfSpeech?: string[]
  frequencyRank?: number | null
  exampleSource?: string
  exampleSourceId?: string
  exampleLicense?: string
  exampleStatus?: string
  translationSource?: string
  translationLicense?: string
  membershipSource?: string
  definitionSource?: string
  dataLicense?: string
  pinyinNum?: string
}

export function normalizeDictionaryPinyin(value: string): string {
  // Tone marks are phonemic in Mandarin. Keep them in the identity key so
  // words such as mǎi and mài are never collapsed into one dictionary entry.
  return value.toLowerCase().normalize('NFC').replace(/\s+/g, '')
}

function mergeText(a: string | null | undefined, b: string | null | undefined): string {
  const values = [...new Set([a, b].filter((value): value is string => Boolean(value?.trim())))]
  return values.join(' / ')
}

function mergeMemberships(
  a: Array<number | string> | undefined,
  b: Array<number | string> | undefined,
  scalarA: number | string | null,
  scalarB: number | string | null,
): Array<number | string> {
  return [...new Map(
    [...(a ?? (scalarA == null ? [] : [scalarA])), ...(b ?? (scalarB == null ? [] : [scalarB]))]
      .filter(value => value !== '')
      .map(value => [String(value), value] as const),
  ).values()].sort((left, right) => {
    const aNum = Number(String(left).replace('7-9', '7'))
    const bNum = Number(String(right).replace('7-9', '7'))
    return aNum - bNum
  })
}

/**
 * Collapse repeated character/reading rows into one dictionary entry while
 * preserving all HSK memberships, alternate glosses, and old progress IDs.
 * Different readings remain separate entries.
 */
export function mergeDictionaryEntries<T extends DictionaryQualityEntry>(entries: T[]): T[] {
  const merged = new Map<string, T>()

  for (const entry of entries) {
    const key = `${entry.hanzi.trim()}|${normalizeDictionaryPinyin(entry.pinyin)}`
    const previous = merged.get(key)

    if (!previous) {
      const level20Memberships = mergeMemberships(undefined, entry.level20Memberships, entry.level20, null)
      const level30Memberships = mergeMemberships(undefined, entry.level30Memberships, entry.level30, null)
      merged.set(key, {
        ...entry,
        sourceEntryKey: `dictionary:${key}`,
        level20Memberships,
        level30Memberships,
        legacyIds: [...new Set([...(entry.legacyIds ?? []), ...(entry.sourceEntryKey ? [entry.sourceEntryKey] : [])])],
      })
      continue
    }

    const level20Memberships = mergeMemberships(
      previous.level20Memberships,
      entry.level20Memberships,
      previous.level20,
      entry.level20,
    )
    const level30Memberships = mergeMemberships(
      previous.level30Memberships,
      entry.level30Memberships,
      previous.level30,
      entry.level30,
    )

    merged.set(key, {
      ...previous,
      ru: mergeText(previous.ru, entry.ru),
      en: mergeText(previous.en, entry.en),
      uz: mergeText(previous.uz, entry.uz) || null,
      level20: level20Memberships[0] ?? null,
      level30: level30Memberships[0] ?? null,
      level20Memberships,
      level30Memberships,
      example: previous.example || entry.example || '',
      examplePinyin: previous.examplePinyin || entry.examplePinyin || '',
      exampleRu: previous.exampleRu || entry.exampleRu || '',
      exampleEn: previous.exampleEn || entry.exampleEn || '',
      exampleUz: previous.exampleUz || entry.exampleUz || null,
      exampleSource: previous.exampleSource || entry.exampleSource,
      exampleSourceId: previous.exampleSourceId || entry.exampleSourceId,
      exampleLicense: previous.exampleLicense || entry.exampleLicense,
      exampleStatus: previous.exampleStatus || entry.exampleStatus,
      partOfSpeech: [...new Set([...(previous.partOfSpeech ?? []), ...(entry.partOfSpeech ?? [])])].sort(),
      frequencyRank: previous.frequencyRank == null ? entry.frequencyRank ?? null
        : entry.frequencyRank == null ? previous.frequencyRank
          : Math.min(previous.frequencyRank, entry.frequencyRank),
      translationSource: previous.translationSource || entry.translationSource,
      translationLicense: previous.translationLicense || entry.translationLicense,
      membershipSource: previous.membershipSource || entry.membershipSource,
      definitionSource: previous.definitionSource || entry.definitionSource,
      dataLicense: previous.dataLicense || entry.dataLicense,
      pinyinNum: previous.pinyinNum || entry.pinyinNum,
      legacyIds: [...new Set([
        ...(previous.legacyIds ?? []),
        ...(entry.legacyIds ?? []),
        ...(entry.sourceEntryKey ? [entry.sourceEntryKey] : []),
      ])],
    })
  }

  return [...merged.values()]
}

export function auditDictionaryEntries(entries: DictionaryQualityEntry[]) {
  const merged = mergeDictionaryEntries(entries)
  const hasTone = (pinyin: string) =>
    /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i.test(pinyin) || /[1-5]/.test(pinyin)

  return {
    rows: entries.length,
    uniqueEntries: merged.length,
    duplicateRowsCollapsed: entries.length - merged.length,
    missingHanzi: entries.filter(entry => !entry.hanzi?.trim()).length,
    missingPinyin: entries.filter(entry => !entry.pinyin?.trim()).length,
    pinyinWithoutTone: entries.filter(entry => entry.pinyin?.trim() && !hasTone(entry.pinyin)).length,
    missingRussian: entries.filter(entry => !entry.ru?.trim()).length,
    missingEnglish: entries.filter(entry => !entry.en?.trim()).length,
    missingUzbek: entries.filter(entry => !entry.uz?.trim()).length,
    missingExamples: entries.filter(entry => !entry.example?.trim()).length,
  }
}
