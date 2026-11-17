
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen, Headphones, Layers, Target, ChartNoAxesColumnIncreasing,
  Languages, Search, Volume2, ChevronRight, Flame, Menu, X,
  GraduationCap, CheckCircle2, LockKeyhole, Settings, Star,
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from './supabase'
import {
  GUEST_LOCALE_KEY, isLocale, localeLabels, translate,
  type Locale, type TranslationKey,
} from './i18n'
import {
  lessonTemplates as hsk20LessonTemplates,
  type CourseSystem,
  type CourseLevel,
  type LessonTemplate,
} from './data/curriculum'
import { hsk30LessonTemplates } from './data/hsk30Curriculum'
import { lessonVocabulary } from './data/lessonVocabulary'
import LessonPractice from './components/LessonPractice'

type System = '2.0' | '3.0'

type Word = {
  sourceEntryKey?: string
  hanzi: string
  traditional?: string
  pinyin: string
  ru: string
  en: string
  uz?: string | null
  uzVerified?: boolean
  ruStatus?: string
  enStatus?: string
  uzStatus?: string
  membershipStatus?: string
  courseStage?: CourseLevel
  courseSystems?: CourseSystem[]
  courseLessonIds?: string[]
  level20: number | string | null
  level30: number | string | null
  example: string
  examplePinyin: string
  exampleRu: string
  exampleEn: string
  exampleUz?: string | null
  exampleUzVerified?: boolean
}

type Notice = { text: string; kind: 'success' | 'error' | 'info' }

function normalizePinyin(value: string): string {
  return value.toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[1-5\s]/g, '')
}

// Demo words remain available until approved catalog data is published.
const words: Word[] = [
  {hanzi:'你好',pinyin:'nǐ hǎo',ru:'привет',en:'hello',level20:1,level30:1,example:'你好！',examplePinyin:'nǐ hǎo!',exampleRu:'Привет!',exampleEn:'Hello!'},
  {hanzi:'谢谢',pinyin:'xièxie',ru:'спасибо',en:'thank you',level20:1,level30:1,example:'谢谢你。',examplePinyin:'xièxie nǐ.',exampleRu:'Спасибо тебе.',exampleEn:'Thank you.'},
  {hanzi:'学生',pinyin:'xuésheng',ru:'студент; ученик',en:'student',level20:1,level30:1,example:'我是学生。',examplePinyin:'wǒ shì xuésheng.',exampleRu:'Я студент.',exampleEn:'I am a student.'},
  {hanzi:'学校',pinyin:'xuéxiào',ru:'школа; учебное заведение',en:'school',level20:1,level30:2,example:'我在学校学习。',examplePinyin:'wǒ zài xuéxiào xuéxí.',exampleRu:'Я учусь в школе.',exampleEn:'I study at school.'},
  {hanzi:'朋友',pinyin:'péngyou',ru:'друг',en:'friend',level20:2,level30:2,example:'他是我的朋友。',examplePinyin:'tā shì wǒ de péngyou.',exampleRu:'Он мой друг.',exampleEn:'He is my friend.'},
  {hanzi:'因为',pinyin:'yīnwèi',ru:'потому что',en:'because',level20:2,level30:3,example:'因为下雨，我不去。',examplePinyin:'yīnwèi xiàyǔ, wǒ bú qù.',exampleRu:'Из-за дождя я не пойду.',exampleEn:'Because it is raining, I will not go.'},
  {hanzi:'如果',pinyin:'rúguǒ',ru:'если',en:'if',level20:4,level30:4,example:'如果有时间，我去。',examplePinyin:'rúguǒ yǒu shíjiān, wǒ qù.',exampleRu:'Если будет время, я пойду.',exampleEn:'If I have time, I will go.'},
  {hanzi:'提高',pinyin:'tígāo',ru:'повышать; улучшать',en:'to improve',level20:4,level30:5,example:'我想提高汉语水平。',examplePinyin:'wǒ xiǎng tígāo hànyǔ shuǐpíng.',exampleRu:'Я хочу повысить уровень китайского.',exampleEn:'I want to improve my Chinese.'},
]

const grammarLessons = [
  {
    title: { ru: 'Простой порядок слов', en: 'Basic word order', uz: 'Oddiy so‘z tartibi' },
    rule: {
      ru: 'В простом утверждении обычно сначала идёт подлежащее, затем действие, а после него — объект.',
      en: 'In a simple statement, the subject usually comes first, followed by the action and then its object.',
      uz: 'Oddiy gapda avval ega, keyin harakat va undan so‘ng to‘ldiruvchi keladi.',
    },
    pattern: '主语 + 动词 + 宾语',
    hanzi: '我学习汉语。', pinyin: 'Wǒ xuéxí Hànyǔ.',
    meaning: { ru: 'Я изучаю китайский.', en: 'I study Chinese.', uz: 'Men xitoy tilini o‘rganaman.' },
  },
  {
    title: { ru: 'Связка 是 (shì)', en: 'The 是 (shì) pattern', uz: '是 (shì) bog‘lovchisi' },
    rule: {
      ru: '是 связывает предмет или человека с существительным: кто это или что это.',
      en: '是 links a person or thing to a noun: who or what someone is.',
      uz: '是 shaxs yoki narsani ot bilan bog‘laydi: kim yoki nima ekanini bildiradi.',
    },
    pattern: '主语 + 是 + 名词',
    hanzi: '我是学生。', pinyin: 'Wǒ shì xuésheng.',
    meaning: { ru: 'Я студент.', en: 'I am a student.', uz: 'Men talabaman.' },
  },
  {
    title: { ru: 'Место перед действием', en: 'Place before an action', uz: 'Harakatdan oldin joy' },
    rule: {
      ru: 'Чтобы указать место действия, поставь 在 + место перед глаголом.',
      en: 'To say where an action happens, put 在 + place before the verb.',
      uz: 'Harakat joyini aytish uchun fe’ldan oldin 在 + joyni qo‘ying.',
    },
    pattern: '主语 + 在 + 地点 + 动词',
    hanzi: '我在学校学习。', pinyin: 'Wǒ zài xuéxiào xuéxí.',
    meaning: { ru: 'Я учусь в школе.', en: 'I study at school.', uz: 'Men maktabda o‘qiyman.' },
  },
]

const navKeys: TranslationKey[] = [
  'nav.home', 'nav.lessons', 'nav.vocabulary', 'nav.flashcards',
  'nav.listening', 'nav.grammar', 'nav.tests',
]

const navIcons = [
  <Target key="home"/>,
  <GraduationCap key="lessons"/>,
  <BookOpen key="vocabulary"/>,
  <Layers key="cards"/>,
  <Headphones key="listen"/>,
  <GraduationCap key="grammar"/>,
  <CheckCircle2 key="tests"/>,
]

function initialLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(GUEST_LOCALE_KEY)
    if (isLocale(stored)) return stored
  } catch {
    // Storage can be disabled.
  }
  return 'ru'
}

const KNOWN_WORDS_KEY = 'hanzipath.knownWords'
const FAVORITE_WORDS_KEY = 'hanzipath.favoriteWords'
const DAILY_TASKS_KEY = 'hanzipath.dailyTasks'
const ACTIVITY_DAYS_KEY = 'hanzipath.activityDays'
const COMPLETED_LESSONS_KEY = 'hanzipath.completedLessons'

const lessonTemplates = [...hsk20LessonTemplates, ...hsk30LessonTemplates]
const originalLessonWords: Word[] = lessonVocabulary.reduce<Word[]>((result, entry, index) => {
  const word: Word = {
    sourceEntryKey: `hanzipath-course-${entry.stage}-${index + 1}`,
    hanzi: entry.hanzi,
    pinyin: entry.pinyin,
    ru: entry.ru,
    en: entry.en,
    uz: entry.uz,
    ruStatus: 'ai_draft_unverified',
    enStatus: 'ai_draft_unverified',
    uzStatus: 'ai_draft_unverified',
    courseStage: entry.stage,
    courseSystems: entry.systems,
    courseLessonIds: entry.lessonIds,
    // HanziPath course stages are not official HSK memberships.
    level20: null,
    level30: null,
    example: '',
    examplePinyin: '',
    exampleRu: '',
    exampleEn: '',
  }
  const key = `${word.hanzi}|${word.pinyin.toLowerCase()}`
  if (!result.some(existing => `${existing.hanzi}|${existing.pinyin.toLowerCase()}` === key)) {
    result.push(word)
  }
  return result
}, [])

const classroomDialogue = [
  {
    key: 'learner',
    hanzi: '老师，你好！',
    pinyin: 'Lǎoshī, nǐ hǎo!',
    meaning: {
      ru: 'Учитель, здравствуйте!',
      en: 'Hello, teacher!',
      uz: 'Assalomu alaykum, ustoz!',
    },
  },
  {
    key: 'teacher',
    hanzi: '你好！你叫什么名字？',
    pinyin: 'Nǐ hǎo! Nǐ jiào shénme míngzi?',
    meaning: {
      ru: 'Привет! Как тебя зовут?',
      en: 'Hello! What is your name?',
      uz: 'Salom! Ismingiz nima?',
    },
  },
] as const

const closingReading = {
  hanzi: '今天的课很有意思。回家以后，我要再读一次，也要多练习。',
  pinyin: 'Jīntiān de kè hěn yǒu yìsi. Huí jiā yǐhòu, wǒ yào zài dú yí cì, yě yào duō liànxí.',
  meaning: {
    ru: 'Сегодняшний урок интересный. Дома я прочитаю его ещё раз и буду больше практиковаться.',
    en: 'Today’s lesson is interesting. At home I’ll read it again and practice some more.',
    uz: 'Bugungi dars qiziqarli. Uyda uni yana bir marta o‘qiyman va ko‘proq mashq qilaman.',
  },
  options: {
    ru: ['Я ещё раз прочитаю урок дома и буду практиковаться.', 'Я пойду в библиотеку и выберу новую книгу.', 'Я закончил урок и больше не буду заниматься.'],
    en: ['I’ll read the lesson again at home and practice more.', 'I’ll go to the library to choose a new book.', 'I finished the lesson and will stop studying.'],
    uz: ['Darsni uyda yana o‘qib, ko‘proq mashq qilaman.', 'Kutubxonaga borib, yangi kitob tanlayman.', 'Darsni tugatdim va endi o‘qimayman.'],
  },
} as const

const firstLessonReading = {
  hanzi: '你好！我叫安娜。我是学生。你呢？',
  pinyin: 'Nǐ hǎo! Wǒ jiào Ānnà. Wǒ shì xuésheng. Nǐ ne?',
  meaning: {
    ru: 'Привет! Меня зовут Анна. Я студентка. А ты?',
    en: 'Hello! My name is Anna. I am a student. And you?',
    uz: 'Salom! Mening ismim Anna. Men talabaman. Siz-chi?',
  },
  options: {
    ru: ['Меня зовут Анна, я студентка.', 'Я покупаю яблоко в магазине.', 'Учитель идёт в библиотеку.'],
    en: ['My name is Anna. I am a student.', 'I am buying an apple at the shop.', 'The teacher is going to the library.'],
    uz: ['Mening ismim Anna. Men talabaman.', 'Men do‘kondan olma sotib olyapman.', 'O‘qituvchi kutubxonaga ketyapti.'],
  },
} as const

const lessonFlowKeys = [
  'course.flow.topic', 'course.flow.words', 'course.flow.dialogue',
  'course.flow.grammar', 'course.flow.listening', 'course.flow.reading', 'course.flow.review',
] as const

type ExamSection = 'listening' | 'reading' | 'writing' | 'translation' | 'speaking'
type ExamQuestion = {
  section: ExamSection
  part?: number
  prompt: string
  options: string[]
  answer: string
  audio?: string
  pinyin?: string
  manualReview?: boolean
}

type ExamFormat = {
  listening: number; listeningParts: number[]
  reading: number; readingParts: number[]
  writing: number; writingParts: number[]
  translation: number; translationParts: number[]
  speaking: number; speakingParts: number[]
  minutes: number
}

const examFormats: Record<string, ExamFormat> = {
  '2.0:1': { listening: 20, listeningParts: [5, 5, 5, 5], reading: 20, readingParts: [5, 5, 5, 5], writing: 0, writingParts: [], translation: 0, translationParts: [], speaking: 0, speakingParts: [], minutes: 35 },
  '2.0:2': { listening: 35, listeningParts: [10, 10, 10, 5], reading: 25, readingParts: [5, 5, 5, 10], writing: 0, writingParts: [], translation: 0, translationParts: [], speaking: 0, speakingParts: [], minutes: 50 },
  '2.0:3': { listening: 40, listeningParts: [10, 10, 10, 10], reading: 30, readingParts: [10, 10, 10], writing: 10, writingParts: [5, 5], translation: 0, translationParts: [], speaking: 0, speakingParts: [], minutes: 85 },
  '2.0:4': { listening: 45, listeningParts: [10, 15, 20], reading: 40, readingParts: [10, 10, 20], writing: 15, writingParts: [10, 5], translation: 0, translationParts: [], speaking: 0, speakingParts: [], minutes: 100 },
  '2.0:5': { listening: 45, listeningParts: [20, 25], reading: 45, readingParts: [15, 10, 20], writing: 10, writingParts: [8, 2], translation: 0, translationParts: [], speaking: 0, speakingParts: [], minutes: 120 },
  '2.0:6': { listening: 50, listeningParts: [15, 15, 20], reading: 50, readingParts: [10, 10, 10, 20], writing: 1, writingParts: [1], translation: 0, translationParts: [], speaking: 0, speakingParts: [], minutes: 135 },
  '3.0:1': { listening: 20, listeningParts: [5, 5, 5, 5], reading: 20, readingParts: [5, 5, 5, 5], writing: 0, writingParts: [], translation: 0, translationParts: [], speaking: 0, speakingParts: [], minutes: 35 },
  '3.0:2': { listening: 35, listeningParts: [10, 10, 10, 5], reading: 25, readingParts: [5, 5, 5, 10], writing: 0, writingParts: [], translation: 0, translationParts: [], speaking: 0, speakingParts: [], minutes: 50 },
  '3.0:3': { listening: 40, listeningParts: [10, 10, 10, 10], reading: 30, readingParts: [10, 10, 10], writing: 10, writingParts: [5, 5], translation: 0, translationParts: [], speaking: 0, speakingParts: [], minutes: 85 },
  '3.0:4': { listening: 45, listeningParts: [10, 15, 20], reading: 40, readingParts: [10, 10, 20], writing: 15, writingParts: [10, 5], translation: 0, translationParts: [], speaking: 0, speakingParts: [], minutes: 100 },
  '3.0:5': { listening: 45, listeningParts: [20, 25], reading: 45, readingParts: [15, 10, 20], writing: 10, writingParts: [8, 2], translation: 0, translationParts: [], speaking: 0, speakingParts: [], minutes: 120 },
  '3.0:6': { listening: 50, listeningParts: [15, 15, 20], reading: 50, readingParts: [10, 10, 10, 20], writing: 1, writingParts: [1], translation: 0, translationParts: [], speaking: 0, speakingParts: [], minutes: 135 },
  '3.0:7-9': { listening: 40, listeningParts: [10, 12, 18], reading: 40, readingParts: [21, 5, 14], writing: 2, writingParts: [1, 1], translation: 4, translationParts: [2, 2], speaking: 5, speakingParts: [1, 3, 1], minutes: 200 },
}

function examFormat(system: CourseSystem, level: CourseLevel): ExamFormat {
  const key = system === '3.0' && level >= 7 ? '3.0:7-9' : `${system}:${level}`
  return examFormats[key]
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

function wordId(word: Word): string {
  return word.sourceEntryKey ?? `${word.hanzi}|${word.pinyin}|${word.level20 ?? 'x'}|${word.level30 ?? 'x'}|${word.en}`
}

function localeMeaning(word: Word, locale: Locale): string {
  return locale === 'ru'
    ? word.ru
    : locale === 'en'
      ? word.en
      : word.uz ?? ''
}

function wordsForCourseLevel(entries: Word[], system: CourseSystem, level: CourseLevel): Word[] {
  const membership = (word: Word) => system === '2.0' ? word.level20 : word.level30
  const category = system === '3.0' && level >= 7 ? '7-9' : String(level)
  const pool = entries.filter(word => !word.courseStage && String(membership(word) ?? '') === category)
  const authoredPool = entries.filter(word => word.courseStage === level && word.courseSystems?.includes(system))

  if (system !== '3.0' || level < 7) return [...pool, ...authoredPool]

  const ordered = [...pool].sort((a, b) => {
    const left = `${a.hanzi}|${a.pinyin}`
    const right = `${b.hanzi}|${b.pinyin}`
    return left < right ? -1 : left > right ? 1 : 0
  })

  // CTI publishes one combined 7–9 membership band. These three slices are
  // an in-house course sequence and do not change official membership.
  return [...ordered.filter((_, index) => index % 3 === level - 7), ...authoredPool]
}

function lessonWordAssignments(entries: Word[]): Record<string, Word[]> {
  const assignments: Record<string, Word[]> = Object.fromEntries(
    lessonTemplates.map(lesson => [lesson.id, []]),
  )

  const groups = [...new Set(lessonTemplates.map(lesson => lesson.system + ':' + lesson.level))]
  for (const group of groups) {
    const [system, levelValue] = group.split(':') as [CourseSystem, string]
    const level = Number(levelValue) as CourseLevel
    const lessons = lessonTemplates.filter(lesson => lesson.system === system && lesson.level === level)
    const pool = wordsForCourseLevel(entries, system, level)
    if (!lessons.length || !pool.length) continue

    const chapters = [...new Set(lessons.map(lesson => lesson.chapter))]
    for (const chapterNumber of chapters) {
      const chapterLessons = lessons.filter(lesson => lesson.chapter === chapterNumber)
      const chapterKeywords = [...new Set(chapterLessons.flatMap(lesson => lesson.keywords))]
        .map(term => term.toLocaleLowerCase())
      const chapterScores = pool.map((word, index) => {
        const searchable = [word.hanzi, word.pinyin, word.ru, word.en, word.uz]
          .filter(Boolean).join(' ').toLocaleLowerCase()
        const score = chapterKeywords.reduce((total, keyword) => total + (searchable.includes(keyword) ? 1 : 0), 0)
        return { word, score, index }
      })
      const chapterPinned = chapterLessons.flatMap(lesson =>
        pool.filter(word => word.courseLessonIds?.includes(lesson.id)),
      )
      const chapterTopical = chapterScores.filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score || a.index - b.index).map(item => item.word)

      for (const lesson of chapterLessons) {
        const lessonText = [lesson.grammar.example, ...(lesson.grammar.extraExamples ?? []).map(example => example.hanzi)].join(' ')
        const lessonKeywords = lesson.keywords.map(term => term.toLocaleLowerCase())
        const lessonMatches = pool.map((word, index) => {
          const searchable = [word.hanzi, word.pinyin, word.ru, word.en, word.uz]
            .filter(Boolean).join(' ').toLocaleLowerCase()
          const keywordScore = lessonKeywords.reduce((total, keyword) => total + (searchable.includes(keyword) ? 1 : 0), 0)
          const exampleScore = lessonText.includes(word.hanzi) ? 3 : 0
          return { word, score: keywordScore + exampleScore, index }
        })
        const pinned = pool.filter(word => word.courseLessonIds?.includes(lesson.id))
        const topical = lessonMatches.filter(item => item.score > 0)
          .sort((a, b) => b.score - a.score || a.index - b.index).map(item => item.word)
        const selected = pinned.length || topical.length ? [...pinned, ...topical] : [...chapterPinned, ...chapterTopical]
        assignments[lesson.id] = [...new Map(selected.map(word => [wordId(word), word])).values()]
      }
    }
  }

  return assignments
}
type CourseUnit = {
  id: string
  lessons: LessonTemplate[]
  words: Word[]
}

function buildCourseUnits(
  system: CourseSystem,
  level: CourseLevel,
  entries: Word[],
  matchedAssignments: Record<string, Word[]>,
): CourseUnit[] {
  const lessons = lessonTemplates.filter(lesson => lesson.system === system && lesson.level === level)
  const pool = wordsForCourseLevel(entries, system, level)
  const uniqueWords = [...new Map(pool.map(word => [
    `${word.hanzi}|${normalizePinyin(word.pinyin)}`,
    word,
  ])).values()]

  if (!lessons.length) return []
  const unitCount = Math.max(1, Math.ceil(uniqueWords.length / 25))
  const baseSize = Math.floor(uniqueWords.length / unitCount)
  const remainder = uniqueWords.length % unitCount
  const units: CourseUnit[] = []
  const assigned = new Set<string>()
  let lessonOffset = 0

  for (let index = 0; index < unitCount; index += 1) {
    const wordCount = baseSize + (index < remainder ? 1 : 0)
    const lessonCount = Math.floor(lessons.length / unitCount) + (index < lessons.length % unitCount ? 1 : 0)
    const unitLessons = lessons.slice(lessonOffset, lessonOffset + lessonCount)
    const topical = unitLessons.flatMap(lesson => matchedAssignments[lesson.id] ?? [])
    const orderedCandidates = [...new Map([...topical, ...uniqueWords].map(word => [
      `${word.hanzi}|${normalizePinyin(word.pinyin)}`,
      word,
    ])).values()]
    const words = orderedCandidates.filter(word =>
      !assigned.has(`${word.hanzi}|${normalizePinyin(word.pinyin)}`),
    ).slice(0, wordCount)
    words.forEach(word => assigned.add(`${word.hanzi}|${normalizePinyin(word.pinyin)}`))
    if (unitLessons.length) units.push({ id: unitLessons[0].id, lessons: unitLessons, words })
    lessonOffset += lessonCount
  }

  return units
}

function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const result = [...items]
  let value = seed >>> 0

  for (let i = result.length - 1; i > 0; i -= 1) {
    value = (value * 1664525 + 1013904223) >>> 0
    const j = value % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }

  return result
}

function partNumber(questionIndex: number, sections: number[]): number {
  let remaining = questionIndex
  for (let index = 0; index < sections.length; index += 1) {
    remaining -= sections[index]
    if (remaining < 0) return index + 1
  }
  return sections.length
}

function partSummary(sections: number[]): string {
  return sections.join(' + ')
}

function splitSentence(sentence: string, words: Word[]): string[] {
  const text = sentence.replace(/[，。！？、,.!?]/g, '')
  const vocabulary = [...new Set(words.map(word => word.hanzi).filter(Boolean))]
    .sort((a, b) => b.length - a.length)
  const parts: string[] = []
  let position = 0

  while (position < text.length) {
    const match = vocabulary.find(entry => text.startsWith(entry, position))
    if (match) {
      parts.push(match)
      position += match.length
    } else {
      parts.push(text[position])
      position += 1
    }
  }

  return parts.length >= 3 ? parts : Array.from(text)
}

function examQuestions(system: CourseSystem, level: CourseLevel, words: Word[], locale: Locale, attemptSeed = Date.now()): ExamQuestion[] {
  const format = examFormat(system, level)
  const standardValue = (word: Word) => system === '2.0' ? word.level20 : word.level30
  const wordPool = system === '3.0' && level >= 7
    ? words.filter(word => String(word.level30 ?? '') === '7-9')
    : words.filter(word => Number(standardValue(word)) > 0 && Number(standardValue(word)) <= level)
  const lessons = lessonTemplates.filter(lesson => lesson.system === system && (
    system === '3.0' && level >= 7 ? lesson.level >= 7 : lesson.level <= level
  ))
  const safeWords = wordPool.length >= 4 ? wordPool : words
  // Shuffle once per attempt so a question set uses each lesson/word before cycling.
  const shuffledLessons = shuffleWithSeed([...lessons], attemptSeed ^ 0x51f15e)
  const shuffledWords = shuffleWithSeed([...new Map(safeWords.map(word => [wordId(word), word])).values()], attemptSeed ^ 0x2a91c3)
  const shuffledAudioWords = shuffleWithSeed([...new Map(safeWords.map(word => [word.example || word.hanzi, word])).values()], attemptSeed ^ 0x71b42d)
  const questions: ExamQuestion[] = []
  if (!lessons.length || !safeWords.length) return questions
  const writingEnd = format.listening + format.reading + format.writing
  const translationEnd = writingEnd + format.translation
  const total = translationEnd + format.speaking

  for (let index = 0; index < total; index += 1) {
    const seed = (attemptSeed + (level + 1) * 1009 + index * 97) >>> 0

    if (index < format.listening) {
      const word = shuffledAudioWords[index % shuffledAudioWords.length]
      const answer = localeMeaning(word, locale) || word.en || word.ru
      const distractors = shuffledAudioWords
        .filter(candidate => wordId(candidate) !== wordId(word))
        .map(candidate => localeMeaning(candidate, locale))
        .filter((meaning): meaning is string => Boolean(meaning) && meaning !== answer)
      questions.push({
        section: 'listening',
        part: partNumber(index, format.listeningParts),
        prompt: locale === 'ru' ? 'Прослушай слово или фразу и выбери правильное значение.' : locale === 'uz' ? 'So‘z yoki iborani tinglang va to‘g‘ri ma’nosini tanlang.' : 'Listen to the word or phrase and choose its meaning.',
        options: shuffleWithSeed([answer, ...shuffleWithSeed([...new Set(distractors)], seed).slice(0, 3)], seed + 1),
        answer,
        audio: word.example || word.hanzi,
        pinyin: word.examplePinyin || word.pinyin,
      })
      continue
    }

    if (index < format.listening + format.reading) {
      const readingIndex = index - format.listening
      const word = shuffledWords[(format.listening + readingIndex) % shuffledWords.length]
      const meaning = localeMeaning(word, locale) || word.en || word.ru
      const reverseDirection = readingIndex % 2 === 1
      const answer = reverseDirection ? word.hanzi : meaning
      const distractors = shuffledWords
        .filter(candidate => wordId(candidate) !== wordId(word))
        .map(candidate => reverseDirection ? candidate.hanzi : localeMeaning(candidate, locale))
        .filter((value): value is string => Boolean(value) && value !== answer)
      questions.push({
        section: 'reading',
        part: partNumber(readingIndex, format.readingParts),
        prompt: reverseDirection
          ? (locale === 'ru' ? `Выбери иероглифы для значения «${meaning}».` : locale === 'uz' ? `«${meaning}» ma’nosiga mos ierogliflarni tanlang.` : `Choose the Chinese word for “${meaning}”.`)
          : (locale === 'ru' ? `Выбери значение слова ${word.hanzi} (${word.pinyin}).` : locale === 'uz' ? `${word.hanzi} (${word.pinyin}) so‘zining ma’nosini tanlang.` : `Choose the meaning of ${word.hanzi} (${word.pinyin}).`),
        options: shuffleWithSeed([answer, ...shuffleWithSeed([...new Set(distractors)], seed).slice(0, 3)], seed + 1),
        answer,
      })
      continue
    }

    if (index < writingEnd) {
      const lesson = shuffledLessons[((index - format.listening - format.reading) % shuffledLessons.length)]
      const writingIndex = index - format.listening - format.reading
      if ((system === '2.0' || system === '3.0') && level === 3 && writingIndex < 5) {
        const word = shuffledWords[(format.listening + format.reading + writingIndex) % shuffledWords.length]
        const meaning = localeMeaning(word, locale) || word.en || word.ru
        questions.push({
          section: 'writing',
          part: partNumber(writingIndex, format.writingParts),
          prompt: locale === 'ru'
            ? `Запиши иероглифами слово: ${word.pinyin} (${meaning})`
            : locale === 'uz'
              ? `${word.pinyin} (${meaning}) so‘zini ierogliflar bilan yozing.`
              : `Write the Chinese characters for ${word.pinyin} (${meaning}).`,
          options: [],
          answer: word.hanzi,
        })
        continue
      }

      if (level >= 5 || (system === '3.0' && level === 4 && writingIndex >= format.writing - 2)) {
        questions.push({
          section: 'writing',
          part: partNumber(writingIndex, format.writingParts),
          prompt: locale === 'ru'
            ? `Напиши короткий связный текст по теме «${lesson.title}». Используй фразу ${lesson.grammar.example} как опору.`
            : locale === 'uz'
              ? `«${lesson.title}» mavzusida qisqa matn yozing. ${lesson.grammar.example} gapidan foydalaning.`
              : `Write a short text about “${lesson.title}”. Use ${lesson.grammar.example} as a starting point.`,
          options: [],
          answer: '',
          manualReview: true,
        })
        continue
      }

      const pieces = splitSentence(lesson.grammar.example, safeWords)
      const shuffledPieces = shuffleWithSeed(pieces, seed)
      if (shuffledPieces.join('') === pieces.join('')) shuffledPieces.reverse()
      questions.push({
        section: 'writing',
        part: partNumber(writingIndex, format.writingParts),
        prompt: locale === 'ru'
          ? `Составь фразу из частей: ${shuffledPieces.join(' / ')}`
          : locale === 'uz'
            ? `Berilgan bo‘laklardan gap tuzing: ${shuffledPieces.join(' / ')}`
            : `Rebuild the sentence from these parts: ${shuffledPieces.join(' / ')}`,
        options: [],
        answer: lesson.grammar.example,
      })
      continue
    }

    if (index < translationEnd) {
      const lesson = shuffledLessons[((index - writingEnd) % shuffledLessons.length)]
      const translateToChinese = (index - writingEnd) % 2 === 1
      questions.push({
        section: 'translation',
        part: partNumber(index - writingEnd, format.translationParts),
        prompt: locale === 'ru'
          ? translateToChinese ? `Передай по-китайски смысл: «${lesson.grammar.meaning}»` : `Переведи на русский: ${lesson.grammar.example}`
          : locale === 'uz'
            ? translateToChinese ? `Quyidagi ma’noni xitoy tilida ifodalang: «${lesson.grammar.meaning}»` : `Gapni o‘zbekchaga tarjima qiling: ${lesson.grammar.example}`
            : translateToChinese ? `Express this meaning in Chinese: “${lesson.grammar.meaning}”` : `Translate into English: ${lesson.grammar.example}`,
        options: [],
        answer: '',
        manualReview: true,
      })
      continue
    }

    const lesson = shuffledLessons[((index - translationEnd) % shuffledLessons.length)]
    questions.push({
      section: 'speaking',
      part: partNumber(index - translationEnd, format.speakingParts),
      prompt: locale === 'ru'
        ? `Ответь вслух, затем запиши ключевые мысли: ${lesson.grammar.meaning}`
        : locale === 'uz'
          ? `Javobni ovoz chiqarib ayting, so‘ng asosiy fikrlarni yozing: ${lesson.grammar.meaning}`
          : `Answer aloud, then write your key points: ${lesson.grammar.meaning}`,
      options: [],
      answer: '',
      manualReview: true,
    })
  }

  return questions
}

function normalizeWrittenAnswer(value: string): string {
  return value.replace(/[\s，。！？、,.!?;；:：]/g, '').toLocaleLowerCase()
}

function formatExamTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0')
  const remaining = (seconds % 60).toString().padStart(2, '0')
  return `${minutes}:${remaining}`
}

function newWordsCountLabel(count: number, locale: Locale): string {
  if (locale === 'uz') return `${count} ta yangi so‘z`
  if (locale === 'en') return `${count} new words`
  return `${count} новых слов`
}

function getStreak(days: string[]): number {
  const active = new Set(days)
  const cursor = new Date()
  if (!active.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1)

  let streak = 0
  while (active.has(localDateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

function getLevelValue(level: string): string | undefined {
  if (level === 'all') return undefined
  if (level === '7') return '7-9'
  return level
}

/**
 * Converts a database vocabulary record into the shape
 * already used by the dictionary interface.
 */
function databaseRowToWord(row: any): Word {
  const readings = (row.vocabulary_readings ?? []).filter(
    (item: any) => item.verification_status === 'verified',
  )

  const translations = (row.translations ?? []).filter(
    (item: any) =>
      item.verification_status === 'verified' &&
      item.content_kind === 'meaning',
  )

  const examples = (row.examples ?? []).filter(
    (item: any) => item.verification_status === 'verified',
  )

  const example = examples[0]
  const exampleTranslations = (row.translations ?? []).filter(
    (item: any) =>
      item.verification_status === 'verified' &&
      item.content_kind === 'example_translation' &&
      item.example_id === example?.id,
  )

  const meaning = (locale: Locale) =>
    translations.find((item: any) => item.locale === locale)?.text ?? null

  const exampleMeaning = (locale: Locale) =>
    exampleTranslations.find((item: any) => item.locale === locale)?.text ?? null

  const level = row.level_category === '7-9'
    ? 7
    : Number(row.level_category ?? 1)

  return {
    hanzi: row.simplified ?? '',
    pinyin: readings[0]?.pinyin ?? '',
    ru: meaning('ru') ?? '',
    en: meaning('en') ?? '',
    uz: meaning('uz'),
    uzVerified: Boolean(meaning('uz')),
    level20: level,
    level30: level,
    example: example?.sentence_hanzi ?? '',
    examplePinyin: example?.sentence_pinyin ?? '',
    exampleRu: exampleMeaning('ru') ?? '',
    exampleEn: exampleMeaning('en') ?? '',
    exampleUz: exampleMeaning('uz'),
    exampleUzVerified: Boolean(exampleMeaning('uz')),
  }
}

function reviewRowToWord(row: any, index: number): Word {
  const sample = words.find(word => word.hanzi === row.hanzi && word.pinyin === row.pinyin)
  return {
    sourceEntryKey: row.sourceEntryKey ?? `review-row-${String(index + 1).padStart(5, '0')}`,
    hanzi: row.hanzi ?? '',
    traditional: row.traditional ?? '',
    pinyin: row.pinyin ?? '',
    ru: row.ru ?? '',
    en: row.en ?? '',
    uz: row.uz ?? null,
    uzVerified: false,
    ruStatus: row.ruStatus,
    enStatus: row.enStatus,
    uzStatus: row.uzStatus,
    membershipStatus: row.membershipStatus,
    level20: row.level20 ?? null,
    level30: row.level30 ?? null,
    example: sample?.example ?? '',
    examplePinyin: sample?.examplePinyin ?? '',
    exampleRu: sample?.exampleRu ?? '',
    exampleEn: sample?.exampleEn ?? '',
  }
}

export default function App() {
  const [lang, setLang] = useState<Locale>(initialLocale)
  const [system, setSystem] = useState<System>('3.0')
  const [section, setSection] = useState(0)
  const [courseSystem, setCourseSystem] = useState<CourseSystem>('2.0')
  const [courseLevel, setCourseLevel] = useState<CourseLevel>(1)
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null)
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>(() => readStored(COMPLETED_LESSONS_KEY, []))
  const [level, setLevel] = useState('all')
  const [vocabularyCollection, setVocabularyCollection] = useState<'course' | 'hsk' | 'all'>('hsk')
  const [query, setQuery] = useState('')
  const [dictionaryPage, setDictionaryPage] = useState(0)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [selectedDictionaryWord, setSelectedDictionaryWord] = useState<Word | null>(null)
  const [menu, setMenu] = useState(false)
  const [done, setDone] = useState<boolean[]>(() => {
    const saved = readStored<{ date: string; done: boolean[] } | null>(DAILY_TASKS_KEY, null)
    return saved?.date === localDateKey() && Array.isArray(saved.done) && saved.done.length === 3
      ? saved.done
      : [false, false, false]
  })
  const [knownWords, setKnownWords] = useState<string[]>(() => readStored(KNOWN_WORDS_KEY, []))
  const [favoriteWordIds, setFavoriteWordIds] = useState<string[]>(() => readStored(FAVORITE_WORDS_KEY, []))
  const [activityDays, setActivityDays] = useState<string[]>(() => readStored(ACTIVITY_DAYS_KEY, []))
  const [cardIndex, setCardIndex] = useState(() => Math.max(0, readStored<Record<string, any>>('hanzipath.progress', {}).cardIndex ?? 0))
  const [showAnswer, setShowAnswer] = useState(false)
  const [listeningIndex, setListeningIndex] = useState(() => Math.max(0, readStored<Record<string, any>>('hanzipath.progress', {}).listeningIndex ?? 0))
  const [practiceSystem, setPracticeSystem] = useState<CourseSystem>(() => readStored<Record<string, any>>('hanzipath.progress', {}).practiceSystem === '3.0' ? '3.0' : '2.0')
  const [practiceLevel, setPracticeLevel] = useState<CourseLevel>(() => { const value = readStored<Record<string, any>>('hanzipath.progress', {}).practiceLevel; return Number.isInteger(value) && value >= 1 && value <= 9 ? value : 1 })
  const [practiceUnitId, setPracticeUnitId] = useState<string | null>(() => readStored<Record<string, any>>('hanzipath.progress', {}).practiceUnitId ?? null)
  const [grammarExpandedId, setGrammarExpandedId] = useState<string | null>(null)
  const [listeningChoice, setListeningChoice] = useState<string | null>(null)
  const [lessonListeningChoice, setLessonListeningChoice] = useState<string | null>(null)
  const [closingChoice, setClosingChoice] = useState<number | null>(null)
  const [examSystem, setExamSystem] = useState<CourseSystem>('2.0')
  const [examLevel, setExamLevel] = useState<CourseLevel>(1)
  const [examQuestionsState, setExamQuestionsState] = useState<ExamQuestion[]>([])
  const [examIndex, setExamIndex] = useState(0)
  const [examAnswers, setExamAnswers] = useState<string[]>([])
  const [examSecondsLeft, setExamSecondsLeft] = useState(0)
  const [examStarted, setExamStarted] = useState(false)
  const [examFinished, setExamFinished] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [progressReady, setProgressReady] = useState(false)
  const [progressOwnerId, setProgressOwnerId] = useState<string | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authFeedback, setAuthFeedback] = useState<{ text: string; kind: 'success' | 'error' } | null>(null)

  const [databaseWords, setDatabaseWords] = useState<Word[] | null>(null)
  const [databaseSystem, setDatabaseSystem] = useState<System | 'all' | null>(null)
  const [reviewWords, setReviewWords] = useState<Word[] | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState(false)

  const localeChangeRef = useRef(0)
  const wordDialogRef = useRef<HTMLDialogElement>(null)
  const t = (key: TranslationKey) => translate(lang, key)

  useEffect(() => {
    if (!supabase) { setAuthReady(true); setProgressReady(true); return }
    let mounted = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setUserEmail(session?.user.email ?? null)
      setUserId(session?.user.id ?? null)
      setAuthReady(true)
    })
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return
      if (error) setNotice({ text: error.message, kind: 'error' })
      setUserEmail(data.session?.user.email ?? null)
      setUserId(data.session?.user.id ?? null)
      setAuthReady(true)
    })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (vocabularyCollection === 'course') return
    if (!supabase) {
      setCatalogError(true)
      setDatabaseWords([])
      setDatabaseSystem(vocabularyCollection === 'all' ? 'all' : system)
      return
    }

    let cancelled = false
    const client = supabase
    setCatalogLoading(true)
    setCatalogError(false)
    setDatabaseWords(null)
    setDatabaseSystem(null)

    const loadCatalog = async () => {
      try {
        const standardCode = vocabularyCollection === 'all' ? 'all' : system === '2.0' ? 'hsk20' : 'hsk30'
        // Fetch the catalog as one JSON payload. PostgREST caps table-shaped
        // RPC responses at 1,000 rows, which previously made the multi-page
        // loader stall on mobile even though the database contained all words.
        const { data, error } = await client.rpc('get_hanzipath_vocabulary_bundle', {
          p_standard_code: standardCode,
        })
        if (error) throw error
        const rows: any[] = Array.isArray(data) ? data : []

        if (cancelled) return
        const mapped: Word[] = rows.map((row: any) => ({
          sourceEntryKey: `hsk-${standardCode}-${row.id}`,
          hanzi: row.simplified,
          traditional: row.traditional ?? '',
          pinyin: row.pinyin ?? '',
          ru: row.ru ?? '',
          en: row.en ?? '',
          uz: row.uz ?? '',
          ruStatus: row.ru_status ?? 'unverified',
          enStatus: row.en_status ?? 'unverified',
          uzStatus: row.uz_status ?? 'unverified',
          membershipStatus: row.membership_status ?? 'unverified',
          level20: vocabularyCollection === 'all' ? null : system === '2.0' ? row.level_order : null,
          level30: vocabularyCollection === 'all' ? null : system === '3.0' ? (Number(row.level_order) >= 7 ? '7-9' : row.level_order) : null,
          example: '',
          examplePinyin: '',
          exampleRu: '',
          exampleEn: '',
        }))
        setDatabaseWords(mapped)
        setDatabaseSystem(vocabularyCollection === 'all' ? 'all' : system)
      } catch (error) {
        console.error('HanziPath vocabulary catalog failed to load:', error)
        if (!cancelled) {
          setDatabaseWords([])
          setDatabaseSystem(vocabularyCollection === 'all' ? 'all' : system)
          setCatalogError(true)
        }
      } finally {
        if (!cancelled) setCatalogLoading(false)
      }
    }

    void loadCatalog()
    return () => { cancelled = true }
  }, [system, vocabularyCollection])

  useEffect(() => {
    if (!authReady) return
    if (!userId || !supabase) { setProgressReady(true); setProgressOwnerId(null); return }
    const client = supabase
    let cancelled = false
    setProgressReady(false)
    const loadProgress = async () => {
      const { data, error } = await client.from('user_learning_progress').select('progress').eq('user_id', userId).maybeSingle()
      if (cancelled) return
      if (error) setNotice({ text: `${t('auth.progressLoadError')}: ${error.message}`, kind: 'error' })
      else if (data?.progress && typeof data.progress === 'object') {
        const saved = data.progress as Record<string, any>
        if (Array.isArray(saved.knownWords)) setKnownWords(saved.knownWords)
        if (Array.isArray(saved.favoriteWordIds)) setFavoriteWordIds(saved.favoriteWordIds)
        if (Array.isArray(saved.completedLessonIds)) setCompletedLessonIds(saved.completedLessonIds)
        if (Array.isArray(saved.activityDays)) setActivityDays(saved.activityDays)
        if (Array.isArray(saved.done) && saved.done.length === 3) setDone(saved.done)
        if (saved.courseSystem === '2.0' || saved.courseSystem === '3.0') setCourseSystem(saved.courseSystem)
        if (Number.isInteger(saved.courseLevel) && saved.courseLevel >= 1 && saved.courseLevel <= 9) setCourseLevel(saved.courseLevel)
        if (typeof saved.cardIndex === 'number') setCardIndex(Math.max(0, saved.cardIndex))
        if (typeof saved.listeningIndex === 'number') setListeningIndex(Math.max(0, saved.listeningIndex))
        if (saved.practiceSystem === '2.0' || saved.practiceSystem === '3.0') setPracticeSystem(saved.practiceSystem)
        if (Number.isInteger(saved.practiceLevel) && saved.practiceLevel >= 1 && saved.practiceLevel <= 9) setPracticeLevel(saved.practiceLevel)
        if (typeof saved.practiceUnitId === 'string' || saved.practiceUnitId === null) setPracticeUnitId(saved.practiceUnitId)
        if (typeof saved.section === 'number' && saved.section >= 0 && saved.section <= 7) setSection(saved.section)
        if (typeof saved.activeLessonId === 'string' || saved.activeLessonId === null) setActiveLessonId(saved.activeLessonId)
        if (typeof saved.lang === 'string' && isLocale(saved.lang)) setLang(saved.lang)
      }
      setProgressOwnerId(userId)
      setProgressReady(true)
    }
    void loadProgress()
    return () => { cancelled = true }
  }, [authReady, userId])

  useEffect(() => {
    const progress = { knownWords, favoriteWordIds, completedLessonIds, activityDays, done, courseSystem, courseLevel, cardIndex, practiceSystem, practiceLevel, practiceUnitId, listeningIndex, section, activeLessonId, lang }
    try { window.localStorage.setItem('hanzipath.progress', JSON.stringify(progress)) } catch { /* optional local backup */ }
    if (!userId || !supabase || !progressReady || progressOwnerId !== userId) return
    const client = supabase
    const timer = window.setTimeout(() => {
      void client.from('user_learning_progress').upsert({ user_id: userId, progress, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }).then(({ error }) => {
        if (error) setNotice({ text: t('auth.progressSaveError'), kind: 'error' })
      })
    }, 900)
    return () => window.clearTimeout(timer)
  }, [knownWords, favoriteWordIds, completedLessonIds, activityDays, done, courseSystem, courseLevel, cardIndex, practiceSystem, practiceLevel, practiceUnitId, listeningIndex, section, activeLessonId, lang, userId, progressReady, progressOwnerId])

  const submitAuth = async () => {
    if (!supabase) { setNotice({ text: t('auth.notConfigured'), kind: 'error' }); return }
    const email = authEmail.trim()
    if (!email || authPassword.length < 6) { setNotice({ text: t('auth.validation'), kind: 'error' }); return }
    setAuthBusy(true)
    setAuthFeedback(null)
    try {
      const result = authMode === 'signup'
        ? await supabase.auth.signUp({ email, password: authPassword, options: { emailRedirectTo: window.location.origin } })
        : await supabase.auth.signInWithPassword({ email, password: authPassword })
      if (result.error) {
        setAuthFeedback({ text: result.error.message, kind: 'error' })
        return
      }
      if (authMode === 'signup' && !result.data.session) {
        setAuthFeedback({ text: t('auth.confirmEmail'), kind: 'success' })
        setAuthPassword('')
        return
      }
      setNotice({ text: t('auth.success'), kind: 'success' })
      setAuthOpen(false)
      setAuthPassword('')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setAuthFeedback({ text: message || 'Authentication request failed. Please try again.', kind: 'error' })
    } finally {
      setAuthBusy(false)
    }
  }

  const signOut = async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) setNotice({ text: error.message, kind: 'error' })
    else setNotice({ text: t('auth.signedOut'), kind: 'info' })
  }

  useEffect(() => {
    try {
      window.localStorage.setItem(DAILY_TASKS_KEY, JSON.stringify({ date: localDateKey(), done }))
    } catch {
      // Keep the checklist usable when browser storage is unavailable.
    }
  }, [done])

  useEffect(() => {
    try {
      window.localStorage.setItem(KNOWN_WORDS_KEY, JSON.stringify(knownWords))
    } catch {
      // Learning remains available for this session.
    }
  }, [knownWords])

  useEffect(() => {
    try {
      window.localStorage.setItem(FAVORITE_WORDS_KEY, JSON.stringify(favoriteWordIds))
    } catch {
      // Favorites remain available for this session.
    }
  }, [favoriteWordIds])

  useEffect(() => {
    const dialog = wordDialogRef.current
    if (!dialog) return

    if (selectedDictionaryWord && !dialog.open) dialog.showModal()
    if (!selectedDictionaryWord && dialog.open) dialog.close()
  }, [selectedDictionaryWord])

  useEffect(() => {
    try {
      window.localStorage.setItem(ACTIVITY_DAYS_KEY, JSON.stringify(activityDays))
    } catch {
      // Streak tracking is optional.
    }
  }, [activityDays])

  useEffect(() => {
    try {
      window.localStorage.setItem(COMPLETED_LESSONS_KEY, JSON.stringify(completedLessonIds))
    } catch {
      // Course completion remains available for this session.
    }
  }, [completedLessonIds])

  useEffect(() => {
    if (!examStarted || examFinished || examSecondsLeft <= 0) return

    const timer = window.setInterval(() => {
      setExamSecondsLeft(seconds => {
        if (seconds <= 1) {
          setExamFinished(true)
          return 0
        }
        return seconds - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [examStarted, examFinished])

  useEffect(() => {
    document.documentElement.lang = lang === 'uz' ? 'uz-Latn' : lang
  }, [lang])

  // Load the signed-in user's preferred language.
  useEffect(() => {
    let cancelled = false
    const changeAtStart = localeChangeRef.current

    const loadProfileLocale = async () => {
      if (!supabase) return

      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user || cancelled || localeChangeRef.current !== changeAtStart) return

        const { data } = await supabase
          .from('user_preferences')
          .select('language')
          .eq('user_id', user.id)
          .maybeSingle()

        if (
          !cancelled &&
          localeChangeRef.current === changeAtStart &&
          data &&
          isLocale(data.language)
        ) {
          setLang(data.language)

          try {
            window.localStorage.setItem(GUEST_LOCALE_KEY, data.language)
          } catch {
            // Profile remains authoritative.
          }
        }
      } catch {
        // Keep the locally persisted preference.
      }
    }

    void loadProfileLocale()

    return () => {
      cancelled = true
    }
  }, [])

  const changeLanguage = async (next: Locale) => {
    const requestId = ++localeChangeRef.current

    setLang(next)

    try {
      window.localStorage.setItem(GUEST_LOCALE_KEY, next)
    } catch {
      // UI preference still changes for this session.
    }

    setNotice({
      text: translate(next, 'profile.languageLocal'),
      kind: 'success',
    })

    if (!supabase) return

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user || requestId !== localeChangeRef.current) return

      const { error } = await supabase
        .from('user_preferences')
        .upsert(
          { user_id: user.id, language: next },
          { onConflict: 'user_id' },
        )

      if (error) throw error

      if (requestId === localeChangeRef.current) {
        setNotice({
          text: translate(next, 'profile.languageSaved'),
          kind: 'success',
        })
      }
    } catch {
      if (requestId === localeChangeRef.current) {
        setNotice({
          text: translate(next, 'profile.languageSaveError'),
          kind: 'error',
        })
      }
    }
  }

  // Keep the original HanziPath course collection distinct from the HSK-aligned views.
  // HSK membership is shown only where the authored curriculum explicitly assigns it.
  const currentWords = vocabularyCollection === 'course'
    ? originalLessonWords
    : databaseSystem === (vocabularyCollection === 'all' ? 'all' : system) ? (databaseWords ?? []) : []
  const currentFavoriteCount = useMemo(
    () => currentWords.filter(word => favoriteWordIds.includes(wordId(word))).length,
    [currentWords, favoriteWordIds],
  )
  // Course exercises must use the dedicated HanziPath course vocabulary.
  // The HSK dictionary can be on a different standard than the selected course;
  // using currentWords here left cards and listening empty whenever they differed.
  const lessonEntries = originalLessonWords
  const lessonAssignments = useMemo(() => lessonWordAssignments(lessonEntries), [lessonEntries])
  const courseUnitCatalog = useMemo(() => {
    const catalog: Record<string, CourseUnit[]> = {}
    for (const standard of ['2.0', '3.0'] as const) {
      const levels = standard === '2.0' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 7, 8, 9]
      for (const level of levels) {
        catalog[`${standard}:${level}`] = buildCourseUnits(standard, level as CourseLevel, lessonEntries, lessonAssignments)
      }
    }
    return catalog
  }, [lessonEntries, lessonAssignments])
  const courseUnits = courseUnitCatalog[`${courseSystem}:${courseLevel}`] ?? []
  const practiceUnits = courseUnitCatalog[`${practiceSystem}:${practiceLevel}`] ?? []
  const practiceLessons = practiceUnits.flatMap(unit => unit.lessons)
  const practiceSelectedLesson = practiceLessons.find(lesson => lesson.id === practiceUnitId) ?? practiceLessons[0]
  const practiceUnit = practiceUnits.find(unit => unit.lessons.some(lesson => lesson.id === practiceSelectedLesson?.id))
  const assignedPracticeWords = practiceSelectedLesson ? lessonAssignments[practiceSelectedLesson.id] : []
  const practiceWords = [...new Map((assignedPracticeWords?.length ? assignedPracticeWords : practiceUnit?.words ?? []).map(word => [wordId(word), word])).values()]
  const practiceLessonLabel = practiceSelectedLesson
    ? `${practiceSelectedLesson.chapter}${practiceSelectedLesson.part > 1 ? `.${practiceSelectedLesson.part}` : ''} ${practiceSelectedLesson.title}`
    : ''
  const courseLessons = lessonTemplates.filter(lesson => lesson.system === courseSystem && lesson.level === courseLevel)
  const activeUnit = courseUnits.find(unit => unit.id === activeLessonId)
  const activeLesson = activeUnit?.lessons[0]
  const activeUnitLessons = activeUnit?.lessons ?? []
  const activeLessonWords = activeUnit?.words ?? []
  useEffect(() => {
    if (activeLessonId && !activeUnit) setActiveLessonId(null)
  }, [activeLessonId, activeUnit])
  const lessonFocusWords = activeLessonWords.slice(0, 3)
  const lessonHanzi = lessonFocusWords.map(word => word.hanzi)
  const lessonPinyin = lessonFocusWords.map(word => word.pinyin)
  const lessonWordGlosses = lessonFocusWords.map(word => word.ru).filter(Boolean)
  const activeClosingReading = (activeLesson?.id === 'hsk-1-1-1' || activeLesson?.id === 'hsk30-1-1-1')
    ? firstLessonReading
    : activeLesson?.id === 'hsk-1-2-1'
      ? {
        hanzi: '我在大学学习汉语。我们班有很多学生，王老师是我们的汉语老师。每天上午我们在教室读课本、听老师说汉语，也练习写汉字。下课以后，我和同学一起做作业。',
        pinyin: 'Wǒ zài dàxué xuéxí Hànyǔ. Wǒmen bān yǒu hěn duō xuésheng, Wáng lǎoshī shì wǒmen de Hànyǔ lǎoshī. Měitiān shàngwǔ wǒmen zài jiàoshì dú kèběn, tīng lǎoshī shuō Hànyǔ, yě liànxí xiě Hànzì. Xiàkè yǐhòu, wǒ hé tóngxué yìqǐ zuò zuòyè.',
        meaning: {
          ru: 'Я изучаю китайский язык в университете. В нашей группе много студентов, преподаватель Ван — наш учитель китайского. Каждое утро мы читаем учебник в аудитории, слушаем, как учитель говорит по-китайски, и тренируемся писать иероглифы. После занятий я делаю домашнее задание вместе с однокурсниками.',
          en: 'I study Chinese at the university. There are many students in our class, and Teacher Wang is our Chinese teacher. Every morning we read the textbook in the classroom, listen to the teacher speak Chinese, and practise writing characters. After class, I do homework with my classmates.',
          uz: 'Men universitetda xitoy tilini o‘rganaman. Guruhimizda ko‘p talabalar bor, Van ustoz bizning xitoy tili o‘qituvchimiz. Har kuni ertalab auditoriyada darslikni o‘qiymiz, ustozning xitoycha gapirishini tinglaymiz va ieroglif yozishni mashq qilamiz. Darsdan keyin kursdoshlarim bilan uy vazifasini bajaramiz.',
        },
        options: {
          ru: ['Студенты изучают китайский язык в университете.', 'Студенты учат английский дома.', 'Преподаватель Ван изучает математику.', 'После уроков студенты идут в магазин.'],
          en: ['The students study Chinese at the university.', 'The students study English at home.', 'Teacher Wang studies mathematics.', 'After class, the students go shopping.'],
          uz: ['Talabalar universitetda xitoy tilini o‘rganadilar.', 'Talabalar uyda ingliz tilini o‘rganadilar.', 'Van ustoz matematikani o‘rganadi.', 'Darsdan keyin talabalar xarid qilishga boradilar.'],
        },
      }
      : activeLesson ? (() => {
      const example = activeLesson.grammar.example.replace(/[。！？!?]+$/, '')
      const vocabularyPhrase = lessonHanzi.length ? lessonHanzi.join('、') : activeLesson.grammar.title
      const pinyinPhrase = lessonPinyin.length ? lessonPinyin.join(', ') : ''
      const glossPhrase = lessonWordGlosses.length ? lessonWordGlosses.join('、') : activeLesson.grammar.title
      const meaningRu = `${activeLesson.grammar.meaning} Мы используем слова «${glossPhrase}», чтобы потренировать тему урока. Сначала прочитай текст, затем попробуй пересказать его самостоятельно.`
      const meaningEn = `${activeLesson.grammar.meaning} We use the lesson words (${glossPhrase}) to practise this topic. Read the text first, then try to retell it yourself.`
      const meaningUz = `${activeLesson.grammar.meaning} Dars mavzusini mashq qilish uchun «${glossPhrase}» so‘zlaridan foydalanamiz. Avval matnni o‘qing, keyin uni mustaqil qayta aytib ko‘ring.`
      return {
        hanzi: `${example}。我们用${vocabularyPhrase}练习今天的内容。请先读一遍，再自己说一次。`,
        pinyin: `${activeLesson.grammar.pinyin} Wǒmen yòng ${pinyinPhrase || 'xīn cí'} liànxí jīntiān de nèiróng. Qǐng xiān dú yí biàn, zài zìjǐ shuō yí cì.`,
        meaning: { ru: meaningRu, en: meaningEn, uz: meaningUz },
        options: {
          ru: [meaningRu, ...closingReading.options.ru.slice(1)],
          en: [meaningEn, ...closingReading.options.en.slice(1)],
          uz: [meaningUz, ...closingReading.options.uz.slice(1)],
        },
      }
    })() : closingReading
  const dialogueLines = activeLesson ? (activeLesson.id === 'hsk-1-2-1'
    ? [
      { key: 'class-dialogue-1', speaker: t('course.speaker.learner'), hanzi: '老师，您好！您是我们的汉语老师吗？', pinyin: 'Lǎoshī, nín hǎo! Nín shì wǒmen de Hànyǔ lǎoshī ma?', meaning: lang === 'ru' ? 'Здравствуйте, учитель! Вы наш преподаватель китайского языка?' : lang === 'uz' ? 'Assalomu alaykum, ustoz! Siz bizning xitoy tili o‘qituvchimizmisiz?' : 'Hello, teacher! Are you our Chinese teacher?' },
      { key: 'class-dialogue-2', speaker: t('course.speaker.teacher'), hanzi: '是的，我是王老师。你们是新学生吗？', pinyin: 'Shì de, wǒ shì Wáng lǎoshī. Nǐmen shì xīn xuésheng ma?', meaning: lang === 'ru' ? 'Да, я преподаватель Ван. Вы новые студенты?' : lang === 'uz' ? 'Ha, men Van ustozman. Sizlar yangi talabamisiz?' : 'Yes, I am Teacher Wang. Are you new students?' },
      { key: 'class-dialogue-3', speaker: t('course.speaker.learner'), hanzi: '是的。我们在大学学习汉语。', pinyin: 'Shì de. Wǒmen zài dàxué xuéxí Hànyǔ.', meaning: lang === 'ru' ? 'Да. Мы изучаем китайский язык в университете.' : lang === 'uz' ? 'Ha. Biz universitetda xitoy tilini o‘rganamiz.' : 'Yes. We study Chinese at the university.' },
      { key: 'class-dialogue-4', speaker: t('course.speaker.teacher'), hanzi: '很好。请打开课本，跟我读。', pinyin: 'Hěn hǎo. Qǐng dǎkāi kèběn, gēn wǒ dú.', meaning: lang === 'ru' ? 'Отлично. Откройте учебник и читайте за мной.' : lang === 'uz' ? 'Juda yaxshi. Darslikni oching va men bilan o‘qing.' : 'Very good. Please open your textbook and read after me.' },
      { key: 'class-dialogue-5', speaker: t('course.speaker.learner'), hanzi: '我们今天读汉字，也写汉字吗？', pinyin: 'Wǒmen jīntiān dú Hànzì, yě xiě Hànzì ma?', meaning: lang === 'ru' ? 'Сегодня мы читаем иероглифы и тоже пишем их?' : lang === 'uz' ? 'Bugun ierogliflarni o‘qiymiz va yozamizmi?' : 'Will we read and also write Chinese characters today?' },
      { key: 'class-dialogue-6', speaker: t('course.speaker.teacher'), hanzi: '对。先听，再说，最后写。', pinyin: 'Duì. Xiān tīng, zài shuō, zuìhòu xiě.', meaning: lang === 'ru' ? 'Верно. Сначала слушаем, затем говорим и в конце пишем.' : lang === 'uz' ? 'To‘g‘ri. Avval tinglaymiz, keyin gapiramiz, oxirida yozamiz.' : 'Correct. First listen, then speak, and finally write.' },
      { key: 'class-dialogue-7', speaker: t('course.speaker.learner'), hanzi: '我明白了。我会认真学习。', pinyin: 'Wǒ míngbai le. Wǒ huì rènzhēn xuéxí.', meaning: lang === 'ru' ? 'Я понял. Я буду старательно учиться.' : lang === 'uz' ? 'Tushundim. Men astoydil o‘qiyman.' : 'I understand. I will study carefully.' },
      { key: 'class-dialogue-8', speaker: t('course.speaker.teacher'), hanzi: '很好！下课以后，记得做作业。', pinyin: 'Hěn hǎo! Xiàkè yǐhòu, jìde zuò zuòyè.', meaning: lang === 'ru' ? 'Отлично! После занятий не забудьте выполнить домашнее задание.' : lang === 'uz' ? 'Juda yaxshi! Darsdan keyin uy vazifasini bajarishni unutmang.' : 'Excellent! Remember to do your homework after class.' },
    ]
    : (activeLesson.id === 'hsk-1-1-1' || activeLesson.id === 'hsk30-1-1-1')
    ? [
      {
        key: 'lesson-example',
        speaker: t('course.speaker.teacher'),
        hanzi: activeLesson.grammar.example,
        pinyin: activeLesson.grammar.pinyin,
        meaning: activeLesson.grammar.meaning,
      },
      ...classroomDialogue.map(line => ({
        ...line,
        speaker: t(line.key === 'teacher' ? 'course.speaker.teacher' : 'course.speaker.learner'),
        meaning: line.meaning[lang],
      })),
    ]
    : [
      {
        key: 'teacher-intro',
        speaker: t('course.speaker.teacher'),
        hanzi: `今天我们学习${lessonHanzi.length ? lessonHanzi.join('、') : '这个主题'}。`,
        pinyin: `Jīntiān wǒmen xuéxí ${lessonPinyin.length ? lessonPinyin.join(', ') : 'zhège zhǔtí'}.`,
        meaning: lang === 'ru'
          ? `Сегодня мы изучаем новые слова: ${lessonWordGlosses.join(', ') || activeLesson.title}.`
          : lang === 'uz'
            ? `Bugun biz yangi so‘zlarni o‘rganamiz: ${lessonWordGlosses.join(', ') || activeLesson.title}.`
            : `Today we are learning these new words: ${lessonWordGlosses.join(', ') || activeLesson.title}.`,
      },
      {
        key: 'learner-question',
        speaker: t('course.speaker.learner'),
        hanzi: '这些词怎么用？',
        pinyin: 'Zhèxiē cí zěnme yòng?',
        meaning: lang === 'ru' ? 'Как использовать эти слова?' : lang === 'uz' ? 'Bu so‘zlardan qanday foydalaniladi?' : 'How do we use these words?',
      },
      {
        key: 'teacher-example',
        speaker: t('course.speaker.teacher'),
        hanzi: activeLesson.grammar.example,
        pinyin: activeLesson.grammar.pinyin,
        meaning: activeLesson.grammar.meaning,
      },
      {
        key: 'learner-response',
        speaker: t('course.speaker.learner'),
        hanzi: '我明白了，我来试一试。',
        pinyin: 'Wǒ míngbai le, wǒ lái shì yi shì.',
        meaning: lang === 'ru' ? 'Понятно, я попробую.' : lang === 'uz' ? 'Tushundim, o‘zim sinab ko‘raman.' : 'I understand. I will try it.',
      },
    ]) : []
  const courseFallbackWords = wordsForCourseLevel(lessonEntries, courseSystem, courseLevel)
  const studyWords = activeLessonWords.length ? activeLessonWords : courseFallbackWords
  const knownInCurrentWords = knownWords.filter(id => currentWords.some(word => wordId(word) === id)).length
  const activeCard = practiceWords.length ? practiceWords[cardIndex % practiceWords.length] : undefined
  const listeningWord = practiceWords.length ? practiceWords[listeningIndex % practiceWords.length] : undefined
  const listeningOptions = useMemo(() => {
    if (!listeningWord) return []
    const options = [listeningWord, ...practiceWords.filter(word => wordId(word) !== wordId(listeningWord)).slice(0, 3)]
    const offset = listeningIndex % options.length
    return [...options.slice(offset), ...options.slice(0, offset)]
  }, [practiceWords, listeningIndex, listeningWord])
  const recordActivity = () => {
    const today = localDateKey()
    setActivityDays(days => days.includes(today) ? days : [...days, today].slice(-400))
  }

  const filtered = useMemo(() => {
    return currentWords.filter(word => {
      const searchable = [
        word.hanzi,
        word.traditional,
        word.pinyin,
        word.ru,
        word.en,
        word.uz,
      ].filter(Boolean).join(' ')

      const normalizedQuery = normalizePinyin(query)
      const activeLevel = vocabularyCollection === 'course'
        ? word.courseStage
        : system === '2.0' ? word.level20 : word.level30

      return (
        (level === 'all' || String(activeLevel).replace('7-9', '7') === level) &&
        (!favoritesOnly || favoriteWordIds.includes(wordId(word))) &&
        (
          searchable.toLocaleLowerCase().includes(query.toLocaleLowerCase()) ||
          (
            normalizedQuery !== '' &&
            normalizePinyin(word.pinyin).includes(normalizedQuery)
          )
        )
      )
    })
  }, [currentWords, favoriteWordIds, favoritesOnly, level, query, system, vocabularyCollection])

  useEffect(() => setDictionaryPage(0), [system, level, query, vocabularyCollection, favoritesOnly])

  const pageSize = 60
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visibleWords = filtered.slice(dictionaryPage * pageSize, (dictionaryPage + 1) * pageSize)

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'zh-CN'

      window.speechSynthesis.speak(utterance)
    }
  }

  const levels = system === '2.0'
    ? ['150', '300', '600', '1200', '2500', '5000']
    : ['300', '500', '1000', '2000', '3600', '5400', '11000']

  const levelNames = system === '2.0'
    ? ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6']
    : ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6', 'HSK 7–9']

  const levelFilterOptions = Array.from({ length: vocabularyCollection === 'all' ? 0 : vocabularyCollection === 'course' ? 6 : system === '2.0' ? 6 : 7 }, (_, index) => {
    const isCombinedBand = vocabularyCollection === 'hsk' && system === '3.0' && index === 6
    const value = isCombinedBand ? '7-9' : String(index + 1)
    const count = currentWords.filter(word => String(
      vocabularyCollection === 'course'
        ? word.courseStage
        : system === '2.0' ? word.level20 : word.level30,
    ) === value).length
    return {
      value: isCombinedBand ? '7' : value,
      label: vocabularyCollection === 'course'
        ? `${t('vocab.courseStage')} ${index + 1} · ${count}`
        : `${system === '2.0' ? 'HSK 2.0' : 'HSK 3.0'} · ${t('vocab.hskLevel')} ${isCombinedBand ? '7–9' : index + 1} · ${count}`,
    }
  })

  const activeSectionName = section < 7
    ? t(navKeys[section])
    : t('page.profile')

  const vocabularyMeaning = (word: Word) =>
    lang === 'ru'
      ? word.ru || t('vocab.translationUnavailable')
      : lang === 'en'
        ? word.en || t('vocab.translationUnavailable')
        : word.uz
          ? word.uz
          : t('vocab.translationUnavailable')

  const exampleMeaning = (word: Word) => {
    if (lang === 'ru') return word.exampleRu
    if (lang === 'en') return word.exampleEn

    return word.exampleUzVerified && word.exampleUz
      ? word.exampleUz
      : t('vocab.exampleUnavailable')
  }

  const translationStatusLabel = (status?: string) =>
    !status
      ? null
      : t(status === 'ai_draft_unverified' ? 'vocab.aiDraft' : 'vocab.sourceUnverified')

  const toggleFavorite = (word: Word) => {
    const id = wordId(word)
    setFavoriteWordIds(items => items.includes(id)
      ? items.filter(item => item !== id)
      : [...items, id])
  }

  const toggleKnownWord = (word: Word) => {
    const id = wordId(word)
    if (knownWords.includes(id)) {
      setKnownWords(items => items.filter(item => item !== id))
      return
    }

    setKnownWords(items => items.includes(id) ? items : [...items, id])
    recordActivity()
  }

  const dictionaryLevelLabel = (word: Word, standard: System) => {
    const value = standard === '2.0' ? word.level20 : word.level30
    if (value === null || value === undefined || value === '') return null
    return `HSK ${String(value).replace('7-9', '7–9')}`
  }

  const selectedExamQuestion = examQuestionsState[examIndex]
  const examCorrectCount = examQuestionsState.reduce((total, question, index) => {
    if (question.manualReview) return total
    const response = examAnswers[index] ?? ''
    const correct = question.section === 'writing'
      ? normalizeWrittenAnswer(response) === normalizeWrittenAnswer(question.answer)
      : response === question.answer
    return total + (correct ? 1 : 0)
  }, 0)
  const examScoredCount = examQuestionsState.filter(question => !question.manualReview).length
  const examManualCount = examQuestionsState.reduce((total, question, index) => total + (
    question.manualReview && Boolean(examAnswers[index]?.trim()) ? 1 : 0
  ), 0)
  const examManualTotal = examQuestionsState.filter(question => question.manualReview).length

  const startExam = () => {
    const generated = examQuestions(examSystem, examLevel, currentWords, lang)
    setExamQuestionsState(generated)
    setExamAnswers(Array(generated.length).fill(''))
    setExamIndex(0)
    setExamSecondsLeft(examFormat(examSystem, examLevel).minutes * 60)
    setExamFinished(false)
    setExamStarted(true)
  }

  const selectExamAnswer = (answer: string) => {
    setExamAnswers(current => current.map((item, index) => index === examIndex ? answer : item))
  }

  const moveExamForward = () => {
    if (examIndex + 1 >= examQuestionsState.length) setExamFinished(true)
    else setExamIndex(index => index + 1)
  }

  return <div className="app">
    <aside className={`sidebar ${menu ? 'show' : ''}`} aria-label={t('nav.group')}>
      <div className="brand">
        <div className="brandmark" aria-hidden="true">汉</div>
        <div><b>HanziPath</b><small>汉字之路</small></div>
        <button className="mobile-close" aria-label={t('common.closeMenu')} onClick={() => setMenu(false)}><X/></button>
      </div>

      <div className="side-label">{t('nav.group')}</div>

      {navKeys.map((key, i) => (
        <button
          key={key}
          className={`navitem ${section === i ? 'active' : ''}`}
          onClick={() => { setSection(i); setMenu(false) }}
        >
          {navIcons[i]}
          <span>{t(key)}</span>
          {i === 2 && <span className="navcount">{filtered.length.toLocaleString(lang)}</span>}
        </button>
      ))}

      <div className="side-bottom">
        <div className="streak">
          <Flame/>
          <div>
            <b>{getStreak(activityDays)} {lang === 'ru' ? 'дн.' : lang === 'uz' ? 'kun' : t('common.days')}</b>
            <small>{t('dashboard.streak')}</small>
          </div>
        </div>

        <button
          className={`navitem profile-link ${section === 7 ? 'active' : ''}`}
          onClick={() => { setSection(7); setMenu(false) }}
        >
          <Settings/>
          <span>{t('profile.settings')}</span>
        </button>

        <div className="profile">
          <div className="avatar">H</div>
          <div className="profile-name">
            <b>{userEmail ?? t('profile.guest')}</b>
            <small>{userEmail ? t('auth.accountConnected') : t('profile.settings')}</small>
          </div>
          <button className="profile-action" title={t('profile.signIn')} aria-label={t('profile.signIn')} onClick={() => userEmail ? void signOut() : setAuthOpen(true)}>
            <LockKeyhole size={17}/>
          </button>
        </div>
      </div>
    </aside>

    {menu && <button className="scrim" aria-label={t('common.closeMenu')} onClick={() => setMenu(false)}/>}

    <main className="main">
      <header className="topbar">
        <button className="hamb" aria-label={t('common.openMenu')} onClick={() => setMenu(true)}><Menu/></button>

        <div className="crumb">HanziPath <span>/</span> {activeSectionName}</div>

        <div className="top-actions">
          <label className="language-select">
            <Languages size={17}/>
            <span className="sr-only">{t('language.label')}</span>
            <select
              aria-label={t('language.label')}
              value={lang}
              onChange={e => void changeLanguage(e.target.value as Locale)}
            >
              {(['ru', 'en', 'uz'] as const).map(locale => (
                <option key={locale} value={locale}>{localeLabels[locale]}</option>
              ))}
            </select>
          </label>

          <button className="signin" onClick={() => userEmail ? void signOut() : setAuthOpen(true)}>
            <LockKeyhole size={16}/>
            <span>{userEmail ? t('auth.signOut') : t('profile.signIn')}</span>
          </button>
        </div>
      </header>


      {authOpen && (
        <div className="auth-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setAuthOpen(false) }}>
          <section className="auth-card" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <button className="auth-close" type="button" onClick={() => setAuthOpen(false)} aria-label={t('common.closeMenu')}>×</button>
            <span className="kicker">HANZIPATH</span>
            <h2 id="auth-title">{authMode === 'signup' ? t('auth.createAccount') : t('auth.welcomeBack')}</h2>
            <p>{t('auth.saveProgress')}</p>
            <div className="auth-fields">
              <label>{t('auth.email')}<input type="email" autoComplete="email" required value={authEmail} onChange={event => setAuthEmail(event.target.value)} placeholder="name@example.com"/></label>
              <label>{t('auth.password')}<input type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} minLength={6} required value={authPassword} onChange={event => setAuthPassword(event.target.value)} placeholder="••••••••"/></label>
              {authFeedback && <p className={`auth-feedback ${authFeedback.kind}`} role="status">{authFeedback.text}</p>}
              <button className="primary auth-submit" type="button" disabled={authBusy || !authEmail.trim() || authPassword.length < 6} onClick={() => void submitAuth()}>{authBusy ? t('auth.pleaseWait') : authMode === 'signup' ? t('auth.createAccount') : t('profile.signIn')}</button>
            </div>
            <button className="auth-switch" type="button" onClick={() => { setAuthFeedback(null); setAuthMode(mode => mode === 'signup' ? 'signin' : 'signup') }}>{authMode === 'signup' ? t('auth.haveAccount') : t('auth.noAccount')}</button>
          </section>
        </div>
      )}

      {notice && (
        <div className={`notice ${notice.kind}`} role="status">
          <span>{notice.text}</span>
          <button aria-label={t('common.closeMenu')} onClick={() => setNotice(null)}><X size={16}/></button>
        </div>
      )}

      {section === 0 && <section className="hp-dashboard">
        <div className="hp-welcome">
          <div>
            <span className="hp-eyebrow">{lang === 'ru' ? 'ТВОЙ ПУТЬ К КИТАЙСКОМУ' : lang === 'uz' ? 'XITOY TILIGA YO‘LINGIZ' : 'YOUR JOURNEY INTO CHINESE'}</span>
            <h1>{lang === 'ru' ? 'Добро пожаловать в HanziPath' : lang === 'uz' ? 'HanziPath’ga xush kelibsiz' : 'Welcome to HanziPath'}</h1>
            <p>{lang === 'ru' ? 'Системное изучение китайского языка по уровням HSK' : lang === 'uz' ? 'HSK darajalari bo‘yicha xitoy tilini tizimli o‘rganing' : 'A structured way to learn Chinese, one HSK level at a time'}</p>
          </div>
          <div className="hp-welcome-art" aria-hidden="true"><span>汉</span><i>汉字之路</i></div>
        </div>

        <div className="hp-dashboard-grid">
          <section className="hp-resume">
            <div className="hp-resume-art" aria-hidden="true"><span>中</span><i>山</i></div>
            <div className="hp-resume-copy">
              <span className="hp-eyebrow">{lang === 'ru' ? 'ТВОЙ СЛЕДУЮЩИЙ ШАГ' : lang === 'uz' ? 'KEYINGI QADAM' : 'PICK UP WHERE YOU LEFT OFF'}</span>
              <h2>{lang === 'ru' ? 'Продолжить обучение' : lang === 'uz' ? 'O‘qishni davom ettirish' : 'Continue learning'}</h2>
              <p>HSK {courseSystem} · {lang === 'ru' ? 'Этап' : lang === 'uz' ? 'Bosqich' : 'Level'} {courseLevel}</p>
              <div className="hp-resume-progress"><span><i style={{width: `${Math.min(100, Math.round(knownInCurrentWords / Math.max(1,currentWords.length) * 100))}%`}}/></span><b>{currentWords.length ? Math.round(knownInCurrentWords / currentWords.length * 100) : 0}%</b></div>
              <button className="hp-gold-button" onClick={() => setSection(1)}>{lang === 'ru' ? 'Продолжить' : lang === 'uz' ? 'Davom etish' : 'Continue'} <ChevronRight size={17}/></button>
            </div>
          </section>

          <section className="hp-progress-card">
            <div className="hp-card-heading"><span>{lang === 'ru' ? 'Мой прогресс' : lang === 'uz' ? 'Mening natijam' : 'My progress'}</span><span className="hp-mini-seal">进</span></div>
            <div className="hp-progress-ring" style={{'--hp-progress': `${currentWords.length ? Math.round(knownInCurrentWords / currentWords.length * 100) : 0}%`} as React.CSSProperties}><strong>{currentWords.length ? Math.round(knownInCurrentWords / currentWords.length * 100) : 0}%</strong></div>
            <b className="hp-progress-count">{knownInCurrentWords.toLocaleString(lang)} / {currentWords.length.toLocaleString(lang)}</b>
            <small>{t('dashboard.wordsLearned')}</small>
          </section>
        </div>

        <section className="hp-path-section">
          <div className="hp-section-heading"><div><span className="hp-eyebrow">{lang === 'ru' ? 'ТВОЯ ПРОГРАММА' : lang === 'uz' ? 'O‘QUV DASTURINGIZ' : 'YOUR CURRICULUM'}</span><h2>{lang === 'ru' ? 'Мой учебный путь' : lang === 'uz' ? 'Mening o‘quv yo‘lim' : 'My learning path'}</h2></div><button onClick={() => setSection(1)}>{lang === 'ru' ? 'Все уровни' : lang === 'uz' ? 'Barcha darajalar' : 'All levels'} <ChevronRight size={15}/></button></div>
          <div className="hp-path-track">
            <button className={courseSystem === '2.0' ? 'done' : ''} onClick={() => {setCourseSystem('2.0');setCourseLevel(1);setSection(1)}}><span className="hp-path-icon"><CheckCircle2 size={20}/></span><b>HSK 2.0</b><small>{lang === 'ru' ? 'Классическая программа' : lang === 'uz' ? 'Klassik dastur' : 'Classic curriculum'}</small></button>
            <span className="hp-path-arrow">→</span>
            <button className={courseSystem === '3.0' ? 'current' : ''} onClick={() => {setCourseSystem('3.0');setCourseLevel(1);setSection(1)}}><span className="hp-path-icon"><span className="hp-path-spinner"/></span><b>HSK 3.0</b><small>{lang === 'ru' ? 'Текущий курс' : lang === 'uz' ? 'Joriy kurs' : 'Current course'}</small></button>
            <span className="hp-path-arrow">→</span>
            <div className="locked"><span className="hp-path-icon"><LockKeyhole size={18}/></span><b>HSK 4.0</b><small>{lang === 'ru' ? 'Скоро' : lang === 'uz' ? 'Tez orada' : 'Coming soon'}</small></div>
            <span className="hp-path-arrow">→</span>
            <div className="locked"><span className="hp-path-icon"><LockKeyhole size={18}/></span><b>HSK 5.0</b><small>{lang === 'ru' ? 'Скоро' : lang === 'uz' ? 'Tez orada' : 'Coming soon'}</small></div>
          </div>
        </section>

        <section className="hp-tools-section">
          <div className="hp-section-heading"><div><span className="hp-eyebrow">{lang === 'ru' ? 'УЧИСЬ В СВОЁМ ТЕМПЕ' : lang === 'uz' ? 'O‘Z SUR’ATINGIZDA O‘RGANING' : 'STUDY AT YOUR OWN PACE'}</span><h2>{lang === 'ru' ? 'Инструменты обучения' : lang === 'uz' ? 'O‘quv vositalari' : 'Learning tools'}</h2></div></div>
          <div className="hp-tools-grid">
            <button className="hp-tool-card" onClick={() => setSection(2)}><span><BookOpen size={25}/></span><b>{t('nav.vocabulary')}</b><small>{currentWords.length.toLocaleString(lang)} {lang === 'ru' ? 'слов' : lang === 'uz' ? 'so‘z' : 'words'}</small></button>
            <button className="hp-tool-card" onClick={() => setSection(3)}><span><Layers size={25}/></span><b>{t('nav.flashcards')}</b><small>{lang === 'ru' ? 'Повторение слов' : lang === 'uz' ? 'So‘zlarni takrorlash' : 'Word review'}</small></button>
            <button className="hp-tool-card" onClick={() => setSection(4)}><span><Headphones size={25}/></span><b>{t('nav.listening')}</b><small>{lang === 'ru' ? 'Тренировка слуха' : lang === 'uz' ? 'Tinglab tushunish' : 'Listening practice'}</small></button>
            <button className="hp-tool-card" onClick={() => setSection(5)}><span><GraduationCap size={25}/></span><b>{t('nav.grammar')}</b><small>{lang === 'ru' ? 'Правила и примеры' : lang === 'uz' ? 'Qoidalar va misollar' : 'Rules and examples'}</small></button>
            <button className="hp-tool-card" onClick={() => setSection(6)}><span><CheckCircle2 size={25}/></span><b>{t('nav.tests')}</b><small>{lang === 'ru' ? 'Проверка знаний' : lang === 'uz' ? 'Bilimni tekshirish' : 'Test your knowledge'}</small></button>
          </div>
        </section>

        <section className="hp-daily-row">
          <div className="hp-daily-streak"><Flame size={21}/><div><b>{getStreak(activityDays)} {lang === 'ru' ? 'дней подряд' : lang === 'uz' ? 'kun ketma-ket' : 'day streak'}</b><small>{lang === 'ru' ? 'Твоя учебная серия' : lang === 'uz' ? 'O‘quv seriyangiz' : 'Your learning streak'}</small></div></div>
          <div className="hp-daily-tasks"><div><b>{lang === 'ru' ? 'Задачи на сегодня' : lang === 'uz' ? 'Bugungi vazifalar' : 'Today’s goals'}</b><small>{done.filter(Boolean).length}/3 {lang === 'ru' ? 'выполнено' : lang === 'uz' ? 'bajarildi' : 'completed'}</small></div><div className="hp-task-checks">{done.map((isDone,index)=><button key={index} className={isDone?'checked':''} aria-label={`Task ${index+1}`} onClick={()=>{setDone(items=>items.map((value,i)=>i===index?!value:value));if(!isDone)recordActivity()}}>{isDone?'✓':index+1}</button>)}</div></div>
        </section>
      </section>}

      {section === 1 && (
        <section className="panel learning-page course-page">
          <div className="panel-head">
            <div><span className="kicker">{t('course.kicker')}</span><h2>{t('course.title')}</h2></div>
            <span className="demo-tag">HSK {courseSystem}</span>
          </div>
          <p className="notice-text">{t('course.intro')}</p>

          <div className="standard-switch" role="group" aria-label={t('vocab.system')}>
            {(['2.0', '3.0'] as const).map(standard => <button key={standard} className={`outline ${courseSystem === standard ? 'selected' : ''}`} onClick={() => {
              setCourseSystem(standard)
              setCourseLevel(1)
              setActiveLessonId(null)
              setLessonListeningChoice(null)
              setClosingChoice(null)
              setShowAnswer(false)
              setCardIndex(0)
            }}>HSK {standard}</button>)}
          </div>

          <div className="course-levels" role="group" aria-label={t('course.level')}>
            {(courseSystem === '2.0' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 7, 8, 9]).map(course => {
              const units = courseUnitCatalog[`${courseSystem}:${course}`] ?? []
              const count = units.length
              const completed = units.filter(unit => unit.lessons.every(item => completedLessonIds.includes(item.id))).length
              return <button key={course} className={`course-level ${courseLevel === course ? 'selected' : ''}`} onClick={() => {
                setCourseLevel(course as CourseLevel)
                setActiveLessonId(null)
                setLessonListeningChoice(null)
                setClosingChoice(null)
                setListeningChoice(null)
                setShowAnswer(false)
                setCardIndex(0)
                setListeningIndex(0)
              }}>
                <b>HSK {courseSystem} · {course}</b><span>{count} {t('course.lessonCount')}</span>
                {courseSystem === '3.0' && course >= 7 && <small>{t('course.stage')} · 7–9</small>}
                <small>{completed}/{count} {t('course.progress')}</small>
              </button>
            })}
          </div>

          {courseSystem === '3.0' && courseLevel >= 7 && <p className="notice-text shared-band-note">{t('course.sharedBandNote')}</p>}

          {activeLessonId && activeLesson && <div className="lesson-detail">
            <button className="outline lesson-back" onClick={() => { setActiveLessonId(null); setLessonListeningChoice(null); setClosingChoice(null) }}>‹ {t('course.back')}</button>
            <div className="lesson-detail-heading">
              <div><span className="kicker">HSK {courseSystem} · {courseLevel}{courseSystem === '3.0' && courseLevel >= 7 ? ` · ${t('course.stage')}` : ''} · {t('course.lesson')} {activeLesson.chapter}{activeLesson.part > 1 ? `.${activeLesson.part}` : ''}</span><h2>{activeLesson.title}</h2></div>
              <span className="demo-tag">{activeLesson.minutes} {t('common.minutes')}</span>
            </div>

            <nav className="lesson-route" aria-label={t('course.lessonFlow')}>
              {lessonFlowKeys.map((key, index) => <span key={key}><i>{String(index + 1).padStart(2, '0')}</i>{t(key)}</span>)}
            </nav>

            <section className="course-block lesson-opening">
              <span className="kicker">01 · {t('course.topicIntro')}</span>
              <h3>{activeLesson.title}</h3>
              <p>{t('course.topicWarmup')}</p>
              <div className="lesson-theme-words">
                {activeLessonWords.slice(0, 4).map(word => <span key={wordId(word)}>{word.hanzi}</span>)}
              </div>
            </section>

            <section className="course-block">
              <div className="course-block-head"><div><span className="kicker">02 · {t('course.newWords')}</span><h3>{newWordsCountLabel(activeLessonWords.length, lang)}</h3></div>
                {activeLessonWords.length > 0 && <button className="primary" onClick={() => { setCardIndex(0); setShowAnswer(false); setSection(3) }}>{t('course.cards')}<ChevronRight size={16}/></button>}
              </div>
              {activeLessonWords.length ? <div className="lesson-words">
                {activeLessonWords.map(word => <article className="lesson-word" key={wordId(word)}>
                  <div className="lesson-word-main"><b>{word.hanzi}</b><span>{word.pinyin}</span></div>
                  <div className="lesson-word-meanings"><span><i>RU</i>{word.ru || t('vocab.translationUnavailable')}</span><span><i>EN</i>{word.en || t('vocab.translationUnavailable')}</span><span><i>UZ</i>{word.uz || t('vocab.translationUnavailable')}</span></div>
                  {word.ruStatus || word.uzStatus ? <small className="lesson-word-status">{[...new Set([word.ruStatus, word.uzStatus].map(status => translationStatusLabel(status)).filter(Boolean))].join(' · ')}</small> : null}
                </article>)}
              </div> : <p className="notice-text">{t('course.noWords')}</p>}
              {activeLessonWords.some(word => word.courseStage !== undefined) && <p className="source-credit">{t('course.originalVocabularyNote')}</p>}
              {Boolean(reviewWords?.length) && <p className="source-credit">{t('course.translationNote')}</p>}
            </section>

            <section className="course-block lesson-dialogue">
              <div className="course-block-head"><div><span className="kicker">03 · {t('course.readingDialogue')}</span><h3>{t('course.readingCue')}</h3></div></div>
              <ol className="dialogue-script">
                {dialogueLines.map((line, index) => <li key={line.key}>
                  <span className="dialogue-speaker">{line.speaker}</span>
                  <div className="dialogue-line-copy">
                    <b className="dialogue-hanzi">{line.hanzi}</b>
                    <span className="dialogue-pinyin">{line.pinyin}</span>
                    <small>{line.meaning}</small>
                  </div>
                  <button className="sound" onClick={() => speak(line.hanzi)} aria-label={`${t('vocab.listen')}: ${line.hanzi}`}><Volume2 size={17}/></button>
                </li>)}
              </ol>
            </section>

            <section className="course-block grammar-focus">
              <div className="course-block-head"><div><span className="kicker">04 · {t('course.grammar')}</span><h3>{activeLesson.grammar.title}</h3></div>
                <button className="sound" aria-label={t('vocab.listen')} onClick={() => speak(activeLesson.grammar.example)}><Volume2 size={18}/></button>
              </div>
              <p>{activeLesson.grammar.explanation}</p>
              <code>{activeLesson.grammar.pattern}</code>
              <div className="lesson-example"><b>{activeLesson.grammar.example}</b><span>{activeLesson.grammar.pinyin}</span><small>{activeLesson.grammar.meaning}</small></div>
              {activeLesson.grammar.deepDive && <div className="grammar-deep-dive">
                <h4>{lang === 'ru' ? 'Подробный разбор' : lang === 'uz' ? 'Batafsil tushuntirish' : 'In-depth explanation'}</h4>
                <p>{activeLesson.grammar.deepDive}</p>
              </div>}
              {activeLesson.grammar.extraExamples?.length ? <div className="grammar-extra-examples">
                <h4>{lang === 'ru' ? 'Ещё примеры' : lang === 'uz' ? 'Qo‘shimcha misollar' : 'More examples'}</h4>
                {activeLesson.grammar.extraExamples.map(example => <div className="lesson-example" key={example.hanzi}><b>{example.hanzi}</b><span>{example.pinyin}</span><small>{example.meaning}</small></div>)}
              </div> : null}
              {activeLesson.grammar.commonMistakes?.length ? <div className="grammar-mistakes">
                <h4>{lang === 'ru' ? 'Частые ошибки' : lang === 'uz' ? 'Ko‘p uchraydigan xatolar' : 'Common mistakes'}</h4>
                <ul>{activeLesson.grammar.commonMistakes.map(mistake => <li key={mistake}>{mistake}</li>)}</ul>
              </div> : null}
              {activeLesson.grammar.studySteps?.length ? <div className="grammar-extra-examples">
                <h4>{lang === 'ru' ? 'Как освоить тему' : lang === 'uz' ? 'Mavzuni qanday o‘zlashtirish' : 'How to master this topic'}</h4>
                <ol>{activeLesson.grammar.studySteps.map(step => <li key={step}>{step}</li>)}</ol>
              </div> : null}
              {activeLesson.grammar.practicePrompts?.length ? <div className="grammar-deep-dive">
                <h4>{lang === 'ru' ? 'Самостоятельная практика' : lang === 'uz' ? 'Mustaqil mashq' : 'Independent practice'}</h4>
                <ul>{activeLesson.grammar.practicePrompts.map(prompt => <li key={prompt}>{prompt}</li>)}</ul>
              </div> : null}
              {activeUnitLessons.length > 1 && <div className="grammar-extra-examples">
                <h4>{lang === 'ru' ? 'Остальные грамматические темы этого урока' : lang === 'uz' ? 'Ushbu darsning boshqa grammatika mavzulari' : 'Other grammar points in this lesson'}</h4>
                {activeUnitLessons.slice(1).map(item => <article className="lesson-example" key={item.id}>
                  <b>{item.grammar.title}</b><code>{item.grammar.pattern}</code>
                  <p>{item.grammar.explanation}</p>
                  <strong>{item.grammar.example}</strong><span>{item.grammar.pinyin}</span><small>{item.grammar.meaning}</small>
                  {item.grammar.extraExamples?.map(example => <div key={example.hanzi}><b>{example.hanzi}</b><span>{example.pinyin}</span><small>{example.meaning}</small></div>)}
                </article>)}
              </div>}
            </section>

            <section className="course-block lesson-listening">
              <div className="course-block-head"><div><span className="kicker">05 · {t('course.listen')}</span><h3>{t('course.listenPrompt')}</h3></div>
                <button className="primary" onClick={() => speak(activeLesson.grammar.example)}><Volume2 size={17}/>{t('exam.play')}</button>
              </div>
              <div className="answer-options">
                {shuffleWithSeed([
                  activeLesson.grammar.meaning,
                  ...lessonTemplates.filter(item => item.system === courseSystem && item.level === courseLevel && item.id !== activeLesson.id).map(item => item.grammar.meaning).filter((meaning, index, all) => all.indexOf(meaning) === index).slice(0, 3),
                ], activeLesson.chapter + activeLesson.part).map((meaning, index) => {
                  const correct = meaning === activeLesson.grammar.meaning
                  const selected = lessonListeningChoice === meaning
                  return <button key={`${meaning}-${index}`} className={`answer-option ${lessonListeningChoice && correct ? 'correct' : ''} ${selected && !correct ? 'incorrect' : ''}`} disabled={Boolean(lessonListeningChoice)} onClick={() => {
                    setLessonListeningChoice(meaning)
                    if (correct) recordActivity()
                  }}><span>{meaning}</span></button>
                })}
              </div>
              {lessonListeningChoice && <p className={`feedback ${lessonListeningChoice === activeLesson.grammar.meaning ? 'success' : 'error'}`}>{lessonListeningChoice === activeLesson.grammar.meaning ? t('listening.correct') : t('listening.incorrect')}</p>}
              {lessonListeningChoice && <button className="outline" onClick={() => setLessonListeningChoice(null)}>{t('listening.next')}</button>}
            </section>

            <section className="course-block lesson-unassisted-reading">
              <div className="course-block-head"><div><span className="kicker">06 · {t('course.finalReading')}</span><h3>{t('course.readWithoutPinyin')}</h3></div>
                <button className="sound" onClick={() => speak(activeClosingReading.hanzi)} aria-label={`${t('vocab.listen')}: ${activeClosingReading.hanzi}`}><Volume2 size={18}/></button>
              </div>
              <p className="unassisted-text" lang="zh-CN">{activeClosingReading.hanzi}</p>\n              <details className="reading-pinyin-toggle"><summary>{lang === 'ru' ? 'Открыть пиньинь и подсказку' : lang === 'uz' ? 'Pinyin va yordamni ochish' : 'Show pinyin and hint'}</summary><p className="unassisted-pinyin">{activeClosingReading.pinyin}</p></details>
              <p className="reading-question">{t('course.readingQuestion')}</p>
              <div className="answer-options">
                {activeClosingReading.options[lang].map((option, index) => <button key={option} className={`answer-option ${closingChoice !== null && index === 0 ? 'correct' : ''} ${closingChoice === index && index !== 0 ? 'incorrect' : ''}`} disabled={closingChoice !== null} onClick={() => {
                  setClosingChoice(index)
                  if (index === 0) recordActivity()
                }}><span>{option}</span></button>)}
              </div>
              {closingChoice !== null && <p className={`feedback ${closingChoice === 0 ? 'success' : 'error'}`}>{closingChoice === 0 ? t('listening.correct') : t('listening.incorrect')}</p>}
            </section>

            <section className="course-block lesson-review">
              <div className="course-block-head"><div><span className="kicker">07 · {t('course.finalReview')}</span><h3>{t('course.reviewPrompt')}</h3></div></div>
              <div className="lesson-recap-grid">
                <div className="lesson-recap-item">
                  <b>{t('course.reviewWords')} · {activeLessonWords.length}</b>
                  <ul>{activeLessonWords.map(word => <li key={wordId(word)}><strong>{word.hanzi}</strong><span>{word.pinyin} · {localeMeaning(word, lang) || t('vocab.translationUnavailable')}</span></li>)}</ul>
                </div>
                <div className="lesson-recap-item">
                  <b>{t('course.reviewGrammar')}</b>
                  <p>{activeLesson.grammar.title}</p>
                  <code>{activeLesson.grammar.pattern}</code>
                </div>
                <div className="lesson-recap-item">
                  <b>{t('course.reviewText')}</b>
                  <p className="recap-hanzi" lang="zh-CN">{activeClosingReading.hanzi}</p>
                  <span>{activeClosingReading.meaning[lang]}</span>
                </div>
              </div>
            </section>

            {activeUnitLessons.map(item => <LessonPractice key={item.id} lessonId={item.id} grammar={item.grammar} words={activeLessonWords} locale={lang} />)}

            <div className="lesson-finish-row">
              <button className="outline" onClick={() => setSection(5)}>{t('course.grammar')}<ChevronRight size={16}/></button>
              <button className="primary" disabled={activeUnitLessons.length > 0 && activeUnitLessons.every(item => completedLessonIds.includes(item.id))} onClick={() => {
                setCompletedLessonIds(ids => [...new Set([...ids, ...activeUnitLessons.map(item => item.id)])])
                recordActivity()
              }}>{activeUnitLessons.length > 0 && activeUnitLessons.every(item => completedLessonIds.includes(item.id)) ? <><CheckCircle2 size={17}/>{t('course.completed')}</> : t('course.markComplete')}</button>
            </div>
          </div>}

          {!activeLessonId && <div className="lesson-list course-lesson-grid">
            {courseUnits.map((unit, index) => {
              const lesson = unit.lessons[0]
              const completed = unit.lessons.every(item => completedLessonIds.includes(item.id))
              const grammarCount = unit.lessons.length
              return <article className={`lesson-card course-lesson-card ${completed ? 'completed' : ''}`} key={unit.id}>
                <span className="lesson-number">{String(index + 1).padStart(2, '0')}</span>
                <div><h3>{lesson.title}</h3><p>{newWordsCountLabel(unit.words.length, lang)} · {grammarCount} {lang === 'ru' ? 'тем грамматики' : lang === 'uz' ? 'grammatika mavzusi' : 'grammar points'}</p><code>{unit.lessons.map(item => item.grammar.title).join(' · ')}</code></div>
              <button className="course-open" onClick={() => {
                setActiveLessonId(unit.id)
                setLessonListeningChoice(null)
                setClosingChoice(null)
                setListeningChoice(null)
                setCardIndex(0)
                setListeningIndex(0)
                setShowAnswer(false)
              }} aria-label={`${t('course.open')}: ${lesson.title}`}>{completed ? <CheckCircle2 size={18}/> : <ChevronRight size={19}/>}</button>
              </article>
            })}
          </div>}
        </section>
      )}

      {section === 2 && (
        <section className="panel dictionary">
          <div className="panel-head">
            <div>
              <span className="kicker">{t('vocab.kicker')}</span>
              <h2>{t('vocab.title')}</h2>
            </div>
            <span className="demo-tag">
              {t(vocabularyCollection === 'course' ? 'vocab.courseCollection' : vocabularyCollection === 'all' ? 'vocab.allCandidateCollection' : 'vocab.hskCollection')}
            </span>
          </div>

          <p className="notice-text">{t(vocabularyCollection === 'course' ? 'vocab.courseNotice' : 'vocab.hskCatalogNotice')}</p>

          <div className="filters collection-switch" role="group" aria-label="Dictionary collection">
            <button type="button" className={vocabularyCollection === 'hsk' ? 'primary' : 'outline'} aria-pressed={vocabularyCollection === 'hsk'} onClick={() => { setVocabularyCollection('hsk'); setLevel('all') }}>
              {lang === 'ru' ? 'Словарь HSK' : lang === 'uz' ? 'HSK lug‘ati' : 'HSK dictionary'}
            </button>
            <button type="button" className={vocabularyCollection === 'course' ? 'primary' : 'outline'} aria-pressed={vocabularyCollection === 'course'} onClick={() => { setVocabularyCollection('course'); setLevel('all') }}>
              {lang === 'ru' ? 'Слова курса HanziPath' : lang === 'uz' ? 'HanziPath kurs so‘zlari' : 'HanziPath course words'}
            </button>
            <button type="button" className={vocabularyCollection === 'all' ? 'primary' : 'outline'} aria-pressed={vocabularyCollection === 'all'} onClick={() => { setVocabularyCollection('all'); setLevel('all') }}>
              {t('vocab.allCandidateCollection')}
            </button>
          </div>

          {vocabularyCollection !== 'all' && <div className="filters standard-switch" role="group" aria-label="HSK standard">
            <button type="button" className={system === '2.0' ? 'primary' : 'outline'} aria-pressed={system === '2.0'} onClick={() => { setSystem('2.0'); setLevel('all') }}>HSK 2.0</button>
            <button type="button" className={system === '3.0' ? 'primary' : 'outline'} aria-pressed={system === '3.0'} onClick={() => { setSystem('3.0'); setLevel('all') }}>HSK 3.0</button>
          </div>}

          {(vocabularyCollection === 'course' || databaseSystem === (vocabularyCollection === 'all' ? 'all' : system)) && <>
            <div className="dictionary-summary">
              <div><strong>{currentWords.length.toLocaleString(lang)}</strong><span>{t(vocabularyCollection === 'course' ? 'vocab.wordsInCourse' : vocabularyCollection === 'all' ? 'vocab.allCandidateWords' : system === '2.0' ? 'vocab.wordsInHsk20' : 'vocab.wordsInHsk30')}</span></div>
              <div><strong>{filtered.length.toLocaleString(lang)}</strong><span>{t('vocab.matchingWords')}</span></div>
              <div><strong>{currentFavoriteCount.toLocaleString(lang)}</strong><span>{t('vocab.savedFavorites')}</span></div>
              <div><strong>{pageSize}</strong><span>{t('vocab.resultsPerPage')}</span></div>
            </div>
          </>}
          {vocabularyCollection !== 'course' && catalogLoading && <p className="notice-text">{t('vocab.catalogLoadingPublic')}</p>}
          {vocabularyCollection !== 'course' && catalogError && <p className="notice-text" role="alert">{t('vocab.catalogLoadError')}</p>}

          

          <div className="filters">
            <label className="searchbox">
              <Search size={18}/>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t('vocab.search')}
              />
            </label>



            <label className="sr-only" htmlFor="level-filter">{t('vocab.level')}</label>
            <select id="level-filter" value={level} onChange={e => setLevel(e.target.value)}>
              <option value="all">{t('vocab.allLevels')}</option>
              {levelFilterOptions.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>

            <button
              className={`outline favorites-filter ${favoritesOnly ? 'selected' : ''}`}
              type="button"
              aria-pressed={favoritesOnly}
              onClick={() => setFavoritesOnly(value => !value)}
            >
              <Star size={15} fill={favoritesOnly ? 'currentColor' : 'none'}/>
              {favoritesOnly ? t('vocab.showAllWords') : t('vocab.favorites')}
              <span>{currentFavoriteCount.toLocaleString(lang)}</span>
            </button>
          </div>

          

          <div className="results-bar">
            <span>{filtered.length.toLocaleString(lang)} {t('vocab.results')}</span>
            {filtered.length > pageSize && <span>{t('vocab.page')} {dictionaryPage + 1} / {pageCount}</span>}
          </div>

          <div className="wordlist">
            {visibleWords.map((word, i) => (
              <article className="word" key={`${word.hanzi}-${word.pinyin}-${i}`}>
                <div className="word-card-head">
                  <button
                    type="button"
                    className="word-open"
                    onClick={() => setSelectedDictionaryWord(word)}
                    aria-label={`${t('vocab.openDetails')}: ${word.hanzi}, ${word.pinyin}`}
                  >
                    <span className="word-main">
                      <strong>{word.hanzi}</strong>
                      <span><b>{word.pinyin}</b><small>{t('vocab.openDetails')}</small></span>
                    </span>
                    <ChevronRight size={17}/>
                  </button>

                  <span className="level-pill">
                    {`${vocabularyCollection === 'course' || word.courseStage ? `${t('vocab.courseStageShort')} ${word.courseStage}` : dictionaryLevelLabel(word, system) ?? (lang === 'ru' ? 'Вне уровня' : 'Unlevelled')}`}
                  </span>

                  <button
                    className={`sound favorite-button ${favoriteWordIds.includes(wordId(word)) ? 'is-favorite' : ''}`}
                    type="button"
                    onClick={() => toggleFavorite(word)}
                    title={favoriteWordIds.includes(wordId(word)) ? t('vocab.removeFavorite') : t('vocab.addFavorite')}
                    aria-label={`${favoriteWordIds.includes(wordId(word)) ? t('vocab.removeFavorite') : t('vocab.addFavorite')}: ${word.hanzi}`}
                    aria-pressed={favoriteWordIds.includes(wordId(word))}
                  >
                    <Star size={17} fill={favoriteWordIds.includes(wordId(word)) ? 'currentColor' : 'none'}/>
                  </button>

                  <button
                    className="sound"
                    type="button"
                    onClick={() => speak(word.hanzi)}
                    title={t('vocab.listen')}
                    aria-label={`${t('vocab.listen')}: ${word.hanzi}`}
                  >
                    <Volume2 size={18}/>
                  </button>
                </div>

                <div className="word-meanings">
                  <div><b>RU</b><span>{word.ru || t('vocab.translationUnavailable')}</span>{word.ruStatus && <small>{translationStatusLabel(word.ruStatus)}</small>}</div>
                  <div><b>EN</b><span>{word.en || t('vocab.translationUnavailable')}</span>{word.enStatus && <small>{translationStatusLabel(word.enStatus)}</small>}</div>
                  <div><b>UZ</b><span>{word.uz || t('vocab.translationUnavailable')}</span>{word.uzStatus && <small>{translationStatusLabel(word.uzStatus)}</small>}</div>
                </div>

                {word.example && (
                  <div className="example">
                    <span>{word.example}</span>
                    <small>{word.examplePinyin} · {exampleMeaning(word)}</small>
                  </div>
                )}
              </article>
            ))}

            {filtered.length === 0 && <div className="empty">{t('vocab.noResults')}</div>}
          </div>

          {filtered.length > pageSize && <nav className="dictionary-pager" aria-label={t('vocab.pagination')}>
            <button className="outline" disabled={dictionaryPage === 0} onClick={() => setDictionaryPage(page => Math.max(0, page - 1))}>{t('vocab.previousPage')}</button>
            <span>{t('vocab.page')} {dictionaryPage + 1} / {pageCount}</span>
            <button className="outline" disabled={dictionaryPage + 1 >= pageCount} onClick={() => setDictionaryPage(page => Math.min(pageCount - 1, page + 1))}>{t('vocab.nextPage')}</button>
          </nav>}
        </section>
      )}

      {section === 3 && activeCard && (
        <section className="panel learning-page">
          <div className="panel-head">
            <div><span className="kicker">{t('flashcards.kicker')}</span><h2>{t('flashcards.title')}</h2></div>
            <span className="demo-tag">HSK {practiceSystem} · {practiceLevel}</span>
          </div>
          <p className="notice-text">{t('flashcards.notice')}</p>
          <div className="practice-filters">
            <label><span>{lang === 'ru' ? 'Стандарт' : lang === 'uz' ? 'Standart' : 'Standard'}</span><select value={practiceSystem} onChange={event => { const next = event.target.value as CourseSystem; setPracticeSystem(next); setPracticeLevel(1); setPracticeUnitId(null); setCardIndex(0); setShowAnswer(false); setListeningIndex(0); setListeningChoice(null) }}><option value="2.0">HSK 2.0</option><option value="3.0">HSK 3.0</option></select></label>
            <label><span>HSK {lang === 'ru' ? 'уровень' : lang === 'uz' ? 'daraja' : 'level'}</span><select value={practiceLevel} onChange={event => { setPracticeLevel(Number(event.target.value) as CourseLevel); setPracticeUnitId(null); setCardIndex(0); setShowAnswer(false); setListeningIndex(0); setListeningChoice(null) }}>{(practiceSystem === '2.0' ? [1,2,3,4,5,6] : [1,2,3,4,5,6,7,8,9]).map(level => <option key={level} value={level}>{practiceSystem === '3.0' && level >= 7 ? `HSK 3.0 · ${level}` : `HSK ${practiceSystem} · ${level}`}</option>)}</select></label>
            <label><span>{lang === 'ru' ? 'Урок' : lang === 'uz' ? 'Dars' : 'Lesson'}</span><select value={practiceSelectedLesson?.id ?? ''} onChange={event => { setPracticeUnitId(event.target.value || null); setCardIndex(0); setShowAnswer(false); setListeningIndex(0); setListeningChoice(null) }}>{practiceLessons.map(lesson => <option key={lesson.id} value={lesson.id}>{`${lesson.chapter}${lesson.part > 1 ? `.${lesson.part}` : ''} ${lesson.title}`}</option>)}</select></label>
          </div>
          <p className="practice-count">{practiceLessonLabel} · {practiceWords.length} {lang === 'ru' ? 'слов' : lang === 'uz' ? 'so‘z' : 'words'}</p>
          <article className="study-card">
            <span className="study-hanzi">{activeCard.hanzi}</span>
            {showAnswer && <div className="study-answer">
              <b>{activeCard.pinyin}</b>
              <span>{vocabularyMeaning(activeCard)}</span>
              {activeCard.example && <small>{activeCard.example} · {activeCard.examplePinyin}</small>}
            </div>}
          </article>
          <div className="study-actions">
            {!showAnswer && <button className="primary" onClick={() => setShowAnswer(true)}>{t('flashcards.showAnswer')}</button>}
            {showAnswer && <>
              <button className="outline" onClick={() => { setShowAnswer(false); setCardIndex(i => (i + 1) % practiceWords.length) }}>{t('flashcards.again')}</button>
              <button className="primary" onClick={() => {
                const id = wordId(activeCard)
                setKnownWords(items => items.includes(id) ? items : [...items, id])
                recordActivity()
                setShowAnswer(false)
                setCardIndex(i => (i + 1) % practiceWords.length)
              }}>{t('flashcards.markKnown')}</button>
            </>}
          </div>
          <div className="study-footer">
            <button className="outline" aria-label={t('flashcards.previous')} onClick={() => { setShowAnswer(false); setCardIndex(i => (i + practiceWords.length - 1) % practiceWords.length) }}>‹</button>
            <span>{t('flashcards.counter')} {cardIndex % practiceWords.length + 1} / {practiceWords.length} · {t('flashcards.knownCount')}: {practiceWords.filter(word => knownWords.includes(wordId(word))).length}</span>
            <button className="outline" aria-label={t('flashcards.next')} onClick={() => { setShowAnswer(false); setCardIndex(i => (i + 1) % practiceWords.length) }}>›</button>
          </div>
        </section>
      )}

      {section === 3 && !activeCard && (
        <section className="panel learning-page"><div className="empty">{t('course.noWords')}</div></section>
      )}

      {section === 4 && listeningWord && (
        <section className="panel learning-page">
          <div className="panel-head"><div><span className="kicker">{t('listening.kicker')}</span><h2>{t('listening.title')}</h2></div><span className="demo-tag">HSK {practiceSystem} · {practiceLevel}</span></div>
          <p className="notice-text">{t('listening.notice')}</p>
          <div className="practice-filters">
            <label><span>{lang === 'ru' ? 'Стандарт' : lang === 'uz' ? 'Standart' : 'Standard'}</span><select value={practiceSystem} onChange={event => { const next = event.target.value as CourseSystem; setPracticeSystem(next); setPracticeLevel(1); setPracticeUnitId(null); setListeningIndex(0); setListeningChoice(null) }}><option value="2.0">HSK 2.0</option><option value="3.0">HSK 3.0</option></select></label>
            <label><span>HSK {lang === 'ru' ? 'уровень' : lang === 'uz' ? 'daraja' : 'level'}</span><select value={practiceLevel} onChange={event => { setPracticeLevel(Number(event.target.value) as CourseLevel); setPracticeUnitId(null); setListeningIndex(0); setListeningChoice(null) }}>{(practiceSystem === '2.0' ? [1,2,3,4,5,6] : [1,2,3,4,5,6,7,8,9]).map(level => <option key={level} value={level}>{`HSK ${practiceSystem} · ${level}`}</option>)}</select></label>
            <label><span>{lang === 'ru' ? 'Урок' : lang === 'uz' ? 'Dars' : 'Lesson'}</span><select value={practiceSelectedLesson?.id ?? ''} onChange={event => { setPracticeUnitId(event.target.value || null); setListeningIndex(0); setListeningChoice(null) }}>{practiceLessons.map(lesson => <option key={lesson.id} value={lesson.id}>{`${lesson.chapter}${lesson.part > 1 ? `.${lesson.part}` : ''} ${lesson.title}`}</option>)}</select></label>
          </div>
          <p className="practice-count">{practiceLessonLabel} · {practiceWords.length} {lang === 'ru' ? 'слов для практики' : lang === 'uz' ? 'ta mashq so‘zi' : 'practice words'}</p>
          <div className="practice-prompt">
            <p>{t('listening.prompt')}</p>
            <button className="primary" onClick={() => speak(listeningWord.hanzi)}><Volume2 size={18}/>{t('listening.play')}</button>
          </div>
          <div className="answer-options">
            {listeningOptions.map(option => {
              const selected = listeningChoice === option.hanzi
              const correct = option.hanzi === listeningWord.hanzi
              return <button key={wordId(option)} className={`answer-option ${listeningChoice && correct ? 'correct' : ''} ${selected && !correct ? 'incorrect' : ''}`} disabled={Boolean(listeningChoice)} onClick={() => {
                setListeningChoice(option.hanzi)
                if (correct) recordActivity()
              }}><span>{option.hanzi}</span><small>{option.pinyin}</small></button>
            })}
          </div>
          {listeningChoice && <p className={`feedback ${listeningChoice === listeningWord.hanzi ? 'success' : 'error'}`}>{t(listeningChoice === listeningWord.hanzi ? 'listening.correct' : 'listening.incorrect')}</p>}
          <button className="primary" onClick={() => { setListeningIndex(i => (i + 1) % practiceWords.length); setListeningChoice(null) }}>{t('listening.next')}<ChevronRight size={16}/></button>
        </section>
      )}

      {section === 4 && !listeningWord && (
        <section className="panel learning-page"><div className="empty">{t('course.noWords')}</div></section>
      )}

      {section === 5 && (
        <section className="panel learning-page">
          <div className="panel-head"><div><span className="kicker">{t('grammar.kicker')}</span><h2>{t('grammar.title')}</h2></div><span className="demo-tag">HSK {courseSystem}</span></div>
          <p className="notice-text">{t('grammar.notice')}</p>
          <div className="standard-switch" role="group" aria-label={t('vocab.system')}>
            {(['2.0', '3.0'] as const).map(standard => <button key={standard} className={`outline ${courseSystem === standard ? 'selected' : ''}`} onClick={() => { setCourseSystem(standard); setCourseLevel(1); setActiveLessonId(null) }}>HSK {standard}</button>)}
          </div>
          <div className="course-levels" role="group" aria-label={t('course.level')}>
            {(courseSystem === '2.0' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 7, 8, 9]).map(course => <button key={course} className={`course-level ${courseLevel === course ? 'selected' : ''}`} onClick={() => { setCourseLevel(course as CourseLevel); setActiveLessonId(null) }}><b>HSK {courseSystem} · {course}</b><span>{lessonTemplates.filter(item => item.system === courseSystem && item.level === course).length} {t('course.lessonCount')}</span></button>)}
          </div>
          {courseSystem === '3.0' && courseLevel >= 7 && <p className="notice-text shared-band-note">{t('course.sharedBandNote')}</p>}
          <div className="lesson-list">
            {courseLessons.map(lesson => <article className="lesson-card grammar-lesson-card" key={lesson.id}>
              <span className="lesson-number">{String(lesson.chapter).padStart(2, '0')}{lesson.part > 1 ? `.${lesson.part}` : ''}</span>
              <div><h3>{lesson.grammar.title}</h3><p>{lesson.title} · {lesson.grammar.explanation}</p><code>{lesson.grammar.pattern}</code>
                <div className="lesson-example"><b>{lesson.grammar.example}</b><span>{lesson.grammar.pinyin}</span><small>{lesson.grammar.meaning}</small></div>
              </div>
              <button className="sound" aria-label={t('vocab.listen')} onClick={() => speak(lesson.grammar.example)}><Volume2 size={18}/></button>
              <button className="outline grammar-open" onClick={() => setGrammarExpandedId(current => current === lesson.id ? null : lesson.id)}>{grammarExpandedId === lesson.id ? (lang === 'ru' ? 'Свернуть' : lang === 'uz' ? 'Yopish' : 'Collapse') : (lang === 'ru' ? 'Подробнее' : lang === 'uz' ? 'Batafsil' : 'Details')}</button>
              {grammarExpandedId === lesson.id && <div className="grammar-expanded">{lesson.grammar.deepDive && <p>{lesson.grammar.deepDive}</p>}{lesson.grammar.extraExamples?.map(example => <div className="lesson-example" key={example.hanzi}><b>{example.hanzi}</b><span>{example.pinyin}</span><small>{example.meaning}</small></div>)}{lesson.grammar.commonMistakes?.length ? <><h4>{lang === 'ru' ? 'Частые ошибки' : lang === 'uz' ? 'Ko‘p uchraydigan xatolar' : 'Common mistakes'}</h4><ul>{lesson.grammar.commonMistakes.map(item => <li key={item}>{item}</li>)}</ul></> : null}{lesson.grammar.studySteps?.length ? <><h4>{lang === 'ru' ? 'Как освоить тему' : lang === 'uz' ? 'Mavzuni o‘zlashtirish' : 'Study steps'}</h4><ol>{lesson.grammar.studySteps.map(item => <li key={item}>{item}</li>)}</ol></> : null}</div>}
            </article>)}
          </div>
        </section>
      )}

      {section === 6 && (
        <section className="panel learning-page exam-page">
          <div className="panel-head"><div><span className="kicker">{t('exam.kicker')}</span><h2>{t('exam.title')}</h2></div><span className="demo-tag">HSK {examSystem}</span></div>
          <p className="notice-text">{t('exam.intro')}</p>

          {!examStarted && <>
            <div className="standard-switch" role="group" aria-label={t('vocab.system')}>
              {(['2.0', '3.0'] as const).map(standard => <button key={standard} className={`outline ${examSystem === standard ? 'selected' : ''}`} onClick={() => { setExamSystem(standard); setExamLevel(1) }}>HSK {standard}</button>)}
            </div>
            <div className="course-levels exam-levels" role="group" aria-label={t('exam.level')}>
              {(examSystem === '2.0' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 7]).map(course => {
                const selectedFormat = examFormat(examSystem, course as CourseLevel)
                const total = selectedFormat.listening + selectedFormat.reading + selectedFormat.writing + selectedFormat.translation + selectedFormat.speaking
                return <button key={course} className={`course-level ${examLevel === course ? 'selected' : ''}`} onClick={() => setExamLevel(course as CourseLevel)}><b>{examSystem === '3.0' && course === 7 ? 'HSK 3.0 · 7–9' : `HSK ${examSystem} · ${course}`}</b><span>{total} {t('exam.questions')}</span><small>{selectedFormat.minutes} {t('exam.minutes')}</small></button>
              })}
            </div>
            <div className="exam-format">
              {(() => {
                const format = examFormat(examSystem, examLevel)
                const title = examSystem === '3.0' && examLevel >= 7 ? 'HSK 3.0 · 7–9' : `HSK ${examSystem} · ${examLevel}`
                const total = format.listening + format.reading + format.writing + format.translation + format.speaking
                return <>
                  <h3>{t('exam.format')} · {title}</h3>
                  <div><span>{t('exam.listening')}</span><b>{format.listening} <small>({partSummary(format.listeningParts)})</small></b></div>
                  <div><span>{t('exam.reading')}</span><b>{format.reading} <small>({partSummary(format.readingParts)})</small></b></div>
                  {format.writing > 0 && <div><span>{t('exam.writing')}</span><b>{format.writing} <small>({partSummary(format.writingParts)})</small></b></div>}
                  {format.translation > 0 && <div><span>{t('exam.translation')}</span><b>{format.translation} <small>({partSummary(format.translationParts)})</small></b></div>}
                  {format.speaking > 0 && <div><span>{t('exam.speaking')}</span><b>{format.speaking} <small>({partSummary(format.speakingParts)})</small></b></div>}
                  <div className="exam-total"><span>{format.minutes} {t('exam.minutes')}</span><b>{total} {t('exam.questions')}</b></div>
                </>
              })()}
            </div>
            <button className="primary exam-start" onClick={startExam}>{t('exam.start')}<ChevronRight size={17}/></button>
          </>}

          {examStarted && examFinished && <div className="exam-result">
            <div className="review-icon"><CheckCircle2/></div>
            <span className="kicker">{examSystem === '3.0' && examLevel >= 7 ? 'HSK 3.0 · 7–9' : `HSK ${examSystem} · ${examLevel}`} · {t('exam.result')}</span>
            <strong>{examCorrectCount} / {examScoredCount}</strong>
            <p>{examCorrectCount >= Math.ceil(examScoredCount * .6) ? t('exam.pass') : t('exam.notPass')}</p>
            {examManualTotal > 0 && <p className="notice-text">{examManualCount} / {examManualTotal} · {t('exam.manualTasks')}</p>}
            <button className="primary" onClick={startExam}>{t('exam.retry')}</button>
          </div>}

          {examStarted && !examFinished && selectedExamQuestion && <div className="exam-active">
            <div className="exam-active-head">
              <div><span className="kicker">{t(`exam.${selectedExamQuestion.section}` as TranslationKey)} · {t('exam.part')} {selectedExamQuestion.part}</span><h3>{t('exam.progress')} {examIndex + 1} / {examQuestionsState.length}</h3></div>
              <span className="exam-clock">{t('exam.timeLeft')} · {formatExamTime(examSecondsLeft)}</span>
            </div>
            <div className="exam-progress"><i style={{ width: `${(examIndex + 1) / examQuestionsState.length * 100}%` }}/></div>
            <div className="exam-question">
              <p>{selectedExamQuestion.prompt}</p>
              {selectedExamQuestion.section === 'listening' && <button className="primary" onClick={() => speak(selectedExamQuestion.audio ?? '')}><Volume2 size={18}/>{t('exam.play')}</button>}
              {selectedExamQuestion.options.length === 0 ? <textarea className="exam-writing-answer" rows={selectedExamQuestion.manualReview ? 5 : 1} value={examAnswers[examIndex] ?? ''} onChange={event => selectExamAnswer(event.target.value)} placeholder={t('exam.answerPlaceholder')}/> : <div className="answer-options">
                {selectedExamQuestion.options.map((option, index) => {
                  const selected = (examAnswers[examIndex] ?? '') === option
                  const answered = Boolean(examAnswers[examIndex])
                  const correct = option === selectedExamQuestion.answer
                  return <button key={`${option}-${index}`} className={`answer-option ${answered && correct ? 'correct' : ''} ${selected && !correct ? 'incorrect' : ''}`} disabled={answered} onClick={() => selectExamAnswer(option)}><span>{option}</span></button>
                })}
              </div>}
              {selectedExamQuestion.section === 'listening' && examAnswers[examIndex] && <p className="exam-reveal">{selectedExamQuestion.audio} · {selectedExamQuestion.pinyin}</p>}
            </div>
            <div className="study-footer"><span>{examCorrectCount} {t('exam.correct')}</span><button className="primary" onClick={moveExamForward}>{examIndex + 1 === examQuestionsState.length ? t('exam.finish') : t('exam.next')}<ChevronRight size={16}/></button></div>
          </div>}
        </section>
      )}

      {section === 7 && (
        <section className="panel settings-page">
          <div className="review-icon"><Settings/></div>
          <span className="kicker">HANZIPATH</span>
          <h2>{t('profile.settings')}</h2>

          <label className="setting-row">
            <span>{t('language.label')}</span>
            <select value={lang} onChange={e => void changeLanguage(e.target.value as Locale)}>
              {(['ru', 'en', 'uz'] as const).map(locale => (
                <option key={locale} value={locale}>{t(`language.${locale}` as TranslationKey)}</option>
              ))}
            </select>
          </label>

          <p>{supabase ? t('profile.languageSaved') : t('profile.languageLocal')}</p>
        </section>
      )}

      <dialog
        ref={wordDialogRef}
        className="word-detail-dialog"
        aria-labelledby="word-detail-title"
        onClose={() => setSelectedDictionaryWord(null)}
        onClick={event => {
          if (event.target === event.currentTarget) event.currentTarget.close()
        }}
      >
        {selectedDictionaryWord && <div className="word-detail">
          <header className="word-detail-header">
            <div>
              <span className="kicker">{t('vocab.wordDetails')}</span>
              <h2 id="word-detail-title">{selectedDictionaryWord.hanzi}</h2>
            </div>
            <button
              className="word-detail-close"
              type="button"
              autoFocus
              aria-label={t('vocab.closeDetails')}
              onClick={() => wordDialogRef.current?.close()}
            >
              <X size={19}/>
            </button>
          </header>

          <div className="word-detail-pronunciation">
            <div>
              <strong>{selectedDictionaryWord.pinyin || t('vocab.translationUnavailable')}</strong>
              {selectedDictionaryWord.traditional && selectedDictionaryWord.traditional !== selectedDictionaryWord.hanzi && <span>{t('vocab.traditional')}: {selectedDictionaryWord.traditional}</span>}
            </div>
            <button className="primary" type="button" onClick={() => speak(selectedDictionaryWord.hanzi)}>
              <Volume2 size={17}/>{t('vocab.listen')}
            </button>
          </div>

          <div className="word-detail-levels">
            {dictionaryLevelLabel(selectedDictionaryWord, '2.0') && <span>{t('vocab.hsk20')} · {dictionaryLevelLabel(selectedDictionaryWord, '2.0')}</span>}
            {dictionaryLevelLabel(selectedDictionaryWord, '3.0') && <span>{t('vocab.hsk30')} · {dictionaryLevelLabel(selectedDictionaryWord, '3.0')}</span>}
            {selectedDictionaryWord.courseStage && <span>{t('vocab.courseStage')} {selectedDictionaryWord.courseStage}</span>}
            {selectedDictionaryWord.membershipStatus && <small>{t('vocab.membershipUnverified')}</small>}
          </div>

          <section className="word-detail-section">
            <h3>{t('vocab.meanings')}</h3>
            <div className="word-detail-meanings">
              <div><b>RU</b><span>{selectedDictionaryWord.ru || t('vocab.translationUnavailable')}</span>{selectedDictionaryWord.ruStatus && <small>{translationStatusLabel(selectedDictionaryWord.ruStatus)}</small>}</div>
              <div><b>EN</b><span>{selectedDictionaryWord.en || t('vocab.translationUnavailable')}</span>{selectedDictionaryWord.enStatus && <small>{translationStatusLabel(selectedDictionaryWord.enStatus)}</small>}</div>
              <div><b>UZ</b><span>{selectedDictionaryWord.uz || t('vocab.translationUnavailable')}</span>{selectedDictionaryWord.uzStatus && <small>{translationStatusLabel(selectedDictionaryWord.uzStatus)}</small>}</div>
            </div>
          </section>

          <section className="word-detail-section">
            <h3>{t('vocab.example')}</h3>
            {selectedDictionaryWord.example
              ? <div className="word-detail-example">
                <span>{selectedDictionaryWord.example}</span>
                {selectedDictionaryWord.examplePinyin && <small>{selectedDictionaryWord.examplePinyin}</small>}
                <p>{exampleMeaning(selectedDictionaryWord) || t('vocab.exampleUnavailable')}</p>
                <button className="sound" type="button" onClick={() => speak(selectedDictionaryWord.example)} aria-label={`${t('vocab.listen')}: ${selectedDictionaryWord.example}`}><Volume2 size={17}/></button>
              </div>
              : <p className="word-detail-missing">{t('vocab.exampleUnavailable')}</p>}
          </section>

          <div className="word-detail-actions">
            <button
              className={`outline favorite-detail ${favoriteWordIds.includes(wordId(selectedDictionaryWord)) ? 'selected' : ''}`}
              type="button"
              aria-pressed={favoriteWordIds.includes(wordId(selectedDictionaryWord))}
              onClick={() => toggleFavorite(selectedDictionaryWord)}
            >
              <Star size={16} fill={favoriteWordIds.includes(wordId(selectedDictionaryWord)) ? 'currentColor' : 'none'}/>
              {favoriteWordIds.includes(wordId(selectedDictionaryWord)) ? t('vocab.removeFavorite') : t('vocab.addFavorite')}
            </button>
            <button
              className="primary"
              type="button"
              aria-pressed={knownWords.includes(wordId(selectedDictionaryWord))}
              onClick={() => toggleKnownWord(selectedDictionaryWord)}
            >
              <CheckCircle2 size={17}/>
              {knownWords.includes(wordId(selectedDictionaryWord)) ? t('vocab.removeKnown') : t('vocab.markKnown')}
            </button>
          </div>
        </div>}
      </dialog>

      <footer>
        <span>© 2026 HanziPath · 汉字之路</span>
        <span>
          {t('common.database')}:{' '}
          {isSupabaseConfigured
            ? <b className="ok">{t('common.connected')}</b>
            : <b className="warn">{t('common.notConnected')}</b>}
        </span>
      </footer>
    </main>
  </div>
}
