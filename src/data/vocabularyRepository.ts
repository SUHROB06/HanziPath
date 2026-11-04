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

// Keyset pages are deliberately small and bounded below PostgREST's common default maximum.
const PAGE_SIZE = 100
const DEFAULT_SEARCH_LIMIT = 50
const MAX_SEARCH_LIMIT = 100
const INCOMPLETE_PAGE_ERROR: RepositoryError = {
  code: 'INCOMPLETE_PAGINATED_RESULT',
  message: 'The vocabulary query returned an incomplete or changing page; results may not be safely represented.',
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

function normalizePinyin(value: string): string {
  return value.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300\u0301\u0304\u030C]/g, '')
    .replace(/[1-5\s]/g, '')
}

function unique<T extends { id: string }>(rows: T[]): T[] {
  return [...new Map(rows.map(row => [row.id, row])).values()]
}

/**
 * Fetch rows in ascending unique-ID keyset pages. Each response includes an exact
 * count for the current cursor's remaining rows; count/page mismatches fail closed.
 * Inserts or deletes with IDs at/before the cursor cannot shift later pages. Changes
 * after the cursor during a scan are detected by the remaining-count check and return
 * an error instead of potentially inaccurate partial results. The query must select
 * a unique `id`, order ascending by that ID, and apply `gt('id', cursor)` when present.
 */
async function fetchAllPages<T extends { id: string }>(
  queryPage: (cursor: string | null, limit: number) => any,
): Promise<RepositoryResult<T[]>> {
  const rows: T[] = []
  let cursor: string | null = null
  let expectedRemaining: number | null = null

  try {
    while (true) {
      const { data, error, count } = await queryPage(cursor, PAGE_SIZE)
      if (error) return failed([], error)
      if (typeof count !== 'number') {
        return failed([], { code: 'MISSING_EXACT_COUNT', message: 'The database did not return an exact row count.' })
      }
      if (expectedRemaining === null) expectedRemaining = count
      else if (count !== expectedRemaining) return failed([], INCOMPLETE_PAGE_ERROR)

      const page = (data ?? []) as T[]
      const expectedPageSize = Math.min(PAGE_SIZE, expectedRemaining)
      if (page.length !== expectedPageSize) return failed([], INCOMPLETE_PAGE_ERROR)
      if (page.length === 0) break

      const pageIds = new Set(page.map(row => row.id))
      if (pageIds.size !== page.length || (cursor !== null && page[0].id <= cursor)) {
        return failed([], INCOMPLETE_PAGE_ERROR)
      }
      rows.push(...page)
      cursor = page[page.length - 1].id
      expectedRemaining -= page.length
      if (expectedRemaining === 0) break
    }
    return { data: rows, error: null }
  } catch (error) {
    return failed([], error)
  }
}

/**
 * Apply a cursor and page size to a PostgREST query whose ordering is ascending unique ID.
 * All repository callers use UUID primary keys for this stable keyset.
 */
function keysetPage(query: any, cursor: string | null, limit: number): any {
  const afterCursor = cursor === null ? query : query.gt('id', cursor)
  return afterCursor.order('id', { ascending: true }).limit(limit)
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
  const client = supabase
  const term = searchText.trim()
  if (!term) return { data: [], error: null }

  try {
    const pattern = `%${escapeLike(term)}%`
    const normalizedTerm = normalizePinyin(term)
    const requestedLimit = options.limit ?? DEFAULT_SEARCH_LIMIT
    const resultLimit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(Math.floor(requestedLimit), MAX_SEARCH_LIMIT))
      : DEFAULT_SEARCH_LIMIT

    const [itemMatches, readingMatches, translationMatches] = await Promise.all([
      fetchAllPages<VocabularyItem>((cursor, limit) => keysetPage(client.from('vocabulary_items')
        .select('*', { count: 'exact' })
        .or(`simplified.ilike.${pattern},traditional.ilike.${pattern}`), cursor, limit)),
      fetchAllPages<VocabularyReading>((cursor, limit) => keysetPage(client.from('vocabulary_readings')
        .select('*', { count: 'exact' }), cursor, limit)),
      fetchAllPages<Translation>((cursor, limit) => {
        let query = client.from('translations').select('*', { count: 'exact' })
          .eq('verification_status', 'verified').ilike('text', pattern)
        if (options.locale) query = query.eq('locale', options.locale)
        return keysetPage(query, cursor, limit)
      }),
    ])

    const queryError = itemMatches.error ?? readingMatches.error ?? translationMatches.error
    if (queryError) return failed([], queryError)

    const matchingReadings = normalizedTerm
      ? readingMatches.data.filter(reading => normalizePinyin(reading.pinyin).includes(normalizedTerm))
      : []
    const matchedTranslations = translationMatches.data
    const candidates = new Set<string>([
      ...itemMatches.data.map(item => item.id),
      ...matchingReadings.map(reading => reading.vocabulary_item_id),
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
      const { data, error } = await client.from('vocabulary_items')
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
  const client = supabase

  try {
    const itemCountResponse = await client.from('vocabulary_items').select('id', { count: 'exact', head: true })
    if (itemCountResponse.error) return failed(emptyCounts, itemCountResponse.error)
    const counts: VocabularyCounts = {
      totalItems: itemCountResponse.count ?? 0,
      totalMemberships: null,
      byLevel: {},
    }
    if (!standardVersionId) return { data: counts, error: null }

    const memberships = await fetchAllPages<{ id: string; level_category: StandardLevel }>((cursor, limit) =>
      keysetPage(client.from('standard_memberships').select('id, level_category', { count: 'exact' })
        .eq('standard_version_id', standardVersionId), cursor, limit),
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
