
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen, Headphones, Layers, Target, ChartNoAxesColumnIncreasing,
  Languages, Search, Volume2, ChevronRight, Flame, Menu, X,
  GraduationCap, CheckCircle2, LockKeyhole, Settings,
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
import {
  getStandardVersions,
  getVocabularyCatalog,
} from './data/vocabularyRepository'
import type { StandardLevel } from './types/vocabulary'

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
  uzStatus?: string
  membershipStatus?: string
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
const DAILY_TASKS_KEY = 'hanzipath.dailyTasks'
const ACTIVITY_DAYS_KEY = 'hanzipath.activityDays'
const COMPLETED_LESSONS_KEY = 'hanzipath.completedLessons'

const lessonTemplates = [...hsk20LessonTemplates, ...hsk30LessonTemplates]

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
  const pool = entries.filter(word => String(membership(word) ?? '') === category)

  if (system !== '3.0' || level < 7) return pool

  const ordered = [...pool].sort((a, b) => {
    const left = `${a.hanzi}|${a.pinyin}`
    const right = `${b.hanzi}|${b.pinyin}`
    return left < right ? -1 : left > right ? 1 : 0
  })

  // CTI publishes one combined 7–9 membership band. These three slices are
  // an in-house course sequence and do not change official membership.
  return ordered.filter((_, index) => index % 3 === level - 7)
}

function lessonWordAssignments(entries: Word[]): Record<string, Word[]> {
  const assignments: Record<string, Word[]> = Object.fromEntries(
    lessonTemplates.map(lesson => [lesson.id, []]),
  )

  const groups = [...new Set(lessonTemplates.map(lesson => `${lesson.system}:${lesson.level}`))]
  for (const group of groups) {
    const [system, levelValue] = group.split(':') as [CourseSystem, string]
    const level = Number(levelValue) as CourseLevel
    const lessons = lessonTemplates.filter(lesson => lesson.system === system && lesson.level === level)
    const pool = wordsForCourseLevel(entries, system, level)
    if (!lessons.length || !pool.length) continue

    const pending = [...pool]
    const baseSize = Math.floor(pool.length / lessons.length)
    const extraWords = pool.length % lessons.length

    const targetSizes = new Map(lessons.map((lesson, index) => [
      lesson.id,
      baseSize + (index < extraWords ? 1 : 0),
    ]))
    const chapters = [...new Set(lessons.map(lesson => lesson.chapter))]
      .map(chapter => {
      const chapterLessons = lessons.filter(lesson => lesson.chapter === chapter)
      const chapterTarget = chapterLessons.reduce((total, lesson) => total + (targetSizes.get(lesson.id) ?? 0), 0)
      const keywords = [...new Set(chapterLessons.flatMap(lesson => lesson.keywords))]
        .map(term => term.toLocaleLowerCase())
      const scores = new Map(pool.map(word => {
        const searchable = [word.hanzi, word.pinyin, word.ru, word.en, word.uz].filter(Boolean).join(' ').toLocaleLowerCase()
        return [word, keywords.reduce((total, keyword) => total + (searchable.includes(keyword) ? 1 : 0), 0)] as const
      }))

      return {
        lessons: chapterLessons,
        target: chapterTarget,
        scores,
        matchCount: [...scores.values()].filter(score => score > 0).length,
        selected: [] as Word[],
      }
    })
      // Give topics with fewer matching words first choice, then use the
      // remaining HSK list entries to complete each lesson's new-word set.
      .sort((a, b) => a.matchCount / a.target - b.matchCount / b.target || a.matchCount - b.matchCount)

    for (const chapter of chapters) {
      while (chapter.selected.length < chapter.target && pending.length > 0) {
        let bestIndex = 0
        let bestScore = 0

        pending.forEach((word, wordIndex) => {
          const score = chapter.scores.get(word) ?? 0
          if (score > bestScore) {
            bestScore = score
            bestIndex = wordIndex
          }
        })

        if (bestScore === 0) break
        chapter.selected.push(pending.splice(bestIndex, 1)[0])
      }
    }

    for (const chapter of chapters) {
      while (chapter.selected.length < chapter.target && pending.length > 0) {
        chapter.selected.push(pending.shift()!)
      }

      // Distribute a chapter's topical words across its grammar modules so
      // later parts do not start with only the leftover, unrelated entries.
      let lessonIndex = 0
      for (const word of chapter.selected) {
        for (let attempt = 0; attempt < chapter.lessons.length; attempt += 1) {
          const lesson = chapter.lessons[lessonIndex % chapter.lessons.length]
          lessonIndex += 1
          if (assignments[lesson.id].length < (targetSizes.get(lesson.id) ?? 0)) {
            assignments[lesson.id].push(word)
            break
          }
        }
      }
    }
  }

  return assignments
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
  const questions: ExamQuestion[] = []
  if (!lessons.length || !safeWords.length) return questions
  const writingEnd = format.listening + format.reading + format.writing
  const translationEnd = writingEnd + format.translation
  const total = translationEnd + format.speaking

  for (let index = 0; index < total; index += 1) {
    const seed = (attemptSeed + (level + 1) * 1009 + index * 97) >>> 0

    if (index < format.listening) {
      const lesson = lessons[(index * 7 + level + (attemptSeed % lessons.length)) % lessons.length]
      const grammar = lesson.grammar
      const distractors = lessons
        .filter(candidate => candidate.id !== lesson.id)
        .map(candidate => candidate.grammar.meaning)
        .filter(meaning => meaning !== grammar.meaning)
      const options = shuffleWithSeed([
        grammar.meaning,
        ...shuffleWithSeed([...new Set(distractors)], seed).slice(0, 3),
      ], seed + 1)
      questions.push({
        section: 'listening',
        part: partNumber(index, format.listeningParts),
        prompt: locale === 'ru' ? 'Прослушай фразу и выбери её значение.' : locale === 'uz' ? 'Gapni tinglang va uning ma’nosini tanlang.' : 'Listen to the sentence and choose its meaning.',
        options,
        answer: grammar.meaning,
        audio: grammar.example,
        pinyin: grammar.pinyin,
      })
      continue
    }

    if (index < format.listening + format.reading) {
      if (index % 2 === 0) {
      const word = safeWords[(index * 11 + level * 5) % safeWords.length]
      const answer = localeMeaning(word, locale) || word.en || word.ru
      const distractors = safeWords
        .filter(candidate => candidate.hanzi !== word.hanzi)
        .map(candidate => localeMeaning(candidate, locale))
        .filter((meaning): meaning is string => Boolean(meaning) && meaning !== answer)
      questions.push({
        section: 'reading',
        part: partNumber(index - format.listening, format.readingParts),
        prompt: locale === 'ru' ? `Выбери значение слова ${word.hanzi} (${word.pinyin}).` : locale === 'uz' ? `${word.hanzi} (${word.pinyin}) so‘zining ma’nosini tanlang.` : `Choose the meaning of ${word.hanzi} (${word.pinyin}).`,
        options: shuffleWithSeed([
          answer,
          ...shuffleWithSeed([...new Set(distractors)], seed).slice(0, 3),
        ], seed + 1),
        answer,
      })
      continue
      }

      const lesson = lessons[(index * 3 + level + (attemptSeed % lessons.length)) % lessons.length]
      const answer = lesson.grammar.meaning
      const distractors = lessons
        .filter(candidate => candidate.id !== lesson.id)
        .map(candidate => candidate.grammar.meaning)
        .filter(meaning => meaning !== answer)
      questions.push({
        section: 'reading',
        part: partNumber(index - format.listening, format.readingParts),
        prompt: locale === 'ru' ? `Прочитай фразу ${lesson.grammar.example} и выбери её значение.` : locale === 'uz' ? `${lesson.grammar.example} gapini o‘qing va ma’nosini tanlang.` : `Read ${lesson.grammar.example} and choose its meaning.`,
        options: shuffleWithSeed([answer, ...shuffleWithSeed([...new Set(distractors)], seed).slice(0, 3)], seed + 1),
        answer,
      })
      continue
    }

    if (index < writingEnd) {
      const lesson = lessons[(index * 5 + level + (attemptSeed % lessons.length)) % lessons.length]
      const writingIndex = index - format.listening - format.reading
      if ((system === '2.0' || system === '3.0') && level === 3 && writingIndex < 5) {
        const word = safeWords[(writingIndex * 19 + level * 7 + (attemptSeed % safeWords.length)) % safeWords.length]
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
      const lesson = lessons[(index * 7 + level + (attemptSeed % lessons.length)) % lessons.length]
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

    const lesson = lessons[(index * 11 + level + (attemptSeed % lessons.length)) % lessons.length]
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

function getLevelValue(level: string): StandardLevel | undefined {
  if (level === 'all') return undefined
  if (level === '7') return '7-9'
  return level as StandardLevel
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
  const [query, setQuery] = useState('')
  const [dictionaryPage, setDictionaryPage] = useState(0)
  const [menu, setMenu] = useState(false)
  const [done, setDone] = useState<boolean[]>(() => {
    const saved = readStored<{ date: string; done: boolean[] } | null>(DAILY_TASKS_KEY, null)
    return saved?.date === localDateKey() && Array.isArray(saved.done) && saved.done.length === 3
      ? saved.done
      : [false, false, false]
  })
  const [knownWords, setKnownWords] = useState<string[]>(() => readStored(KNOWN_WORDS_KEY, []))
  const [activityDays, setActivityDays] = useState<string[]>(() => readStored(ACTIVITY_DAYS_KEY, []))
  const [cardIndex, setCardIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [listeningIndex, setListeningIndex] = useState(0)
  const [listeningChoice, setListeningChoice] = useState<string | null>(null)
  const [lessonListeningChoice, setLessonListeningChoice] = useState<string | null>(null)
  const [examSystem, setExamSystem] = useState<CourseSystem>('2.0')
  const [examLevel, setExamLevel] = useState<CourseLevel>(1)
  const [examQuestionsState, setExamQuestionsState] = useState<ExamQuestion[]>([])
  const [examIndex, setExamIndex] = useState(0)
  const [examAnswers, setExamAnswers] = useState<string[]>([])
  const [examSecondsLeft, setExamSecondsLeft] = useState(0)
  const [examStarted, setExamStarted] = useState(false)
  const [examFinished, setExamFinished] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  const [databaseWords, setDatabaseWords] = useState<Word[] | null>(null)
  const [reviewWords, setReviewWords] = useState<Word[] | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState(false)

  const localeChangeRef = useRef(0)
  const t = (key: TranslationKey) => translate(lang, key)

  useEffect(() => {
    let cancelled = false

    const loadReviewDataset = async () => {
      try {
        const response = await fetch('/vocabulary-review.json')
        if (!response.ok) throw new Error('Vocabulary review dataset not found.')
        const payload = await response.json() as { entries?: unknown[] }
        const entries = Array.isArray(payload.entries) ? payload.entries : []

        if (!cancelled && entries.length > 0) {
          setReviewWords(entries.map((entry, index) => reviewRowToWord(entry, index)))
        }
      } catch {
        if (!cancelled) setReviewWords([])
      }
    }

    void loadReviewDataset()
    return () => { cancelled = true }
  }, [])

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

  // Load approved vocabulary for the selected HSK version and level.
  useEffect(() => {
    let cancelled = false

    if (!supabase) {
      setDatabaseWords(null)
      setCatalogLoading(false)
      setCatalogError(false)
      return () => { cancelled = true }
    }

    const loadCatalog = async () => {
      setCatalogLoading(true)
      setCatalogError(false)

      try {
        const standardCode = system === '2.0' ? 'hsk20' : 'hsk30'
        const standardsResult = await getStandardVersions(standardCode)

        if (standardsResult.error) {
          throw new Error(standardsResult.error.message)
        }

        const standard = [...standardsResult.data].sort((a, b) => {
          const dateA = a.effective_at ?? a.published_at ?? ''
          const dateB = b.effective_at ?? b.published_at ?? ''

          return dateB.localeCompare(dateA) || b.version_key.localeCompare(a.version_key)
        })[0]

        // Pending or unpublished sources are intentionally invisible under RLS.
        if (!standard) {
          if (!cancelled) setDatabaseWords(null)
          return
        }

        const catalogResult = await getVocabularyCatalog({
          standardVersionId: standard.id,
          level: getLevelValue(level),
          limit: 500,
        })

        if (catalogResult.error) {
          throw new Error(catalogResult.error.message)
        }

        const converted = catalogResult.data
          .map(databaseRowToWord)
          .filter(word => word.hanzi && word.pinyin)

        if (!cancelled) {
          setDatabaseWords(converted.length > 0 ? converted : null)
        }
      } catch (error) {
        console.error('Vocabulary catalog loading failed:', error)

        if (!cancelled) {
          setDatabaseWords(null)
          setCatalogError(true)
        }
      } finally {
        if (!cancelled) setCatalogLoading(false)
      }
    }

    void loadCatalog()

    return () => {
      cancelled = true
    }
  }, [system, level])

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

  const availableWords = databaseWords ?? (reviewWords?.length ? reviewWords : words)
  const currentWords = useMemo(() => availableWords.filter(word => {
    const membership = system === '2.0' ? word.level20 : word.level30
    return membership !== null && membership !== undefined && membership !== ''
  }), [availableWords, system])
  const lessonEntries = reviewWords?.length ? reviewWords : availableWords
  const lessonAssignments = useMemo(() => lessonWordAssignments(lessonEntries), [lessonEntries])
  const courseLessons = lessonTemplates.filter(lesson => lesson.system === courseSystem && lesson.level === courseLevel)
  const activeLesson = lessonTemplates.find(lesson => lesson.id === activeLessonId && lesson.system === courseSystem && lesson.level === courseLevel) ?? courseLessons[0]
  const activeLessonWords = activeLesson ? lessonAssignments[activeLesson.id] ?? [] : []
  const courseFallbackWords = wordsForCourseLevel(lessonEntries, courseSystem, courseLevel)
  const studyWords = activeLessonWords.length ? activeLessonWords : courseFallbackWords
  const knownInCurrentWords = knownWords.filter(id => currentWords.some(word => wordId(word) === id)).length
  const activeCard = studyWords.length ? studyWords[cardIndex % studyWords.length] : undefined
  const listeningWord = studyWords.length ? studyWords[listeningIndex % studyWords.length] : undefined
  const listeningOptions = useMemo(() => {
    if (!listeningWord) return []
    const options = [listeningWord, ...studyWords.filter(word => wordId(word) !== wordId(listeningWord)).slice(0, 3)]
    const offset = listeningIndex % options.length
    return [...options.slice(offset), ...options.slice(0, offset)]
  }, [studyWords, listeningIndex, listeningWord])
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
      const activeLevel = system === '2.0' ? word.level20 : word.level30

      return (
        (level === 'all' || String(activeLevel).replace('7-9', '7') === level) &&
        (
          searchable.toLocaleLowerCase().includes(query.toLocaleLowerCase()) ||
          (
            normalizedQuery !== '' &&
            normalizePinyin(word.pinyin).includes(normalizedQuery)
          )
        )
      )
    })
  }, [currentWords, level, query, system])

  useEffect(() => setDictionaryPage(0), [system, level, query])

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
    const generated = examQuestions(examSystem, examLevel, reviewWords?.length ? reviewWords : availableWords, lang)
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
            <b>{t('profile.guest')}</b>
            <small>{t('profile.settings')}</small>
          </div>
          <button className="profile-action" title={t('profile.signIn')} aria-label={t('profile.signIn')} onClick={() => setNotice({ text: t('profile.signInUnavailable'), kind: 'info' })}>
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

          <button className="signin" onClick={() => setNotice({ text: t('profile.signInUnavailable'), kind: 'info' })}>
            <LockKeyhole size={16}/>
            <span>{t('profile.signIn')}</span>
          </button>
        </div>
      </header>

      {notice && (
        <div className={`notice ${notice.kind}`} role="status">
          <span>{notice.text}</span>
          <button aria-label={t('common.closeMenu')} onClick={() => setNotice(null)}><X size={16}/></button>
        </div>
      )}

      {section === 0 && <>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span/>{t('dashboard.eyebrow')}</div>
            <h1>{t('dashboard.title')}<br/><em>汉字之路</em></h1>
            <p>{t('dashboard.subtitle')}</p>
            <button className="primary" onClick={() => setSection(1)}>
              {t('dashboard.continue')}<ChevronRight size={18}/>
            </button>
          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="orbit orbit1"/>
            <div className="orbit orbit2"/>
            <div className="big-hanzi">汉</div>
            <div className="float-card"><span>你好</span><small>nǐ hǎo</small></div>
            <div className="mini-dot"/>
          </div>
        </section>

        <div className="stats">
          <div className="stat">
            <div className="stat-icon blue"><BookOpen/></div>
            <div><strong>{knownInCurrentWords}</strong><small>{t('dashboard.wordsLearned')}</small></div>
            <span className="stat-note">/ {currentWords.length}</span>
          </div>
          <div className="stat">
            <div className="stat-icon orange"><Flame/></div>
            <div><strong>{getStreak(activityDays)}</strong><small>{t('dashboard.streak')}</small></div>
          </div>
          <div className="stat">
            <div className="stat-icon green"><ChartNoAxesColumnIncreasing/></div>
            <div><strong>{currentWords.length ? Math.round(knownInCurrentWords / currentWords.length * 100) : 0}%</strong><small>{t('dashboard.progress')}</small></div>
          </div>
        </div>

        <div className="content-grid">
          <section className="panel daily">
            <div className="panel-head">
              <div><span className="kicker">{t('dashboard.due')}</span><h2>{t('dashboard.today')}</h2></div>
              <span className="date-chip">{t('dashboard.todayTag')}</span>
            </div>

            {(['dashboard.task1', 'dashboard.task2', 'dashboard.task3'] as TranslationKey[]).map((key, i) => (
              <label className={`task ${done[i] ? 'checked' : ''}`} key={key}>
                <input
                  type="checkbox"
                  checked={done[i]}
                  onChange={() => {
                    setDone(items => items.map((value, index) => index === i ? !value : value))
                    if (!done[i]) recordActivity()
                  }}
                />
                <span className="fakecheck">{done[i] ? '✓' : ''}</span>
                <span className="task-copy">{t(key)}<small>{[10, 5, 8][i]} {t('common.minutes')}</small></span>
              </label>
            ))}

            <div className="daily-foot">
              <span>{done.filter(Boolean).length}/3 {t('dashboard.completed')}</span>
              <div className="progress"><i style={{width: `${done.filter(Boolean).length / 3 * 100}%`}}/></div>
            </div>
          </section>

          <section className="panel review">
            <div className="review-icon"><Layers/></div>
            <span className="kicker">{t('dashboard.reviewTitle')}</span>
            <h2>{t('dashboard.review')}</h2>
            <p>{t('dashboard.reviewText')}</p>
            <button className="outline" onClick={() => setSection(3)}>
              {t('dashboard.openFlashcards')}<ChevronRight size={16}/>
            </button>
          </section>
        </div>
      </>}

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
              setShowAnswer(false)
              setCardIndex(0)
            }}>HSK {standard}</button>)}
          </div>

          <div className="course-levels" role="group" aria-label={t('course.level')}>
            {(courseSystem === '2.0' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 7, 8, 9]).map(course => {
              const count = lessonTemplates.filter(item => item.system === courseSystem && item.level === course).length
              const completed = lessonTemplates.filter(item => item.system === courseSystem && item.level === course && completedLessonIds.includes(item.id)).length
              return <button key={course} className={`course-level ${courseLevel === course ? 'selected' : ''}`} onClick={() => {
                setCourseLevel(course as CourseLevel)
                setActiveLessonId(null)
                setLessonListeningChoice(null)
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
            <button className="outline lesson-back" onClick={() => { setActiveLessonId(null); setLessonListeningChoice(null) }}>‹ {t('course.back')}</button>
            <div className="lesson-detail-heading">
              <div><span className="kicker">HSK {courseSystem} · {courseLevel}{courseSystem === '3.0' && courseLevel >= 7 ? ` · ${t('course.stage')}` : ''} · {t('course.lesson')} {activeLesson.chapter}{activeLesson.part > 1 ? `.${activeLesson.part}` : ''}</span><h2>{activeLesson.title}</h2></div>
              <span className="demo-tag">{activeLesson.minutes} {t('common.minutes')}</span>
            </div>

            <section className="course-block">
              <div className="course-block-head"><div><span className="kicker">{t('course.newWords')}</span><h3>{newWordsCountLabel(activeLessonWords.length, lang)}</h3></div>
                {activeLessonWords.length > 0 && <button className="primary" onClick={() => { setCardIndex(0); setShowAnswer(false); setSection(3) }}>{t('course.cards')}<ChevronRight size={16}/></button>}
              </div>
              {activeLessonWords.length ? <div className="lesson-words">
                {activeLessonWords.map(word => <article className="lesson-word" key={wordId(word)}>
                  <div className="lesson-word-main"><b>{word.hanzi}</b><span>{word.pinyin}</span></div>
                  <div className="lesson-word-meanings"><span><i>RU</i>{word.ru || t('vocab.translationUnavailable')}</span><span><i>EN</i>{word.en || t('vocab.translationUnavailable')}</span><span><i>UZ</i>{word.uz || t('vocab.translationUnavailable')}</span></div>
                  {word.ruStatus || word.uzStatus ? <small className="lesson-word-status">{[...new Set([word.ruStatus, word.uzStatus].map(status => translationStatusLabel(status)).filter(Boolean))].join(' · ')}</small> : null}
                </article>)}
              </div> : <p className="notice-text">{t('course.noWords')}</p>}
              {Boolean(reviewWords?.length) && <p className="source-credit">{t('course.translationNote')}</p>}
            </section>

            <section className="course-block grammar-focus">
              <div className="course-block-head"><div><span className="kicker">{t('course.grammar')}</span><h3>{activeLesson.grammar.title}</h3></div>
                <button className="sound" aria-label={t('vocab.listen')} onClick={() => speak(activeLesson.grammar.example)}><Volume2 size={18}/></button>
              </div>
              <p>{activeLesson.grammar.explanation}</p>
              <code>{activeLesson.grammar.pattern}</code>
              <div className="lesson-example"><b>{activeLesson.grammar.example}</b><span>{activeLesson.grammar.pinyin}</span><small>{activeLesson.grammar.meaning}</small></div>
            </section>

            <section className="course-block lesson-listening">
              <div className="course-block-head"><div><span className="kicker">{t('course.listen')}</span><h3>{t('course.listenPrompt')}</h3></div>
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

            <div className="lesson-finish-row">
              <button className="outline" onClick={() => setSection(5)}>{t('course.grammar')}<ChevronRight size={16}/></button>
              <button className="primary" disabled={completedLessonIds.includes(activeLesson.id)} onClick={() => {
                setCompletedLessonIds(ids => ids.includes(activeLesson.id) ? ids : [...ids, activeLesson.id])
                recordActivity()
              }}>{completedLessonIds.includes(activeLesson.id) ? <><CheckCircle2 size={17}/>{t('course.completed')}</> : t('course.markComplete')}</button>
            </div>
          </div>}

          {!activeLessonId && <div className="lesson-list course-lesson-grid">
            {courseLessons.map(lesson => {
              const completed = completedLessonIds.includes(lesson.id)
              const newWordCount = lessonAssignments[lesson.id]?.length ?? 0
              return <article className={`lesson-card course-lesson-card ${completed ? 'completed' : ''}`} key={lesson.id}>
                <span className="lesson-number">{String(lesson.chapter).padStart(2, '0')}{lesson.part > 1 ? `.${lesson.part}` : ''}</span>
                <div><h3>{lesson.title}</h3><p>{lesson.grammar.title} · {newWordsCountLabel(newWordCount, lang)}</p><code>{lesson.grammar.pattern}</code></div>
              <button className="course-open" onClick={() => {
                setActiveLessonId(lesson.id)
                setLessonListeningChoice(null)
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
              {databaseWords ? t('common.database') : reviewWords?.length ? t('vocab.openDataset') : t('vocab.demo')}
            </span>
          </div>

          <p className="notice-text">
            {databaseWords
              ? t('vocab.catalogReady')
              : reviewWords?.length
                ? t('vocab.reviewNotice')
                : reviewWords === null
                  ? t('vocab.loading')
                  : t('vocab.demoNotice')}
          </p>

          {Boolean(reviewWords?.length) && !databaseWords && <>
            <div className="dictionary-summary">
              <div><strong>{currentWords.length.toLocaleString(lang)}</strong><span>{system === '2.0' ? t('vocab.wordsInHsk20') : t('vocab.wordsInHsk30')}</span></div>
              <div><strong>{filtered.length.toLocaleString(lang)}</strong><span>{t('vocab.matchingWords')}</span></div>
              <div><strong>{pageSize}</strong><span>{t('vocab.resultsPerPage')}</span></div>
            </div>
            <p className="source-credit">
              {t('vocab.attribution')}{' '}
              <a href="https://hearmandarin.com/datasets/" target="_blank" rel="noreferrer">HearMandarin</a>{' · '}
              <a href="https://huggingface.co/datasets/Maqsudjonpolatov/hsk-chinese-uzbek-russian" target="_blank" rel="noreferrer">Zitou</a>{' · '}
              <a href="https://hanzibook.com/ru/hsk-3-0" target="_blank" rel="noreferrer">HanziBook</a>{' · '}
              <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>
            </p>
          </>}

          {catalogError && (
            <p className="notice-text">{t('vocab.catalogError')}</p>
          )}

          <div className="filters">
            <label className="searchbox">
              <Search size={18}/>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t('vocab.search')}
              />
            </label>

            <label className="sr-only" htmlFor="system-filter">{t('vocab.system')}</label>
            <select
              id="system-filter"
              value={system}
              onChange={e => {
                setSystem(e.target.value as System)
                setLevel('all')
              }}
            >
              <option value="3.0">{t('vocab.hsk30')}</option>
              <option value="2.0">{t('vocab.hsk20')}</option>
            </select>

            <label className="sr-only" htmlFor="level-filter">{t('vocab.level')}</label>
            <select id="level-filter" value={level} onChange={e => setLevel(e.target.value)}>
              <option value="all">{t('vocab.allLevels')}</option>
              {levels.map((count, i) => (
                <option value={String(i + 1)} key={count}>
                  {levelNames[i]} · {count}
                </option>
              ))}
            </select>
          </div>

          {catalogLoading && <p className="notice-text">{t('vocab.loading')}</p>}

          <div className="results-bar">
            <span>{filtered.length.toLocaleString(lang)} {t('vocab.results')}</span>
            {filtered.length > pageSize && <span>{t('vocab.page')} {dictionaryPage + 1} / {pageCount}</span>}
          </div>

          <div className="wordlist">
            {visibleWords.map((word, i) => (
              <article className="word" key={`${word.hanzi}-${word.pinyin}-${i}`}>
                <div className="word-main">
                  <strong>{word.hanzi}</strong>
                  <div>
                    <b>{word.pinyin}</b>
                  </div>
                </div>

                <span className="level-pill">
                  HSK {String(system === '2.0' ? word.level20 : word.level30).replace('7-9', '7–9')}
                </span>

                <button
                  className="sound"
                  onClick={() => speak(word.hanzi)}
                  title={t('vocab.listen')}
                  aria-label={`${t('vocab.listen')}: ${word.hanzi}`}
                >
                  <Volume2 size={18}/>
                </button>

                <div className="word-meanings">
                  <div><b>RU</b><span>{word.ru || t('vocab.translationUnavailable')}</span>{Boolean(reviewWords?.length) && <small>{translationStatusLabel(word.ruStatus)}</small>}</div>
                  <div><b>EN</b><span>{word.en || t('vocab.translationUnavailable')}</span></div>
                  <div><b>UZ</b><span>{word.uz || t('vocab.translationUnavailable')}</span>{Boolean(reviewWords?.length) && <small>{translationStatusLabel(word.uzStatus)}</small>}</div>
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
            <span className="demo-tag">HSK {courseSystem} · {courseLevel} · {activeLesson?.title}</span>
          </div>
          <p className="notice-text">{t('flashcards.notice')}</p>
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
              <button className="outline" onClick={() => { setShowAnswer(false); setCardIndex(i => (i + 1) % studyWords.length) }}>{t('flashcards.again')}</button>
              <button className="primary" onClick={() => {
                const id = wordId(activeCard)
                setKnownWords(items => items.includes(id) ? items : [...items, id])
                recordActivity()
                setShowAnswer(false)
                setCardIndex(i => (i + 1) % studyWords.length)
              }}>{t('flashcards.markKnown')}</button>
            </>}
          </div>
          <div className="study-footer">
            <button className="outline" aria-label={t('flashcards.previous')} onClick={() => { setShowAnswer(false); setCardIndex(i => (i + studyWords.length - 1) % studyWords.length) }}>‹</button>
            <span>{t('flashcards.counter')} {cardIndex % studyWords.length + 1} / {studyWords.length} · {t('flashcards.knownCount')}: {studyWords.filter(word => knownWords.includes(wordId(word))).length}</span>
            <button className="outline" aria-label={t('flashcards.next')} onClick={() => { setShowAnswer(false); setCardIndex(i => (i + 1) % studyWords.length) }}>›</button>
          </div>
        </section>
      )}

      {section === 3 && !activeCard && (
        <section className="panel learning-page"><div className="empty">{t('course.noWords')}</div></section>
      )}

      {section === 4 && listeningWord && (
        <section className="panel learning-page">
          <div className="panel-head"><div><span className="kicker">{t('listening.kicker')}</span><h2>{t('listening.title')}</h2></div><span className="demo-tag">HSK {courseSystem} · {courseLevel} · {activeLesson?.title}</span></div>
          <p className="notice-text">{t('listening.notice')}</p>
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
          <button className="primary" onClick={() => { setListeningIndex(i => (i + 1) % studyWords.length); setListeningChoice(null) }}>{t('listening.next')}<ChevronRight size={16}/></button>
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
              <button className="outline grammar-open" onClick={() => { setActiveLessonId(lesson.id); setSection(1) }}>{t('course.open')}</button>
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
