import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { transform } from 'esbuild'

async function loadTypeScriptModule(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
  const { code } = await transform(source, { loader: 'ts', format: 'esm', target: 'node18' })
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
}

const spaced = await loadTypeScriptModule('../src/data/spacedRepetition.ts')
const base = new Date('2026-11-17T10:00:00.000Z')

const firstGood = spaced.scheduleReview(undefined, 'good', base)
assert.equal(firstGood.repetitions, 1)
assert.equal(firstGood.intervalDays, 1)
assert.equal(Date.parse(firstGood.dueAt), base.getTime() + 86400000)

const secondGood = spaced.scheduleReview(firstGood, 'good', new Date(firstGood.dueAt))
assert.equal(secondGood.repetitions, 2)
assert.equal(secondGood.intervalDays, 3)

const again = spaced.scheduleReview(secondGood, 'again', base)
assert.equal(again.repetitions, 0)
assert.equal(again.lapses, 1)
assert.equal(Date.parse(again.dueAt), base.getTime() + 10 * 60 * 1000)

const easy = spaced.scheduleReview(secondGood, 'easy', base)
assert.ok(easy.easeFactor > secondGood.easeFactor)
assert.ok(easy.intervalDays > secondGood.intervalDays)

const due = spaced.dueReviewIds({
  due: { ...firstGood, dueAt: '2026-11-17T09:00:00.000Z' },
  future: { ...firstGood, dueAt: '2026-11-18T09:00:00.000Z' },
}, base)
assert.deepEqual(due, ['due'])

assert.equal(spaced.adaptiveDifficulty({}), 1)
const strongSchedule = Object.fromEntries(Array.from({ length: 5 }, (_, index) => [
  String(index),
  { ...firstGood, recentQualities: [5, 5, 5, 5, 5] },
]))
assert.equal(spaced.adaptiveDifficulty(strongSchedule), 3)

const progress = await loadTypeScriptModule('../src/data/learningProgress.ts')
const today = '2026-11-17'
const local = progress.emptyLearningProgress(today)
local.knownWords = ['a']
local.favoriteWordIds = ['a']
local.activityDays = [today]
local.completedLessonIds = ['lesson-a']
local.dailyTasks.done = [true, false, false]
local.dailyReviewCount = { date: today, count: 3 }
const remote = {
  knownWords: ['b'],
  favoriteWordIds: ['b'],
  activityDays: ['2026-11-16'],
  completedLessonIds: ['lesson-b'],
  dailyTasks: { date: today, done: [false, true, false] },
  dailyReviewCount: { date: today, count: 5 },
  examHistory: [
    { system: '2.0', level: 1, score: 18, total: 20, date: '2026-11-16T10:00:00.000Z' },
  ],
}
const merged = progress.mergeLearningProgress(local, remote, today)
assert.deepEqual(merged.knownWords.sort(), ['a', 'b'])
assert.deepEqual(merged.completedLessonIds.sort(), ['lesson-a', 'lesson-b'])
assert.deepEqual(merged.dailyTasks.done, [true, true, false])
assert.equal(merged.dailyReviewCount.count, 5)
assert.equal(merged.examHistory.length, 1)

const dataset = JSON.parse(await readFile(new URL('../public/vocabulary-review.json', import.meta.url), 'utf8'))
const entries = Array.isArray(dataset.entries) ? dataset.entries : []
const missing = Object.fromEntries(['hanzi', 'pinyin', 'ru', 'en', 'uz'].map(key => [
  key,
  entries.filter(entry => !String(entry[key] ?? '').trim()).length,
]))
const missingExamples = entries.filter(entry => !String(entry.example ?? '').trim()).length
const unverified = entries.filter(entry => entry.membershipStatus !== 'verified').length

console.log('Learning logic tests passed.')
console.log(JSON.stringify({
  dictionaryCandidateRows: entries.length,
  missingCoreFields: missing,
  missingExamples,
  unverifiedMemberships: unverified,
}, null, 2))
