import { supabase } from '../supabase'
import type {
  Example,
  RepositoryError,
  RepositoryResult,
  StandardCode,
  StandardLevel,
  StandardMembership,
  StandardVersion,
  Translation,
  VocabularyCounts,
  VocabularyDetails,
  VocabularyItem,
  VocabularyReading,
  VocabularySearchResult,
} from '../types/vocabulary'

const EMPTY_CATALOG_ERROR: RepositoryError = {
  code: 'SUPABASE_NOT_CONFIGURED',
  message: 'Vocabulary catalog is unavailable because Supabase is not configured.',
}

function asRepositoryError(error: unknown): RepositoryError {
  if (error && typeof error === 'object') {
    const candidate = error as { code?: unknown; message?: unknown }
    return {
      code: typeof candidate.code === 'string' ? candidate.code : 'VOCABULARY_QUERY_FAILED',
      message: typeof candidate.message === 'string' ? candidate.message : 'The vocabulary request failed.',
    }
  }
  return { code: 'VOCABULARY_QUERY_FAILED', message: 'The vocabulary request failed.' }
}

function failed<T>(data: T, error: unknown): RepositoryResult<T> {
  return { data, error: asRepositoryError(error) }
}

function escapeLike(value: string): string {
  // Prevent user-provided PostgREST filter syntax from changing the query structure.
  return value.replace(/[\\%_(),.]/g, character => `\\${character}`)
}

function unique<T extends { id: string }>(rows: T[]): T[] {
  return [...new Map(rows.map(row => [row.id, row])).values()]
}

/**
 * Searches simplified/traditional characters, pinyin, and approved translations.
 * Translation matches are intentionally restricted to verification_status=verified.
 */
export async function searchVocabulary(
  searchText: string,
  options: { limit?: number; locale?: 'en' | 'ru' | 'uz' } = {},
): Promise<RepositoryResult<VocabularySearchResult[]>> {
  if (!supabase) return failed([], EMPTY_CATALOG_ERROR)
  const term = searchText.trim()
  if (!term) return { data: [], error: null }

  try {
    const pattern = `%${escapeLike(term)}%`
    const limit = Math.max(1, Math.min(options.limit ?? 50, 100))
    const [itemsResponse, readingsResponse, translationsResponse] = await Promise.all([
      supabase.from('vocabulary_items').select('*')
        .or(`simplified.ilike.${pattern},traditional.ilike.${pattern}`).limit(limit),
      supabase.from('vocabulary_readings').select('*').ilike('pinyin', pattern).limit(limit),
      (() => {
        let query = supabase.from('translations').select('*')
          .eq('verification_status', 'verified').ilike('text', pattern)
        if (options.locale) query = query.eq('locale', options.locale)
        return query.limit(limit)
      })(),
    ])

    const queryError = itemsResponse.error ?? readingsResponse.error ?? translationsResponse.error
    if (queryError) return failed([], queryError)

    const translations = (translationsResponse.data ?? []) as Translation[]
    const readingMatches = (readingsResponse.data ?? []) as VocabularyReading[]
    const ids = new Set<string>([
      ...((itemsResponse.data ?? []) as VocabularyItem[]).map(item => item.id),
      ...readingMatches.map(reading => reading.vocabulary_item_id),
      ...translations.filter(row => row.verification_status === 'verified').map(row => row.vocabulary_item_id),
    ])
    if (ids.size === 0) return { data: [], error: null }

    const detailsResponse = await supabase.from('vocabulary_items')
      .select('*, vocabulary_readings(*), translations(*)')
      .in('id', [...ids]).limit(limit)
    if (detailsResponse.error) return failed([], detailsResponse.error)

    const translationMatchesByItem = new Map<string, Translation[]>()
    for (const translation of translations) {
      // Keep this guard even though the database query filters by verification status.
      if (translation.verification_status !== 'verified') continue
      const matches = translationMatchesByItem.get(translation.vocabulary_item_id) ?? []
      matches.push(translation)
      translationMatchesByItem.set(translation.vocabulary_item_id, matches)
    }

    const results = ((detailsResponse.data ?? []) as Array<VocabularyItem & {
      vocabulary_readings?: VocabularyReading[] | null
      translations?: Translation[] | null
    }>).map(item => ({
      ...item,
      vocabulary_readings: item.vocabulary_readings ?? [],
      matched_translations: translationMatchesByItem.get(item.id) ?? [],
    }))
    return { data: results, error: null }
  } catch (error) {
    return failed([], error)
  }
}

/** Retrieves a catalog item and its associated readings, examples, and translations. */
export async function getVocabularyDetails(
  vocabularyItemId: string,
): Promise<RepositoryResult<VocabularyDetails | null>> {
  if (!supabase) return failed(null, EMPTY_CATALOG_ERROR)
  if (!vocabularyItemId.trim()) {
    return failed(null, { code: 'INVALID_VOCABULARY_ID', message: 'A vocabulary item ID is required.' })
  }

  try {
    const { data, error } = await supabase.from('vocabulary_items')
      .select('*, vocabulary_readings(*), examples(*), translations(*)')
      .eq('id', vocabularyItemId).maybeSingle()
    if (error) return failed(null, error)
    if (!data) return { data: null, error: null }

    const row = data as VocabularyItem & {
      vocabulary_readings?: VocabularyReading[] | null
      examples?: Example[] | null
      translations?: Translation[] | null
    }
    return {
      data: {
        ...row,
        vocabulary_readings: row.vocabulary_readings ?? [],
        examples: row.examples ?? [],
        // Status is retained as stored; callers must inspect it before presenting as verified.
        translations: row.translations ?? [],
      },
      error: null,
    }
  } catch (error) {
    return failed(null, error)
  }
}

/** Filters items through explicit membership in a selected standard version and level. */
export async function filterVocabularyByStandardAndLevel(
  standardVersionId: string,
  level?: StandardLevel,
): Promise<RepositoryResult<VocabularyItem[]>> {
  if (!supabase) return failed([], EMPTY_CATALOG_ERROR)
  if (!standardVersionId.trim()) {
    return failed([], { code: 'INVALID_STANDARD_VERSION_ID', message: 'A standard version ID is required.' })
  }

  try {
    let query = supabase.from('standard_memberships')
      .select('vocabulary_items!inner(*)')
      .eq('standard_version_id', standardVersionId)
    if (level) query = query.eq('level_category', level)
    const { data, error } = await query
    if (error) return failed([], error)
    const items = (data ?? []).flatMap((membership: { vocabulary_items?: VocabularyItem | VocabularyItem[] | null }) => {
      if (!membership.vocabulary_items) return []
      return Array.isArray(membership.vocabulary_items) ? membership.vocabulary_items : [membership.vocabulary_items]
    })
    return { data: unique(items), error: null }
  } catch (error) {
    return failed([], error)
  }
}

/** Returns published standards known to the catalog; an empty catalog returns []. */
export async function getStandardVersions(
  standardCode?: StandardCode,
): Promise<RepositoryResult<StandardVersion[]>> {
  if (!supabase) return failed([], EMPTY_CATALOG_ERROR)
  try {
    let query = supabase.from('standard_versions').select('*').order('standard_code').order('version_key')
    if (standardCode) query = query.eq('standard_code', standardCode)
    const { data, error } = await query
    if (error) return failed([], error)
    return { data: (data ?? []) as StandardVersion[], error: null }
  } catch (error) {
    return failed([], error)
  }
}

/** Counts catalog items and, when selected, memberships grouped by stored level category. */
export async function getVocabularyCounts(
  standardVersionId?: string,
): Promise<RepositoryResult<VocabularyCounts>> {
  const emptyCounts: VocabularyCounts = { totalItems: 0, totalMemberships: null, byLevel: {} }
  if (!supabase) return failed(emptyCounts, EMPTY_CATALOG_ERROR)

  try {
    const itemCountResponse = await supabase.from('vocabulary_items').select('id', { count: 'exact', head: true })
    if (itemCountResponse.error) return failed(emptyCounts, itemCountResponse.error)
    const counts: VocabularyCounts = {
      totalItems: itemCountResponse.count ?? 0,
      totalMemberships: null,
      byLevel: {},
    }
    if (!standardVersionId) return { data: counts, error: null }

    const membershipResponse = await supabase.from('standard_memberships')
      .select('level_category', { count: 'exact' }).eq('standard_version_id', standardVersionId)
    if (membershipResponse.error) return failed(emptyCounts, membershipResponse.error)
    counts.totalMemberships = membershipResponse.count ?? 0
    for (const membership of (membershipResponse.data ?? []) as Array<{ level_category: StandardLevel }>) {
      counts.byLevel[membership.level_category] = (counts.byLevel[membership.level_category] ?? 0) + 1
    }
    return { data: counts, error: null }
  } catch (error) {
    return failed(emptyCounts, error)
  }
}

// Keep this import used in strict TypeScript builds where query inference is loose.
export type { StandardMembership }
