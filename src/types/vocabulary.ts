export type UUID = string
export type ISODate = string
export type ISODateTime = string

export type StandardCode = 'hsk20' | 'hsk30'
export type HSK20Level = '1' | '2' | '3' | '4' | '5' | '6'
export type HSK30Level = HSK20Level | '7-9'
export type StandardLevel = HSK20Level | HSK30Level
export type Locale = 'en' | 'ru' | 'uz'
export type RightsStatus = 'pending' | 'approved' | 'restricted'
export type VerificationStatus = 'unverified' | 'verified' | 'rejected'
export type TranslationContentKind = 'meaning' | 'example_translation'

export interface DataSource {
  id: UUID
  name: string
  source_url: string
  source_version: string | null
  data_license: string
  license_url: string | null
  attribution_text: string
  share_alike: boolean
  rights_status: RightsStatus
  is_publishable: boolean
  rights_review_notes: string | null
  reviewed_by: string | null
  reviewed_at: ISODateTime | null
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface StandardVersion {
  id: UUID
  standard_code: StandardCode
  version_key: string
  display_name: string
  published_at: ISODate | null
  effective_at: ISODate | null
  source_id: UUID
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface VocabularyItem {
  id: UUID
  simplified: string
  traditional: string | null
  source_id: UUID
  source_entry_key: string | null
  notes: string | null
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface VocabularyReading {
  id: UUID
  vocabulary_item_id: UUID
  pinyin: string
  pinyin_numeric: string | null
  part_of_speech: string | null
  source_id: UUID
  source_entry_key: string | null
  verification_status: VerificationStatus
  reviewed_by: string | null
  reviewed_at: ISODateTime | null
  review_notes: string | null
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface StandardMembership {
  id: UUID
  standard_version_id: UUID
  vocabulary_item_id: UUID
  source_id: UUID
  level_category: StandardLevel
  /** HSK 3.0's combined 7-9 category is stored with level_order 7. */
  level_order: 1 | 2 | 3 | 4 | 5 | 6 | 7
  source_entry_key: string | null
  source_label: string | null
  created_at: ISODateTime
}

export interface Example {
  id: UUID
  vocabulary_item_id: UUID
  reading_id: UUID | null
  sentence_hanzi: string
  sentence_pinyin: string | null
  source_id: UUID
  source_sentence_key: string | null
  source_license_snapshot: string
  verification_status: VerificationStatus
  reviewer_id: UUID | null
  reviewer_name: string | null
  reviewed_at: ISODateTime | null
  review_notes: string | null
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface Translation {
  id: UUID
  vocabulary_item_id: UUID
  reading_id: UUID | null
  example_id: UUID | null
  locale: Locale
  content_kind: TranslationContentKind
  text: string
  source_id: UUID
  source_entry_key: string | null
  source_license_snapshot: string
  verification_status: VerificationStatus
  reviewer_id: UUID | null
  reviewer_name: string | null
  reviewed_at: ISODateTime | null
  review_notes: string | null
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface VocabularyDetails extends VocabularyItem {
  vocabulary_readings: VocabularyReading[]
  examples: Example[]
  translations: Translation[]
}

export interface VocabularySearchResult extends VocabularyItem {
  /** Only verified translations matched by the search are included here. */
  matched_translations: Translation[]
  vocabulary_readings: VocabularyReading[]
}

export interface VocabularyCounts {
  totalItems: number
  totalMemberships: number | null
  byLevel: Partial<Record<StandardLevel, number>>
}

export interface RepositoryError {
  code: string
  message: string
}

export interface RepositoryResult<T> {
  data: T
  error: RepositoryError | null
}
