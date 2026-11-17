export type ReviewQuality = 'again' | 'hard' | 'good' | 'easy'

export type ReviewState = {
  repetitions: number
  intervalDays: number
  easeFactor: number
  dueAt: string
  lastReviewedAt: string
  lapses: number
  correctStreak: number
  recentQualities: number[]
  lastQuality: number
  updatedAt: string
}

const qualityScore: Record<ReviewQuality, number> = {
  again: 1,
  hard: 3,
  good: 4,
  easy: 5,
}

export function scheduleReview(
  previous: ReviewState | undefined,
  quality: ReviewQuality,
  now = new Date(),
): ReviewState {
  const score = qualityScore[quality]
  const old = previous ?? {
    repetitions: 0,
    intervalDays: 0,
    easeFactor: 2.5,
    dueAt: now.toISOString(),
    lastReviewedAt: now.toISOString(),
    lapses: 0,
    correctStreak: 0,
    recentQualities: [],
    lastQuality: 0,
    updatedAt: now.toISOString(),
  }

  const easeFactor = Math.max(
    1.3,
    old.easeFactor + (0.1 - (5 - score) * (0.08 + (5 - score) * 0.02)),
  )

  let repetitions = old.repetitions
  let intervalDays = old.intervalDays
  let dueAt: Date

  if (quality === 'again') {
    repetitions = 0
    intervalDays = 0
    dueAt = new Date(now.getTime() + 10 * 60 * 1000)
  } else if (quality === 'hard') {
    repetitions += 1
    intervalDays = Math.max(1, Math.round((intervalDays || 1) * 1.2))
    dueAt = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000)
  } else {
    repetitions += 1
    if (repetitions === 1) intervalDays = quality === 'easy' ? 4 : 1
    else if (repetitions === 2) intervalDays = quality === 'easy' ? 7 : 3
    else intervalDays = Math.max(1, Math.round((intervalDays || 3) * easeFactor * (quality === 'easy' ? 1.3 : 1)))
    dueAt = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000)
  }

  const recentQualities = [...old.recentQualities, score].slice(-10)
  return {
    repetitions,
    intervalDays,
    easeFactor,
    dueAt: dueAt.toISOString(),
    lastReviewedAt: now.toISOString(),
    lapses: old.lapses + (quality === 'again' ? 1 : 0),
    correctStreak: quality === 'again' ? 0 : old.correctStreak + 1,
    recentQualities,
    lastQuality: score,
    updatedAt: now.toISOString(),
  }
}

export function dueReviewIds(
  schedule: Record<string, ReviewState>,
  now = new Date(),
): string[] {
  const timestamp = now.getTime()
  return Object.entries(schedule)
    .filter(([, state]) => Date.parse(state.dueAt) <= timestamp)
    .sort((a, b) => Date.parse(a[1].dueAt) - Date.parse(b[1].dueAt))
    .map(([id]) => id)
}

export function adaptiveDifficulty(
  schedule: Record<string, ReviewState>,
): 1 | 2 | 3 {
  const recent = Object.values(schedule).flatMap(item => item.recentQualities).slice(-30)
  if (recent.length < 5) return 1
  const average = recent.reduce((sum, score) => sum + score, 0) / recent.length
  if (average >= 4.5) return 3
  if (average >= 3.5) return 2
  return 1
}
