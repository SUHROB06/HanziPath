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

// Keep pages below PostgREST's common default maximum and verify every page against
// the exact count, so a lower configured server limit cannot silently skip rows.
const PAGE_SIZE = 100
const DEFAULT_SEARCH_LIMIT = 50
const MAX_SEARCH_LIMIT = 100
const INCOMPLETE_PAGE_ERROR: RepositoryError = {
  code: 'INCOMPLETE_PAGINATED_RESULT',
  message: 'The vocabulary query returned an incomplete page; results may not be safely represented.',
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

/** Fetch all rows in stable pages. Exact-count mismatches return an error, never partial data. */
async function fetchAllPages<T>(
  queryPage: (from: number, to: number) => any,
): Promise<RepositoryResult<T[]>> {
  const rows: T[] = []
  let total: number | null = null

  try {
    for (let offset = 0; total === null || offset < total; offset += PAGE_SIZE) {
      const { data, error, count } = await queryPage(offset, offset + PAGE_SIZE - 1)
      if (error) return failed([], error)
      if (total === null) {
        if (typeof count !== 'number') {
          return failed([], { code: 'MISSING_EXACT_COUNT', message: 'The database did not return an exact row count.' })
        }
        total = count
      }

      const page = (data ?? []) as T[]
      const expectedRows = Math.min(PAGE_SIZE, total - offset)
      if (page.length !== expectedRows) return failed([], INCOMPLETE_PAGE_ERROR)
      rows.push(...page)
    }
    return { data: rows, error: null }
  } catch (error) {
    return failed([], error)
  }
}

/**
 * Searches simplified/traditional characters, pinyin, and verified translations.
 * Candidate rows are fully paginated, then sorted by vocabulary UUID and capped at
 * the explicit result limit (default 50, maximum 100). The same ordering is used
 * for detail retrieval, so the selected result set is deterministic.
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
    const requestedLimit = options.limit ?? DEFAULT_SEARCH_LIMIT
    const resultLimit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(Math.floor(requestedLimit), MAX_SEARCH_LIMIT))
      : DEFAULT_SEARCH_LIMIT

    const [itemMatches, readingMatches, translationMatches] = await Promise.all([
      fetchAllPages<VocabularyItem>((from, to) => supabase.from('vocabulary_items')
        .select('*', { count: 'exact' })
        .or(`simplified.ilike.${pattern},traditional.ilike.${pattern}`)
        .order('id', { ascending: true }).range(from, to)),
      fetchAllPages<VocabularyReading>((from, to) => supabase.from('vocabulary_readings')
        .select('*', { count: 'exact' }).ilike('pinyin', pattern)
        .order('id', { ascending: true }).range(from, to)),
      fetchAllPages<Translation>((from, to) => {
        let query = supabase.from('translations').select('*', { count: 'exact' })
          .eq('verification_status', 'verified').ilike('text', pattern)
        if (options.locale) query = query.eq('locale', options.locale)
        return query.order('id', { ascending: true }).range(from, to)
      }),
    ])

    const queryError = itemMatches.error ?? readingMatches.error ?? translationMatches.error
    if (queryError) return failed([], queryError)

    const matchedTranslations = translationMatches.data
    const candidates = new Set<string>([
      ...itemMatches.data.map(item => item.id),
      ...readingMatches.data.map(reading => reading.vocabulary_item_id),
      ...matchedTranslations
        .filter(translation => translation.verification_status === 'verified')
        .map(translation => translation.vocabulary_item_id),
    ])
    const selectedIds = [...candidates].sort((a, b) => a.localeCompare(b)).slice(0, resultLimit)
    if (selectedIds.length === 0) return { data: [], error: null }

    const detailRows: Array<VocabularyItem & {
      vocabulary_readings?: VocabularyReading[] | null
      translations?: Translation[] | null
    }> = []
    // Batch the explicit, stable ID list; all matching IDs were collected above before
    // applying the documented result cap, so no page-boundary omission is silent.
    for (let offset = 0; offset < selectedIds.length; offset += PAGE_SIZE) {
      const ids = selectedIds.slice(offset, offset + PAGE_SIZE)
      const { data, error } = await supabase.from('vocabulary_items')
        .select('*, vocabulary_readings(*), translations(*)')
        .eq('translations.verification_status', 'verified')
        .in('id', ids)
        .order('id', { ascending: true })
      if (error) return failed([], error)
      const rows = (data ?? []) as typeof detailRows
      if (rows.length !== ids.length) return failed([], INCOMPLETE_PAGE_ERROR)
      detailRows.push(...rows)
    }

    const verifiedMatchesByItem = new Map<string, Translation[]>()
    for (const translation of matchedTranslations) {
      if (translation.verification_status !== 'verified') continue
      const matches = verifiedMatchesByItem.get(translation.vocabulary_item_id) ?? []
      matches.push(translation)
      verifiedMatchesByItem.set(translation.vocabulary_item_id, matches)
    }

    const detailsById = new Map(detailRows.map(row => [row.id, row]))
    const results: VocabularySearchResult[] = []
    for (const id of selectedIds) {
      const row = detailsById.get(id)
      if (!row) return failed([], INCOMPLETE_PAGE_ERROR)
      // Defense in depth: only verified translations are returned, even if a future
      // query change or unexpected response includes other statuses.
      const { translations, ...item } = row
      const verifiedNestedTranslations = (translations ?? [])
        .filter(translation => translation.verification_status === 'verified')
      results.push({
        ...item,
        vocabulary_readings: row.vocabulary_readings ?? [],
        translations: verifiedNestedTranslations,
        matched_translations: verifiedMatchesByItem.get(id) ?? [],
      } as VocabularySearchResult)
    }
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

    const memberships = await fetchAllPages<{ id: string; level_category: StandardLevel }>((from, to) =>
      supabase.from('standard_memberships').select('id, level_category', { count: 'exact' })
        .eq('standard_version_id', standardVersionId)
        .order('id', { ascending: true }).range(from, to),
    )
    if (memberships.error) return failed(emptyCounts, memberships.error)
    counts.totalMemberships = memberships.data.length
    for (const membership of memberships.data) {
      counts.byLevel[membership.level_category] = (counts.byLevel[membership.level_category] ?? 0) + 1
    }
    return { data: counts, error: null }
  } catch (error) {
    return failed(emptyCounts, error)
  }
}

// Keep this import used in strict TypeScript builds where query inference is loose.
export type { StandardMembership }
