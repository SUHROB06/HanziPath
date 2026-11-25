import type { CourseLevel, CourseSystem } from './curriculum'

export type ExamFormat = {
  listening: number; listeningParts: number[]
  reading: number; readingParts: number[]
  writing: number; writingParts: number[]
  translation: number; translationParts: number[]
  speaking: number; speakingParts: number[]
  minutes: number
}

// HSK 2.0 is the legacy six-level paper. HSK 3.0 uses CTI's published
// 2026 sample-paper structure for levels 1–6 and the five-skill 7–9 paper.
const examFormats: Record<string, ExamFormat> = {
  '2.0:1': { listening: 20, listeningParts: [5, 5, 5, 5], reading: 20, readingParts: [5, 5, 5, 5], writing: 0, writingParts: [], translation: 0, translationParts: [], speaking: 0, speakingParts: [], minutes: 40 },
  '2.0:2': { listening: 35, listeningParts: [10, 10, 10, 5], reading: 25, readingParts: [5, 5, 5, 10], writing: 0, writingParts: [], translation: 0, translationParts: [], speaking: 0, speakingParts: [], minutes: 55 },
  '2.0:3': { listening: 40, listeningParts: [10, 10, 10, 10], reading: 30, readingParts: [10, 10, 10], writing: 10, writingParts: [5, 5], translation: 0, translationParts: [], speaking: 0, speakingParts: [], minutes: 90 },
  '2.0:4': { listening: 45, listeningParts: [10, 15, 20], reading: 40, readingParts: [10, 10, 20], writing: 15, writingParts: [10, 5], translation: 0, translationParts: [], speaking: 0, speakingParts: [], minutes: 105 },
  '2.0:5': { listening: 45, listeningParts: [20, 25], reading: 45, readingParts: [15, 10, 20], writing: 10, writingParts: [8, 2], translation: 0, translationParts: [], speaking: 0, speakingParts: [], minutes: 125 },
  '2.0:6': { listening: 50, listeningParts: [15, 15, 20], reading: 50, readingParts: [10, 10, 10, 20], writing: 1, writingParts: [1], translation: 0, translationParts: [], speaking: 0, speakingParts: [], minutes: 140 },
  '3.0:1': { listening: 20, listeningParts: [5, 5, 5, 5], reading: 20, readingParts: [5, 5, 5, 5], writing: 0, writingParts: [], translation: 0, translationParts: [], speaking: 0, speakingParts: [], minutes: 40 },
  '3.0:2': { listening: 25, listeningParts: [5, 10, 10], reading: 25, readingParts: [5, 5, 10, 5], writing: 10, writingParts: [5, 5], translation: 0, translationParts: [], speaking: 0, speakingParts: [], minutes: 60 },
  '3.0:3': { listening: 30, listeningParts: [10, 10, 10], reading: 30, readingParts: [10, 10, 10], writing: 10, writingParts: [5, 5], translation: 0, translationParts: [], speaking: 0, speakingParts: [], minutes: 83 },
  '3.0:4': { listening: 32, listeningParts: [14, 18], reading: 32, readingParts: [10, 15, 7], writing: 6, writingParts: [5, 1], translation: 0, translationParts: [], speaking: 0, speakingParts: [], minutes: 85 },
  '3.0:5': { listening: 35, listeningParts: [19, 16], reading: 35, readingParts: [10, 10, 15], writing: 2, writingParts: [1, 1], translation: 0, translationParts: [], speaking: 0, speakingParts: [], minutes: 110 },
  '3.0:6': { listening: 40, listeningParts: [8, 20, 12], reading: 40, readingParts: [10, 10, 20], writing: 2, writingParts: [1, 1], translation: 0, translationParts: [], speaking: 0, speakingParts: [], minutes: 125 },
  '3.0:7-9': { listening: 40, listeningParts: [10, 12, 18], reading: 40, readingParts: [21, 5, 14], writing: 2, writingParts: [1, 1], translation: 4, translationParts: [2, 2], speaking: 5, speakingParts: [1, 3, 1], minutes: 200 },
}

export function examFormat(system: CourseSystem, level: CourseLevel): ExamFormat {
  const key = system === '3.0' && level >= 7 ? '3.0:7-9' : system + ':' + level
  return examFormats[key]
}

export function examQuestionCount(format: ExamFormat): number {
  return format.listening + format.reading + format.writing + format.translation + format.speaking
}
