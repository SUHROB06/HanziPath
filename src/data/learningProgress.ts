import type { ReviewState } from './spacedRepetition'

export type ExamAttemptSummary = {
  system: '2.0' | '3.0'
  level: number
  score: number
  total: number
  date: string
}

export type LearningProgressSnapshot = {
  version: 1
  knownWords: string[]
  favoriteWordIds: string[]
  activityDays: string[]
  completedLessonIds: string[]
  examHistory: ExamAttemptSummary[]
  reviewSchedule: Record<string, ReviewState>
  dailyTasks: { date: string; done: boolean[] }
  dailyGoalMinutes: number
}

export const emptyLearningProgress = (today: string): LearningProgressSnapshot => ({
  version: 1,
  knownWords: [],
  favoriteWordIds: [],
  activityDays: [],
  completedLessonIds: [],
  examHistory: [],
  reviewSchedule: {},
  dailyTasks: { date: today, done: [false, false, false] },
  dailyGoalMinutes: 20,
})

function union<T>(...lists: T[][]): T[] {
  return [...new Set(lists.flat())]
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function mergeReviewSchedule(
  local: Record<string, ReviewState>,
  remote: Record<string, ReviewState>,
): Record<string, ReviewState> {
  const result: Record<string, ReviewState> = {}
  for (const id of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    const a = local[id]
    const b = remote[id]
    if (!a) result[id] = b
    else if (!b) result[id] = a
    else result[id] = Date.parse(b.updatedAt) > Date.parse(a.updatedAt) ? b : a
  }
  return result
}

export function mergeLearningProgress(
  local: LearningProgressSnapshot,
  remote: Partial<LearningProgressSnapshot> | null | undefined,
  today: string,
): LearningProgressSnapshot {
  if (!remote) return {
    ...local,
    dailyTasks: local.dailyTasks.date === today
      ? local.dailyTasks
      : { date: today, done: [false, false, false] },
  }

  const remoteTasks = remote.dailyTasks
  const localTasks = local.dailyTasks
  const dailyTasks = remoteTasks?.date === today && localTasks.date === today
    ? { date: today, done: [0, 1, 2].map(index => Boolean(remoteTasks.done?.[index] || localTasks.done[index])) }
    : remoteTasks?.date === today
      ? { date: today, done: [0, 1, 2].map(index => Boolean(remoteTasks.done?.[index])) }
      : localTasks.date === today
        ? localTasks
        : { date: today, done: [false, false, false] }

  const attempts = [...(local.examHistory ?? []), ...(remote.examHistory ?? [])]
    .filter(item => item && validDate(item.date))
  const uniqueAttempts = [...new Map(attempts.map(item => [
    [item.system, item.level, item.score, item.total, item.date].join('|'),
    item,
  ])).values()]
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, 50)

  return {
    version: 1,
    knownWords: union(local.knownWords ?? [], remote.knownWords ?? []),
    favoriteWordIds: union(local.favoriteWordIds ?? [], remote.favoriteWordIds ?? []),
    activityDays: union(local.activityDays ?? [], remote.activityDays ?? []).sort().slice(-730),
    completedLessonIds: union(local.completedLessonIds ?? [], remote.completedLessonIds ?? []),
    examHistory: uniqueAttempts,
    reviewSchedule: mergeReviewSchedule(local.reviewSchedule ?? {}, remote.reviewSchedule ?? {}),
    dailyTasks,
    dailyGoalMinutes: Number.isFinite(remote.dailyGoalMinutes)
      ? Math.max(5, Math.min(180, Number(remote.dailyGoalMinutes)))
      : local.dailyGoalMinutes,
  }
}
