
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  BookOpen, Headphones, Layers, Target, ChartNoAxesColumnIncreasing,
  Languages, Search, Volume2, ChevronRight, Flame, Menu, X,
  GraduationCap, CheckCircle2, LockKeyhole, Settings, Star,
  PanelLeftClose, PanelLeftOpen, Palette, Play, BarChart3, Bookmark, CalendarCheck, Sparkles,
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from './supabase'
import heroImage from './assets/heroImage'
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
import {
  getStandardVersions,
  getVocabularyCatalog,
  getVocabularyCatalogStatus,
} from './data/vocabularyRepository'
import type { StandardLevel } from './types/vocabulary'
import { mergeLearningProgress, type LearningProgressSnapshot } from './data/learningProgress'
import { adaptiveDifficulty, dueReviewIds, scheduleReview, type ReviewQuality, type ReviewState } from './data/spacedRepetition'
import { mergeDictionaryEntries, normalizeDictionaryPinyin } from './data/dictionaryQuality'
import { uniqueLessonCards } from './data/lessonCards'
import { examFormat, type ExamFormat } from './data/examFormats'
import PersonalFlashCards from './components/PersonalFlashCards'

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
  level20: number | string | null
  level30: number | string | null
  level20Memberships?: Array<number | string>
  level30Memberships?: Array<number | string>
  legacyIds?: string[]
  partOfSpeech?: string[]
  frequencyRank?: number | null
  pinyinNum?: string
  translationSource?: string
  translationLicense?: string
  membershipSource?: string
  definitionSource?: string
  dataLicense?: string
  exampleSource?: string
  exampleSourceId?: string
  exampleLicense?: string
  exampleStatus?: string
  example: string
  examplePinyin: string
  exampleRu: string
  exampleEn: string
  exampleUz?: string | null
  exampleUzVerified?: boolean
}

type Notice = { text: string; kind: 'success' | 'error' | 'info' }
type DisplayLesson = LessonTemplate & { volume: number; volumeLesson: number; mergedLessons?: LessonTemplate[] }

function partOfSpeechLabel(value: string, lang: Locale): string {
  const labels: Record<string, Record<Locale, string>> = {
    noun: { ru: 'Существительное', en: 'Noun', uz: 'Ot' },
    verb: { ru: 'Глагол', en: 'Verb', uz: 'Fe’l' },
    adjective: { ru: 'Прилагательное', en: 'Adjective', uz: 'Sifat' },
    adverb: { ru: 'Наречие', en: 'Adverb', uz: 'Ravish' },
    pronoun: { ru: 'Местоимение', en: 'Pronoun', uz: 'Olmosh' },
    numeral: { ru: 'Числительное', en: 'Numeral', uz: 'Son' },
    preposition: { ru: 'Предлог', en: 'Preposition', uz: 'Ko‘makchi' },
    conjunction: { ru: 'Союз', en: 'Conjunction', uz: 'Bog‘lovchi' },
    particle: { ru: 'Частица', en: 'Particle', uz: 'Yuklama' },
    classifier: { ru: 'Счётное слово', en: 'Classifier', uz: 'Hisob so‘zi' },
    'measure word': { ru: 'Счётное слово', en: 'Measure word', uz: 'Hisob so‘zi' },
    interjection: { ru: 'Междометие', en: 'Interjection', uz: 'Undov' },
    auxiliary: { ru: 'Вспомогательный глагол', en: 'Auxiliary', uz: 'Yordamchi fe’l' },
    determiner: { ru: 'Определитель', en: 'Determiner', uz: 'Aniqlovchi' },
    phrase: { ru: 'Выражение', en: 'Phrase', uz: 'Ibora' },
    idiom: { ru: 'Идиома', en: 'Idiom', uz: 'Iboraviy birlik' },
    character: { ru: 'Иероглиф', en: 'Character', uz: 'Iyeroglif' },
    suffix: { ru: 'Суффикс', en: 'Suffix', uz: 'Qo‘shimcha' },
    prefix: { ru: 'Префикс', en: 'Prefix', uz: 'Old qo‘shimcha' },
    phonetic: { ru: 'Фонетический компонент', en: 'Phonetic component', uz: 'Fonetik komponent' },
    abbreviation: { ru: 'Сокращение', en: 'Abbreviation', uz: 'Qisqartma' },
  }
  return labels[value]?.[lang] ?? value
}

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
const REVIEW_SCHEDULE_KEY = 'hanzipath.reviewSchedule'
const DAILY_REVIEW_COUNT_KEY = 'hanzipath.dailyReviewCount'
const DAILY_GOAL_WORDS_KEY = 'hanzipath.dailyGoalWords'

const lessonTemplates = [...hsk20LessonTemplates, ...hsk30LessonTemplates]
const originalLessonWords: Word[] = (() => {
  const unique = new Map<string, Word>()

  lessonVocabulary.forEach((entry, index) => {
    const key = `${entry.stage}|${entry.hanzi}|${normalizeDictionaryPinyin(entry.pinyin)}`
    const existing = unique.get(key)

    if (existing) {
      existing.courseSystems = [...new Set([
        ...(existing.courseSystems ?? []),
        ...entry.systems,
      ])]
      return
    }

    unique.set(key, {
      sourceEntryKey: `hanzipath-course-${entry.stage}-${index + 1}`,
      hanzi: entry.hanzi,
      pinyin: entry.pinyin,
      ru: entry.ru,
      en: entry.en,
      uz: entry.uz,
      ruStatus: 'ai_draft_unverified',
      uzStatus: 'ai_draft_unverified',
      courseStage: entry.stage,
      courseSystems: entry.systems,
      level20: null,
      level30: null,
      example: '',
      examplePinyin: '',
      exampleRu: '',
      exampleEn: '',
    })
  })

  return [...unique.values()]
})()

const classroomDialogue = [
  {
    key: 'learner',
    hanzi: '老师，可以再说一遍吗？',
    pinyin: 'Lǎoshī, kěyǐ zài shuō yí biàn ma?',
    meaning: {
      ru: 'Учитель, можно повторить ещё раз?',
      en: 'Teacher, could you say that again?',
      uz: 'Ustoz, yana bir marta ayta olasizmi?',
    },
  },
  {
    key: 'teacher',
    hanzi: '当然可以。我们一起练习吧。',
    pinyin: 'Dāngrán kěyǐ. Wǒmen yìqǐ liànxí ba.',
    meaning: {
      ru: 'Конечно. Давай потренируемся вместе.',
      en: 'Of course. Let’s practice together.',
      uz: 'Albatta. Keling, birga mashq qilamiz.',
    },
  },
] as const

const closingReading = {
  hanzi: '今天的课很有意思。回家以后，我要再读一次，也要多练习。',
  meaning: {
    ru: 'Сегодняшний урок интересный. Дома я прочитаю его ещё раз и буду больше практиковаться.',
    en: 'Today’s lesson is interesting. At home I’ll read it again and practice some more.',
    uz: 'Bugungi dars qiziqarli. Uyda uni yana bir marta o‘qiyman va ko‘proq mashq qilaman.',
  },
  options: {
    ru: [
      'Я ещё раз прочитаю урок дома и буду практиковаться.',
      'Я пойду в библиотеку и выберу новую книгу.',
      'Я закончил урок и больше не буду заниматься.',
    ],
    en: [
      'I’ll read the lesson again at home and practice more.',
      'I’ll go to the library to choose a new book.',
      'I finished the lesson and will stop studying.',
    ],
    uz: [
      'Darsni uyda yana o‘qib, ko‘proq mashq qilaman.',
      'Kutubxonaga borib, yangi kitob tanlayman.',
      'Darsni tugatdim va endi o‘qimayman.',
    ],
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
  explanation?: string
  manualReview?: boolean
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
  const uniqueWords = (items: Word[]) => [...new Map(items
    .filter(word => word.hanzi && word.pinyin && (localeMeaning(word, locale) || word.en || word.ru))
    .map(word => {
      const pronunciation = word.pinyinNum
        ? word.pinyinNum.toLowerCase().split(' ').join('').split("'").join('').split('’').join('')
        : normalizePinyin(word.pinyin)
      return [word.hanzi + '|' + pronunciation, word] as const
    })).values()]
  const wordPool = system === '3.0' && level >= 7
    ? words.filter(word => ['7', '7-9'].includes(String(word.level30 ?? '')))
    : words.filter(word => Number(standardValue(word)) > 0 && Number(standardValue(word)) <= level)
  const safeWords = shuffleWithSeed(uniqueWords(wordPool), attemptSeed + 31)
  const lessonPool = lessonTemplates.filter(lesson => lesson.system === system && (
    system === '3.0' && level >= 7 ? lesson.level >= 7 : lesson.level <= level
  ))
  const uniqueLessons = [...new Map(lessonPool
    .filter(lesson => lesson.grammar.example && lesson.grammar.meaning)
    .map(lesson => [lesson.grammar.example + '|' + lesson.grammar.meaning, lesson] as const)).values()]
  const lessons = shuffleWithSeed(uniqueLessons, attemptSeed + 71)
  const listeningItems = shuffleWithSeed([...new Map(lessons.flatMap(lesson => [
    { text: lesson.grammar.example, pinyin: lesson.grammar.pinyin, meaning: lesson.grammar.meaning },
    ...(lesson.grammar.extraExamples ?? []).map(example => ({
      text: example.hanzi, pinyin: example.pinyin, meaning: example.meaning,
    })),
  ]).filter(item => item.text?.trim() && item.pinyin?.trim() && item.meaning?.trim())
    .map(item => [item.text.trim() + '|' + item.pinyin.trim().toLocaleLowerCase(), item] as const)).values()], attemptSeed + 17)
  const questions: ExamQuestion[] = []
  if (!lessons.length || !safeWords.length) return questions
  const writingEnd = format.listening + format.reading + format.writing
  const translationEnd = writingEnd + format.translation
  const total = translationEnd + format.speaking
  const meaningOf = (word: Word) => localeMeaning(word, locale) || word.en || word.ru
  const makeOptions = (answer: string, distractors: string[], seed: number) =>
    shuffleWithSeed([answer, ...[...new Set(distractors.filter(value => value && value !== answer))].slice(0, 3)], seed)
  let listeningIndex = 0
  let listeningWordIndex = 0
  let readingWordIndex = 0
  let readingLessonIndex = 0
  let writingWordIndex = 0
  let writingLessonIndex = 0
  let translationIndex = 0
  let speakingIndex = 0

  for (let index = 0; index < total; index += 1) {
    const seed = (attemptSeed + (level + 1) * 1009 + index * 97) >>> 0
    if (index < format.listening) {
      const item = listeningItems[listeningIndex]
      if (item) {
        listeningIndex += 1
        const answer = item.meaning
        const distractors = [
          ...listeningItems.filter(candidate => candidate.text !== item.text).map(candidate => candidate.meaning),
          ...safeWords.map(meaningOf),
        ]
        questions.push({
          section: 'listening',
          part: partNumber(index, format.listeningParts),
          prompt: locale === 'ru' ? 'Прослушай фразу и выбери её значение.' : locale === 'uz' ? 'Gapni tinglang va uning ma’nosini tanlang.' : 'Listen to the sentence and choose its meaning.',
          options: makeOptions(answer, distractors, seed),
          answer,
          audio: item.text,
          pinyin: item.pinyin,
          explanation: `${item.text} · ${item.pinyin} · ${item.meaning}`,
        })
      } else {
        const word = safeWords[listeningWordIndex++]
        if (word) {
          const answer = meaningOf(word)
          questions.push({
            section: 'listening',
            part: partNumber(index, format.listeningParts),
            prompt: locale === 'ru' ? 'Прослушай слово и выбери его перевод.' : locale === 'uz' ? 'So‘zni tinglang va tarjimasini tanlang.' : 'Listen to the word and choose its meaning.',
            options: makeOptions(answer, safeWords.filter(item => wordId(item) !== wordId(word)).map(meaningOf), seed),
            answer,
            audio: word.hanzi,
            pinyin: word.pinyin,
            explanation: `${word.hanzi} · ${word.pinyin} · ${meaningOf(word)}`,
          })
        }
      }
      continue
    }
    if (index < format.listening + format.reading) {
      const offset = index - format.listening
      if (offset % 2 === 0 || readingLessonIndex >= lessons.length) {
        const word = safeWords[readingWordIndex]
        readingWordIndex += 1
        const answer = meaningOf(word)
        questions.push({
          section: 'reading',
          part: partNumber(offset, format.readingParts),
          prompt: locale === 'ru' ? 'Выбери значение слова ' + word.hanzi + ' (' + word.pinyin + ').' : locale === 'uz' ? word.hanzi + ' (' + word.pinyin + ') so‘zining ma’nosini tanlang.' : 'Choose the meaning of ' + word.hanzi + ' (' + word.pinyin + ').',
          options: makeOptions(answer, safeWords.filter(item => wordId(item) !== wordId(word)).map(meaningOf), seed),
          answer,
          pinyin: word.pinyin,
          explanation: `${word.hanzi} · ${word.pinyin} · ${answer}`,
        })
      } else {
        const lesson = lessons[readingLessonIndex++]
        const answer = lesson.grammar.meaning
        questions.push({
          section: 'reading',
          part: partNumber(offset, format.readingParts),
          prompt: locale === 'ru' ? 'Прочитай фразу ' + lesson.grammar.example + ' и выбери её значение.' : locale === 'uz' ? lesson.grammar.example + ' gapini o‘qing va ma’nosini tanlang.' : 'Read ' + lesson.grammar.example + ' and choose its meaning.',
          options: makeOptions(answer, lessons.filter(item => item.id !== lesson.id).map(item => item.grammar.meaning), seed),
          answer,
          explanation: `${lesson.grammar.example} · ${lesson.grammar.pinyin} · ${answer}`,
        })
      }
      continue
    }
    if (index < writingEnd) {
      const writingIndex = index - format.listening - format.reading
      const lesson = lessons[writingLessonIndex++]
      const characterWriting = system === '3.0'
        ? level === 2 || (level === 3 && writingIndex < 5)
        : level === 3 && writingIndex < 5
      if (characterWriting) {
        const word = safeWords[writingWordIndex++]
        if (word) {
          const meaning = meaningOf(word)
          questions.push({
            section: 'writing',
            part: partNumber(writingIndex, format.writingParts),
            prompt: locale === 'ru' ? 'Запиши иероглифами слово: ' + word.pinyin + ' (' + meaning + ')' : locale === 'uz' ? word.pinyin + ' (' + meaning + ') so‘zini ierogliflar bilan yozing.' : 'Write the Chinese characters for ' + word.pinyin + ' (' + meaning + ').',
            options: [], answer: word.hanzi, explanation: word.hanzi + ' · ' + word.pinyin + ' · ' + meaning,
          })
        }
        continue
      }
      if (system === '3.0' && level === 4) {
        const word = writingIndex < 5 ? safeWords[writingWordIndex++] : undefined
        const cue = word ? word.hanzi + ' (' + word.pinyin + ') · ' + meaningOf(word) : lesson.grammar.example
        const prompt = writingIndex < 5
          ? (locale === 'ru' ? 'Составь естественное предложение, используя слово: ' + cue : locale === 'uz' ? 'Quyidagi so‘zdan foydalanib tabiiy gap tuzing: ' + cue : 'Write a natural Chinese sentence using: ' + cue)
          : (locale === 'ru' ? 'Напиши связный текст не менее чем из 80 китайских иероглифов на тему «' + lesson.title + '».' : locale === 'uz' ? '«' + lesson.title + '» mavzusida kamida 80 ta xitoy ieroglifidan iborat matn yozing.' : 'Write a coherent text of at least 80 Chinese characters about “' + lesson.title + '”.')
        questions.push({
          section: 'writing', part: partNumber(writingIndex, format.writingParts), prompt, options: [], answer: '',
          explanation: locale === 'ru' ? 'Самопроверка: раскрой тему, соблюдай порядок слов, грамматику и связность.' : locale === 'uz' ? 'O‘zini tekshirish: mavzuni yoritish, so‘z tartibi va grammatikaga e’tibor bering.' : 'Self-check: develop the topic, use natural word order, and check grammar and coherence.',
          manualReview: true,
        })
        continue
      }
      if (system === '3.0' && level >= 5 && level <= 6) {
        const sourceText = [lesson.grammar.example, ...(lesson.grammar.extraExamples ?? []).map(example => example.hanzi)].join(' ')
        const prompt = level === 5 && writingIndex === 0
          ? (locale === 'ru' ? 'Напиши связный рассказ по последовательности событий на тему «' + lesson.title + '». Используй фразу: ' + lesson.grammar.example : locale === 'uz' ? '«' + lesson.title + '» mavzusida voqealar ketma-ketligi asosida hikoya yozing. ' + lesson.grammar.example : 'Write a coherent story about “' + lesson.title + '”, using this detail: ' + lesson.grammar.example)
          : level === 5
            ? (locale === 'ru' ? 'Напиши эссе не менее 200 китайских иероглифов на тему «' + lesson.title + '».' : locale === 'uz' ? '«' + lesson.title + '» mavzusida kamida 200 ta xitoy ieroglifidan iborat esse yozing.' : 'Write an essay of at least 200 Chinese characters about “' + lesson.title + '”.')
            : writingIndex === 0
              ? (locale === 'ru' ? 'Кратко изложи основную мысль текста своими словами: «' + sourceText + '»' : locale === 'uz' ? 'Matnning asosiy mazmunini qisqacha bayon qiling: «' + sourceText + '»' : 'Summarize the main idea in your own words: “' + sourceText + '”')
              : (locale === 'ru' ? 'Напиши аргументированное эссе на тему «' + lesson.title + '», приведи доводы и пример.' : locale === 'uz' ? '«' + lesson.title + '» mavzusida dalillar va misol bilan esse yozing.' : 'Write an argumentative essay about “' + lesson.title + '”, with reasons and an example.')
        questions.push({
          section: 'writing', part: partNumber(writingIndex, format.writingParts), prompt, options: [], answer: '',
          explanation: locale === 'ru' ? 'Самопроверка: структура, связность, точность языка, раскрытие темы и требуемый объём.' : locale === 'uz' ? 'O‘zini tekshirish: tuzilma, izchillik, til aniqligi va mavzuning yoritilishi.' : 'Self-check: structure, coherence, language accuracy, topic development, and required length.',
          manualReview: true,
        })
        continue
      }
      if (system === '2.0' && level === 4 && writingIndex >= 10) {
        const word = safeWords[writingWordIndex++]
        const cue = word ? word.hanzi + ' (' + word.pinyin + ')' : lesson.grammar.example
        questions.push({
          section: 'writing', part: partNumber(writingIndex, format.writingParts),
          prompt: locale === 'ru' ? 'Составь грамматически правильное предложение со словом: ' + cue : locale === 'uz' ? 'Quyidagi so‘z bilan grammatik jihatdan to‘g‘ri gap tuzing: ' + cue : 'Write a grammatically correct Chinese sentence using: ' + cue,
          options: [], answer: '',
          explanation: locale === 'ru' ? 'Самопроверка: значение слова, порядок слов и грамматическая конструкция использованы правильно.' : locale === 'uz' ? 'O‘zini tekshirish: so‘z ma’nosi, tartib va grammatika to‘g‘ri ishlatilgan.' : 'Self-check: use the word accurately and check word order and grammar.',
          manualReview: true,
        })
        continue
      }
      if (level >= 5 && !(system === '2.0' && level === 5 && writingIndex < 8)) {
        questions.push({
          section: 'writing',
          part: partNumber(writingIndex, format.writingParts),
          prompt: system === '2.0' && level === 5 ? (locale === 'ru' ? 'Напиши связный текст примерно из 80 иероглифов на тему «' + lesson.title + '». Используй фразу ' + lesson.grammar.example + ' как опору.' : locale === 'uz' ? '«' + lesson.title + '» mavzusida taxminan 80 ta ieroglifdan iborat matn yozing. ' + lesson.grammar.example + ' gapidan foydalaning.' : 'Write a coherent composition of about 80 Chinese characters on “' + lesson.title + '”. Use ' + lesson.grammar.example + ' as a starting point.') : locale === 'ru' ? 'Напиши короткий связный текст по теме «' + lesson.title + '». Используй фразу ' + lesson.grammar.example + ' как опору.' : locale === 'uz' ? '«' + lesson.title + '» mavzusida qisqa matn yozing. ' + lesson.grammar.example + ' gapidan foydalaning.' : 'Write a short text about “' + lesson.title + '”. Use ' + lesson.grammar.example + ' as a starting point.',
          options: [],
          answer: '',
          explanation: locale === 'ru' ? 'Самопроверка: тема раскрыта, структура связная, грамматика и целевая конструкция использованы правильно.' : locale === 'uz' ? 'O‘zini tekshirish: mavzu yoritilgan, matn izchil, grammatika va kerakli tuzilma to‘g‘ri ishlatilgan.' : 'Self-check: address the topic, keep a clear structure, and use the target grammar accurately.',
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
        prompt: locale === 'ru' ? 'Составь фразу из частей: ' + shuffledPieces.join(' / ') : locale === 'uz' ? 'Berilgan bo‘laklardan gap tuzing: ' + shuffledPieces.join(' / ') : 'Rebuild the sentence from these parts: ' + shuffledPieces.join(' / '),
        options: [],
        answer: lesson.grammar.example,
        explanation: `${lesson.grammar.example} · ${lesson.grammar.pinyin} · ${lesson.grammar.meaning}`,
      })
      continue
    }
    if (index < translationEnd) {
      const lesson = lessons[translationIndex++]
      const translateToChinese = (translationIndex - 1) % 2 === 1
      questions.push({
        section: 'translation',
        part: partNumber(index - writingEnd, format.translationParts),
        prompt: locale === 'ru'
          ? translateToChinese ? 'Передай по-китайски смысл: «' + lesson.grammar.meaning + '»' : 'Переведи на русский: ' + lesson.grammar.example
          : locale === 'uz'
            ? translateToChinese ? 'Quyidagi ma’noni xitoy tilida ifodalang: «' + lesson.grammar.meaning + '»' : 'Gapni o‘zbekchaga tarjima qiling: ' + lesson.grammar.example
            : translateToChinese ? 'Express this meaning in Chinese: “' + lesson.grammar.meaning + '”' : 'Translate into English: ' + lesson.grammar.example,
        options: [],
        answer: translateToChinese ? lesson.grammar.example : lesson.grammar.meaning,
        explanation: locale === 'ru' ? `Ориентир для самопроверки: ${translateToChinese ? lesson.grammar.example : lesson.grammar.meaning}` : locale === 'uz' ? `O‘zini tekshirish uchun namuna: ${translateToChinese ? lesson.grammar.example : lesson.grammar.meaning}` : `Reference for self-review: ${translateToChinese ? lesson.grammar.example : lesson.grammar.meaning}`,
        manualReview: true,
      })
      continue
    }
    const lesson = lessons[speakingIndex++]
    questions.push({
      section: 'speaking',
      part: partNumber(index - translationEnd, format.speakingParts),
      prompt: locale === 'ru' ? 'Ответь вслух, затем запиши ключевые мысли: ' + lesson.grammar.meaning : locale === 'uz' ? 'Javobni ovoz chiqarib ayting, so‘ng asosiy fikrlarni yozing: ' + lesson.grammar.meaning : 'Answer aloud, then write your key points: ' + lesson.grammar.meaning,
      options: [],
      answer: lesson.grammar.example,
      explanation: locale === 'ru' ? `Самопроверка: ответ по теме, понятная структура и корректное произношение. Пример: ${lesson.grammar.example} (${lesson.grammar.pinyin}).` : locale === 'uz' ? `O‘zini tekshirish: mavzuga mos javob, aniq tuzilma va to‘g‘ri talaffuz. Namuna: ${lesson.grammar.example} (${lesson.grammar.pinyin}).` : `Self-check: stay on topic, speak clearly, and use accurate pronunciation. Example: ${lesson.grammar.example} (${lesson.grammar.pinyin}).`,
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
function databaseRowToWord(row: any, system: System): Word {
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
  const partOfSpeech: string[] = []
  for (const reading of readings as any[]) {
    const value = reading.part_of_speech
    if (typeof value === 'string' && value.length > 0 && !partOfSpeech.includes(value)) {
      partOfSpeech.push(value)
    }
  }

  return {
    sourceEntryKey: row.id ? `vocabulary-db-${row.id}` : undefined,
    hanzi: row.simplified ?? '',
    traditional: row.traditional ?? '',
    pinyin: readings[0]?.pinyin ?? '',
    ru: meaning('ru') ?? '',
    en: meaning('en') ?? '',
    uz: meaning('uz'),
    uzVerified: Boolean(meaning('uz')),
    ruStatus: meaning('ru') ? undefined : 'source_unverified',
    enStatus: meaning('en') ? undefined : 'source_unverified',
    uzStatus: meaning('uz') ? undefined : 'source_unverified',
    level20: system === '2.0' ? level : null,
    level30: system === '3.0' ? level : null,
    level20Memberships: system === '2.0' ? [level] : [],
    level30Memberships: system === '3.0' ? [level] : [],
    partOfSpeech,
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
    pinyinNum: row.pinyinNum ?? '',
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
    level20Memberships: Array.isArray(row.level20Memberships) ? row.level20Memberships : undefined,
    level30Memberships: Array.isArray(row.level30Memberships) ? row.level30Memberships : undefined,
    legacyIds: Array.isArray(row.legacyIds) ? row.legacyIds : [],
    partOfSpeech: Array.isArray(row.partOfSpeech) ? row.partOfSpeech : [],
    frequencyRank: Number.isFinite(Number(row.frequencyRank)) ? Number(row.frequencyRank) : null,
    translationSource: row.translationSource,
    translationLicense: row.translationLicense,
    membershipSource: row.membershipSource,
    definitionSource: row.definitionSource,
    dataLicense: row.dataLicense,
    example: row.example || sample?.example || '',
    examplePinyin: row.examplePinyin || sample?.examplePinyin || '',
    exampleRu: row.exampleRu || sample?.exampleRu || '',
    exampleEn: row.exampleEn || sample?.exampleEn || '',
    exampleUz: row.exampleUz ?? null,
    exampleUzVerified: Boolean(row.exampleUzVerified),
    exampleSource: row.exampleSource,
    exampleSourceId: row.exampleSourceId,
    exampleLicense: row.exampleLicense,
    exampleStatus: row.exampleStatus,
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
  const [vocabularyCollection, setVocabularyCollection] = useState<'course' | 'hsk'>('course')
  const [query, setQuery] = useState('')
  const [dictionaryPage, setDictionaryPage] = useState(0)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [knownOnly, setKnownOnly] = useState(false)
  const [dictionarySort, setDictionarySort] = useState<'hanzi' | 'pinyin' | 'level' | 'frequency'>('hanzi')
  const [dictionaryLessonId, setDictionaryLessonId] = useState('')
  const [dictionaryPosFilter, setDictionaryPosFilter] = useState('')
  const [selectedDictionaryWord, setSelectedDictionaryWord] = useState<Word | null>(null)
  const [menu, setMenu] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return window.localStorage.getItem('hanzipath.sidebarCollapsed') === 'true' } catch { return false }
  })
  const [theme, setTheme] = useState<'light' | 'dark' | 'burgundy'>(() => {
    try {
      const saved = window.localStorage.getItem('hanzipath.theme')
      return saved === 'dark' || saved === 'burgundy' ? saved : 'light'
    } catch { return 'light' }
  })
  const [done, setDone] = useState<boolean[]>(() => {
    const saved = readStored<{ date: string; done: boolean[] } | null>(DAILY_TASKS_KEY, null)
    return saved?.date === localDateKey() && Array.isArray(saved.done) && saved.done.length === 3
      ? saved.done
      : [false, false, false]
  })
  const [knownWords, setKnownWords] = useState<string[]>(() => readStored(KNOWN_WORDS_KEY, []))
  const [favoriteWordIds, setFavoriteWordIds] = useState<string[]>(() => readStored(FAVORITE_WORDS_KEY, []))
  const [activityDays, setActivityDays] = useState<string[]>(() => readStored(ACTIVITY_DAYS_KEY, []))
  const [reviewSchedule, setReviewSchedule] = useState<Record<string, ReviewState>>(() => readStored(REVIEW_SCHEDULE_KEY, {}))
  const [dailyGoalWords, setDailyGoalWords] = useState<number>(() => readStored(DAILY_GOAL_WORDS_KEY, 15))
  const [dailyReviewCount, setDailyReviewCount] = useState<{ date: string; count: number }>(() => {
    const saved = readStored<{ date: string; count: number }>(DAILY_REVIEW_COUNT_KEY, { date: '', count: 0 })
    return saved.date === localDateKey() ? saved : { date: localDateKey(), count: 0 }
  })
  const [cardsMode, setCardsMode] = useState<'lesson' | 'personal'>('lesson')
  const [cardsSystem, setCardsSystem] = useState<CourseSystem>(() => readStored<CourseSystem>('hanzipath.cards.system', '2.0'))
  const [cardsLevel, setCardsLevel] = useState<CourseLevel>(() => readStored<CourseLevel>('hanzipath.cards.level', 1))
  const [cardsLessonId, setCardsLessonId] = useState<string>(() => readStored<string>('hanzipath.cards.lesson', ''))
  const [cardIndex, setCardIndex] = useState<number>(() => readStored<number>('hanzipath.cards.index', 0))
  const [showAnswer, setShowAnswer] = useState(false)
  const [listeningSystem, setListeningSystem] = useState<CourseSystem>(() => readStored<CourseSystem>('hanzipath.listening.system', '2.0'))
  const [listeningLevel, setListeningLevel] = useState<CourseLevel>(() => readStored<CourseLevel>('hanzipath.listening.level', 1))
  const [listeningLessonId, setListeningLessonId] = useState<string>(() => readStored<string>('hanzipath.listening.lesson', ''))
  const [listeningIndex, setListeningIndex] = useState<number>(() => readStored<number>('hanzipath.listening.index', 0))
  const [listeningCompletedIds, setListeningCompletedIds] = useState<string[]>(() => readStored<string[]>('hanzipath.listening.completed', []))
  const [listeningChoice, setListeningChoice] = useState<string | null>(null)
  const [grammarSystem, setGrammarSystem] = useState<CourseSystem>('2.0')
  const [grammarLevel, setGrammarLevel] = useState<CourseLevel>(1)
  const [expandedGrammarId, setExpandedGrammarId] = useState<string | null>(null)
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
  const [examHistory, setExamHistory] = useState<Array<{
    system: CourseSystem
    level: number
    score: number
    total: number
    date: string
    manualAnswered?: number
    manualTotal?: number
    durationSeconds?: number
  }>>(() => readStored<Array<{
    system: CourseSystem
    level: number
    score: number
    total: number
    date: string
    manualAnswered?: number
    manualTotal?: number
    durationSeconds?: number
  }>>('hanzipath.exam.history', []))
  const examSavedRef = useRef(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'reset'>('signin')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authFeedback, setAuthFeedback] = useState<Notice | null>(null)
  const [authUser, setAuthUser] = useState<{ id: string; email: string } | null>(null)
  const [progressSyncReadyFor, setProgressSyncReadyFor] = useState<string | null>(null)
  const [selectedVolume, setSelectedVolume] = useState(1)

  const [databaseWords, setDatabaseWords] = useState<Word[] | null>(null)
  const [reviewWords, setReviewWords] = useState<Word[] | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState(false)

  const localeChangeRef = useRef(0)
  const dictionaryLegacyIdsRef = useRef<Map<string, string>>(new Map())
  const wordDialogRef = useRef<HTMLDialogElement>(null)
  const t = (key: TranslationKey) => translate(lang, key)

  useEffect(() => {
    try { window.localStorage.setItem('hanzipath.theme', theme) } catch { /* Storage may be disabled. */ }
  }, [theme])

  useEffect(() => {
    try { window.localStorage.setItem('hanzipath.sidebarCollapsed', String(sidebarCollapsed)) } catch { /* Storage may be disabled. */ }
  }, [sidebarCollapsed])

  useEffect(() => {
    try {
      window.localStorage.setItem('hanzipath.cards.system', JSON.stringify(cardsSystem))
      window.localStorage.setItem('hanzipath.cards.level', JSON.stringify(cardsLevel))
      window.localStorage.setItem('hanzipath.cards.lesson', JSON.stringify(cardsLessonId))
      window.localStorage.setItem('hanzipath.cards.index', JSON.stringify(cardIndex))
    } catch { /* Card progress remains available for this session. */ }
  }, [cardsSystem, cardsLevel, cardsLessonId, cardIndex])

  useEffect(() => {
    try {
      window.localStorage.setItem('hanzipath.listening.system', JSON.stringify(listeningSystem))
      window.localStorage.setItem('hanzipath.listening.level', JSON.stringify(listeningLevel))
      window.localStorage.setItem('hanzipath.listening.lesson', JSON.stringify(listeningLessonId))
      window.localStorage.setItem('hanzipath.listening.index', JSON.stringify(listeningIndex))
      window.localStorage.setItem('hanzipath.listening.completed', JSON.stringify(listeningCompletedIds))
    } catch { /* Listening progress remains available for this session. */ }
  }, [listeningSystem, listeningLevel, listeningLessonId, listeningIndex, listeningCompletedIds])

  useEffect(() => {
    try { window.localStorage.setItem('hanzipath.exam.history', JSON.stringify(examHistory)) } catch { /* Exam history remains available for this session. */ }
  }, [examHistory])

  useEffect(() => {
    let cancelled = false

    const loadReviewDataset = async () => {
      try {
        const [hsk30Response, hsk20Response, translationsResponse, hsk20ExamplesResponse] = await Promise.all([
          fetch('/vocabulary-catalog-hsk30.json'),
          fetch('/vocabulary-catalog-hsk20.json'),
          fetch('/vocabulary-translations-ru-uz.json'),
          fetch('/vocabulary-examples-hsk20.json'),
        ])

        let entries: unknown[] = []
        if (hsk30Response.ok && hsk20Response.ok) {
          const [hsk30Payload, hsk20Payload, translationsPayload, hsk20ExamplesPayload] = await Promise.all([
            hsk30Response.json() as Promise<{ entries?: unknown[] }>,
            hsk20Response.json() as Promise<{ entries?: unknown[] }>,
            translationsResponse.ok
              ? translationsResponse.json() as Promise<{ entries?: unknown[] }>
              : Promise.resolve({ entries: [] as unknown[] }),
            hsk20ExamplesResponse.ok
              ? hsk20ExamplesResponse.json() as Promise<{ entries?: unknown[] }>
              : Promise.resolve({ entries: [] as unknown[] }),
          ])
          const translationsByWordKey = new Map(
            (translationsPayload.entries ?? []).map((entry: any) => [entry.wordKey, entry]),
          )
          const hsk20ExamplesByWordKey = new Map(
            (hsk20ExamplesPayload.entries ?? []).map((entry: any) => [entry.wordKey, entry]),
          )
          entries = [...(hsk30Payload.entries ?? []), ...(hsk20Payload.entries ?? [])].map((entry: any) => ({
            ...(hsk20ExamplesByWordKey.get(entry.wordKey) ?? {}),
            ...entry,
            ...(translationsByWordKey.get(entry.wordKey) ?? {}),
          }))
        } else {
          const fallbackResponse = await fetch('/vocabulary-review.json')
          if (!fallbackResponse.ok) throw new Error('Vocabulary catalogue could not be loaded.')
          const fallbackPayload = await fallbackResponse.json() as { entries?: unknown[] }
          entries = Array.isArray(fallbackPayload.entries) ? fallbackPayload.entries : []
        }

        if (!cancelled && entries.length > 0) {
          const mergedEntries = mergeDictionaryEntries(
            entries.map((entry, index) => reviewRowToWord(entry, index)),
          )
          const legacyToCanonical = new Map<string, string>()
          for (const word of mergedEntries) {
            for (const legacyId of word.legacyIds ?? []) {
              legacyToCanonical.set(legacyId, wordId(word))
            }
          }
          dictionaryLegacyIdsRef.current = legacyToCanonical

          setKnownWords(current => [...new Set(current.map(id => legacyToCanonical.get(id) ?? id))])
          setFavoriteWordIds(current => [...new Set(current.map(id => legacyToCanonical.get(id) ?? id))])
          setReviewSchedule(current => {
            const migrated: Record<string, ReviewState> = {}
            for (const [id, review] of Object.entries(current)) {
              const canonicalId = legacyToCanonical.get(id) ?? id
              const existing = migrated[canonicalId]
              if (!existing || Date.parse(review.updatedAt) > Date.parse(existing.updatedAt)) {
                migrated[canonicalId] = review
              }
            }
            return migrated
          })
          setReviewWords(mergedEntries)
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
      window.localStorage.setItem(REVIEW_SCHEDULE_KEY, JSON.stringify(reviewSchedule))
      window.localStorage.setItem(DAILY_GOAL_WORDS_KEY, JSON.stringify(dailyGoalWords))
      window.localStorage.setItem(DAILY_REVIEW_COUNT_KEY, JSON.stringify(dailyReviewCount))
    } catch {
      // Local review scheduling remains active for this session.
    }
  }, [reviewSchedule, dailyGoalWords, dailyReviewCount])

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
          if (!cancelled) {
            setDatabaseWords(null)
          }
          return
        }

        const catalogStatus = await getVocabularyCatalogStatus(
          standard.id,
          getLevelValue(level),
        )

        if (catalogStatus.error) {
          throw new Error(catalogStatus.error.message)
        }

        if (cancelled) return

        // Candidate rows stay out of the public dictionary until membership,
        // readings, translations, and source rights have been reviewed.
        if (catalogStatus.data.verifiedMemberships === 0) {
          setDatabaseWords(null)
          return
        }

        const catalogResult = await getVocabularyCatalog({
          standardVersionId: standard.id,
          level: getLevelValue(level),
          limit: 12000,
        })

        if (catalogResult.error) {
          throw new Error(catalogResult.error.message)
        }

        const converted = mergeDictionaryEntries(catalogResult.data
          .map(row => databaseRowToWord(row, system))
          .filter(word => word.hanzi && word.pinyin))

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

  useEffect(() => {
    if (!supabase) return
    let mounted = true
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      const user = session?.user
      setAuthUser(user ? { id: user.id, email: user.email ?? '' } : null)
    })
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return
      if (error) setAuthFeedback({ text: error.message, kind: 'error' })
      const user = data.session?.user
      setAuthUser(user ? { id: user.id, email: user.email ?? '' } : null)
    }).catch(error => {
      if (mounted) setAuthFeedback({ text: error instanceof Error ? error.message : String(error), kind: 'error' })
    })
    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  // Load and merge the local learning history with the signed-in account.
  // The merge is additive for completed work and timestamp-based for card schedules.
  useEffect(() => {
    const userId = authUser?.id
    if (!supabase || !userId) {
      setProgressSyncReadyFor(null)
      return
    }
    const client = supabase

    let cancelled = false
    setProgressSyncReadyFor(null)

    const loadProgress = async () => {
      try {
        const { data, error } = await client
          .from('user_learning_progress')
          .select('progress')
          .eq('user_id', userId)
          .maybeSingle()

        if (error) throw error
        if (cancelled) return

        const localSnapshot: LearningProgressSnapshot = {
          version: 1,
          knownWords,
          favoriteWordIds,
          activityDays,
          completedLessonIds,
          examHistory,
          reviewSchedule,
          dailyTasks: { date: localDateKey(), done },
          dailyGoalWords,
          dailyReviewCount,
        }
        const merged = mergeLearningProgress(
          localSnapshot,
          (data?.progress ?? null) as Partial<LearningProgressSnapshot> | null,
          localDateKey(),
        )

        const migrateIds = (ids: string[]) => [...new Set(
          ids.map(id => dictionaryLegacyIdsRef.current.get(id) ?? id),
        )]
        const migratedSchedule: Record<string, ReviewState> = {}
        for (const [id, review] of Object.entries(merged.reviewSchedule)) {
          const canonicalId = dictionaryLegacyIdsRef.current.get(id) ?? id
          const existing = migratedSchedule[canonicalId]
          if (!existing || Date.parse(review.updatedAt) > Date.parse(existing.updatedAt)) {
            migratedSchedule[canonicalId] = review
          }
        }

        setKnownWords(migrateIds(merged.knownWords))
        setFavoriteWordIds(migrateIds(merged.favoriteWordIds))
        setActivityDays(merged.activityDays)
        setCompletedLessonIds(merged.completedLessonIds)
        setExamHistory(merged.examHistory)
        setReviewSchedule(migratedSchedule)
        setDone(merged.dailyTasks.done)
        setDailyGoalWords(merged.dailyGoalWords)
        setDailyReviewCount(merged.dailyReviewCount)
        setProgressSyncReadyFor(userId)
      } catch (error) {
        if (!cancelled) {
          setNotice({
            text: lang === 'ru'
              ? 'Не удалось загрузить облачный прогресс. Локальные данные сохранены.'
              : lang === 'uz'
                ? 'Bulutdagi natijalarni yuklab bo‘lmadi. Mahalliy ma’lumotlar saqlanadi.'
                : 'Could not load cloud progress. Your local progress is preserved.',
            kind: 'error',
          })
          // Do not enable cloud writes after a failed read: that could
          // overwrite a returning learner's remote progress with local state.
        }
      }
    }

    void loadProgress()
    return () => { cancelled = true }
  }, [authUser?.id])

  // Save only after the account's initial merge has completed, preventing an
  // empty first render from overwriting a returning learner's cloud history.
  useEffect(() => {
    if (!supabase || !authUser?.id || progressSyncReadyFor !== authUser.id) return

    let cancelled = false
    const payload: LearningProgressSnapshot = {
      version: 1,
      knownWords,
      favoriteWordIds,
      activityDays,
      completedLessonIds,
      examHistory,
      reviewSchedule,
      dailyTasks: { date: localDateKey(), done },
      dailyGoalWords,
      dailyReviewCount,
    }

    const timeout = window.setTimeout(async () => {
      try {
        const { error } = await (supabase as any).rpc(
          'merge_user_learning_progress',
          { p_progress: payload },
        )
        if (error) throw error
      } catch {
        if (!cancelled) {
          setNotice({
            text: lang === 'ru'
              ? 'Не удалось синхронизировать прогресс. Копия на этом устройстве сохранена.'
              : lang === 'uz'
                ? 'Natijalarni sinxronlab bo‘lmadi. Ushbu qurilmadagi nusxa saqlandi.'
                : 'Could not sync progress. The copy on this device is saved.',
            kind: 'error',
          })
        }
      }
    }, 700)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [
    authUser?.id, progressSyncReadyFor, knownWords, favoriteWordIds,
    activityDays, completedLessonIds, examHistory, reviewSchedule,
    done, dailyGoalWords, dailyReviewCount, lang,
  ])

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) {
      setAuthFeedback({ text: lang === 'ru' ? 'Авторизация пока не настроена: проверьте подключение Supabase.' : 'Authentication is not configured. Check the Supabase connection.', kind: 'error' })
      return
    }
    const email = authEmail.trim()
    if (!email || (authMode !== 'reset' && authPassword.length < 6)) {
      setAuthFeedback({ text: lang === 'ru' ? 'Введите email и пароль не короче 6 символов.' : 'Enter your email and a password of at least 6 characters.', kind: 'error' })
      return
    }
    setAuthBusy(true)
    setAuthFeedback(null)
    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: authPassword,
          options: { emailRedirectTo: window.location.origin },
        })
        if (error) {
          setAuthFeedback({ text: error.message, kind: 'error' })
          return
        }
        if (!data.session) {
          setAuthFeedback({ text: lang === 'ru' ? 'Аккаунт создан. Проверьте почту и подтвердите email, затем войдите.' : 'Account created. Check your email to confirm it, then sign in.', kind: 'success' })
          setAuthPassword('')
          return
        }
      } else if (authMode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: authPassword })
        if (error) {
          setAuthFeedback({ text: error.message, kind: 'error' })
          return
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
        if (error) {
          setAuthFeedback({ text: error.message, kind: 'error' })
          return
        }
        setAuthFeedback({ text: lang === 'ru' ? 'Если адрес зарегистрирован, на него придёт письмо для сброса пароля.' : 'If the email is registered, a password reset link will be sent.', kind: 'success' })
        return
      }
      setAuthOpen(false)
      setAuthPassword('')
      setAuthFeedback(null)
      setNotice({ text: lang === 'ru' ? 'Вы успешно вошли в HanziPath.' : 'You are signed in to HanziPath.', kind: 'success' })
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
    else setNotice({ text: lang === 'ru' ? 'Вы вышли из аккаунта.' : 'You have signed out.', kind: 'success' })
  }

  const availableWords = databaseWords ?? (reviewWords?.length ? reviewWords : words)
  const currentWords = useMemo(() => vocabularyCollection === 'course'
    ? originalLessonWords.filter(word => word.courseSystems?.includes(system))
    : availableWords.filter(word => {
      const memberships = system === '2.0'
        ? word.level20Memberships ?? (word.level20 == null ? [] : [word.level20])
        : word.level30Memberships ?? (word.level30 == null ? [] : [word.level30])
      return memberships.length > 0
    }), [availableWords, system, vocabularyCollection])
  const currentFavoriteCount = useMemo(
    () => currentWords.filter(word => favoriteWordIds.includes(wordId(word))).length,
    [currentWords, favoriteWordIds],
  )
  // Keep the eight demo dictionary entries out of course lessons. They are
  // examples for the HSK dictionary view and duplicate authored lesson words.
  const lessonEntries = [...(reviewWords?.length ? reviewWords : databaseWords ?? []), ...originalLessonWords]
  const lessonAssignments = useMemo(() => lessonWordAssignments(lessonEntries), [lessonEntries])
  const expandedLessonData = useMemo(() => {
    const display: DisplayLesson[] = []
    const assignmentMap: Record<string, Word[]> = {}
    const volumeSizes: Record<string, number> = {}
    const groups = [...new Set(lessonTemplates.map(lesson => `${lesson.system}:${lesson.level}`))]

    for (const group of groups) {
      const [system, levelValue] = group.split(':') as [CourseSystem, string]
      const level = Number(levelValue) as CourseLevel
      const baseLessons = lessonTemplates.filter(lesson => lesson.system === system && lesson.level === level)
      const pool = wordsForCourseLevel(lessonEntries, system, level)
      const uniquePool = [...new Map(pool.map(word => [`${word.hanzi}|${normalizeDictionaryPinyin(word.pinyin)}`, word])).values()]
      if (!baseLessons.length || !uniquePool.length) continue

      const poolKeys = new Set(uniquePool.map(word => `${word.hanzi}|${normalizeDictionaryPinyin(word.pinyin)}`))
      const topicalOrder = baseLessons.flatMap(lesson => lessonAssignments[lesson.id] ?? [])
      const orderedWords = [...new Map([...topicalOrder, ...uniquePool].map(word => [
        `${word.hanzi}|${normalizeDictionaryPinyin(word.pinyin)}`, word,
      ])).values()].filter(word => poolKeys.has(`${word.hanzi}|${normalizeDictionaryPinyin(word.pinyin)}`))

      // Choose the smallest number of lessons that keeps every lesson at 15–25 words.
      const unitCount = Math.ceil(orderedWords.length / 25)
      const baseSize = Math.floor(orderedWords.length / unitCount)
      const remainder = orderedWords.length % unitCount

      for (let index = 0; index < unitCount; index += 1) {
        const wordCount = baseSize + (index < remainder ? 1 : 0)
        const start = index * baseSize + Math.min(index, remainder)
        const chunk = orderedWords.slice(start, start + wordCount)
        const firstTemplateIndex = Math.floor(index * baseLessons.length / unitCount)
        const lastTemplateIndex = Math.floor((index + 1) * baseLessons.length / unitCount)
        const groupedTemplates = unitCount <= baseLessons.length
          ? baseLessons.slice(firstTemplateIndex, Math.max(firstTemplateIndex + 1, lastTemplateIndex))
          : [baseLessons[index % baseLessons.length]]
        const base = groupedTemplates[0]
        const repeatNumber = Math.floor(index / baseLessons.length) + 1
        const title = unitCount > baseLessons.length && repeatNumber > 1
          ? `${base.title} · блок ${repeatNumber}`
          : base.title
        const id = `${base.id}-unit-${index + 1}`
        const volume = Math.floor(index / 15) + 1
        const volumeLesson = index % 15 + 1
        display.push({ ...base, id, title, volume, volumeLesson, mergedLessons: groupedTemplates })
        assignmentMap[id] = chunk
      }
      volumeSizes[`${system}-${level}`] = Math.ceil(unitCount / 15)
    }
    return { lessons: display, assignments: assignmentMap, volumeCounts: volumeSizes }
  }, [lessonAssignments, lessonEntries])

  const dictionaryLessonMembership = useMemo(() => {
    const memberships = new Map<string, Set<string>>()
    for (const [lessonId, assignedWords] of Object.entries(expandedLessonData.assignments)) {
      for (const word of assignedWords) {
        const id = wordId(word)
        const lessons = memberships.get(id) ?? new Set<string>()
        lessons.add(lessonId)
        memberships.set(id, lessons)
      }
    }
    return memberships
  }, [expandedLessonData.assignments])

  const courseAllLessons = expandedLessonData.lessons.filter(lesson => lesson.system === courseSystem && lesson.level === courseLevel)
  const courseVolumeCount = expandedLessonData.volumeCounts[`${courseSystem}-${courseLevel}`] ?? 1
  const courseLessons = courseAllLessons.filter(lesson => lesson.volume === selectedVolume)
  const activeLesson = courseLessons.find(lesson => lesson.id === activeLessonId) ?? (activeLessonId ? courseAllLessons.find(lesson => lesson.id === activeLessonId) : undefined) ?? courseLessons[0]
  const activeLessonWords = activeLesson ? expandedLessonData.assignments[activeLesson.id] ?? [] : []
  const dialogueLines = activeLesson ? [
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
  ] : []
  const cardsLessons = expandedLessonData.lessons.filter(lesson => lesson.system === cardsSystem && lesson.level === cardsLevel)
  const selectedCardsLesson = cardsLessons.find(lesson => lesson.id === cardsLessonId) ?? cardsLessons[0]
  const cardStudyWords = useMemo(() => {
    const assigned = selectedCardsLesson ? expandedLessonData.assignments[selectedCardsLesson.id] ?? [] : []
    // Source IDs can differ for duplicate vocabulary rows; compare the actual
    // headword + pronunciation so one lesson never repeats the same card.
    const base = uniqueLessonCards(assigned)
    const dueIds = new Set(dueReviewIds(reviewSchedule))
    return [...base].sort((a, b) => {
      const aId = wordId(a)
      const bId = wordId(b)
      const aRank = dueIds.has(aId) ? 0 : reviewSchedule[aId] ? 2 : 1
      const bRank = dueIds.has(bId) ? 0 : reviewSchedule[bId] ? 2 : 1
      if (aRank !== bRank) return aRank - bRank
      const aDue = Date.parse(reviewSchedule[aId]?.dueAt ?? '') || 0
      const bDue = Date.parse(reviewSchedule[bId]?.dueAt ?? '') || 0
      return aDue - bDue
    })
  }, [selectedCardsLesson, expandedLessonData.assignments, reviewSchedule])
  const listeningLessons = expandedLessonData.lessons.filter(lesson => lesson.system === listeningSystem && lesson.level === listeningLevel)
  const selectedListeningLesson = listeningLessons.find(lesson => lesson.id === listeningLessonId) ?? listeningLessons[0]
  const listeningStudyWords = selectedListeningLesson ? expandedLessonData.assignments[selectedListeningLesson.id] ?? [] : []
  const grammarLessonsForLevel = expandedLessonData.lessons.filter(lesson => lesson.system === grammarSystem && lesson.level === grammarLevel)
  const grammarTopicsForLevel = grammarLessonsForLevel.flatMap(lesson => (lesson.mergedLessons?.length ? lesson.mergedLessons : [lesson]).map((topic, index) => ({ id: lesson.id + '::' + topic.id, lesson, topic, index })))
  const knownInCurrentWords = knownWords.filter(id => currentWords.some(word => wordId(word) === id)).length
  const activeCard = cardStudyWords.length ? cardStudyWords[((cardIndex % cardStudyWords.length) + cardStudyWords.length) % cardStudyWords.length] : undefined
  const listeningWord = listeningStudyWords.length ? listeningStudyWords[((listeningIndex % listeningStudyWords.length) + listeningStudyWords.length) % listeningStudyWords.length] : undefined
  const currentAdaptiveDifficulty = adaptiveDifficulty(reviewSchedule)
  const listeningOptions = useMemo(() => {
    if (!listeningWord) return []
    const unique = [...new Map([listeningWord, ...listeningStudyWords.filter(word => wordId(word) !== wordId(listeningWord))].map(word => [wordId(word), word] as const)).values()]
    return shuffleWithSeed(unique.slice(0, currentAdaptiveDifficulty + 1), listeningIndex + 101)
  }, [listeningStudyWords, listeningIndex, listeningWord, currentAdaptiveDifficulty])
  const recordActivity = () => {
    const today = localDateKey()
    setActivityDays(days => days.includes(today) ? days : [...days, today].slice(-400))
  }

  const rateFlashcard = (word: Word, quality: ReviewQuality) => {
    const id = wordId(word)
    setReviewSchedule(current => ({
      ...current,
      [id]: scheduleReview(current[id], quality),
    }))
    if (quality === 'again') {
      setKnownWords(items => items.filter(item => item !== id))
    } else if (quality === 'good' || quality === 'easy') {
      setKnownWords(items => items.includes(id) ? items : [...items, id])
    }
    const today = localDateKey()
    setDailyReviewCount(current => ({
      date: today,
      count: current.date === today ? current.count + 1 : 1,
    }))
    recordActivity()
    setShowAnswer(false)
    setCardIndex(index => cardStudyWords.length ? (index + 1) % cardStudyWords.length : 0)
  }

  const filtered = useMemo(() => {
    const matches = currentWords.filter(word => {
      const searchable = [
        word.hanzi,
        word.traditional,
        word.pinyin,
        word.ru,
        word.en,
        word.uz,
      ].filter(Boolean).join(' ')

      const normalizedQuery = normalizePinyin(query)
      const memberships = vocabularyCollection === 'course'
        ? (word.courseStage == null ? [] : [word.courseStage])
        : system === '2.0'
          ? word.level20Memberships ?? (word.level20 == null ? [] : [word.level20])
          : word.level30Memberships ?? (word.level30 == null ? [] : [word.level30])

      return (
        (level === 'all' || memberships.some(value => String(value).replace('7-9', '7') === level)) &&
        (!favoritesOnly || favoriteWordIds.includes(wordId(word))) &&
        (!knownOnly || knownWords.includes(wordId(word))) &&
        (!dictionaryLessonId || dictionaryLessonMembership.get(wordId(word))?.has(dictionaryLessonId)) &&
        (!dictionaryPosFilter || word.partOfSpeech?.includes(dictionaryPosFilter)) &&
        (
          searchable.toLocaleLowerCase().includes(query.toLocaleLowerCase()) ||
          (
            normalizedQuery !== '' &&
            normalizePinyin(word.pinyin).includes(normalizedQuery)
          )
        )
      )
    })

    return matches.sort((a, b) => {
      if (dictionarySort === 'pinyin') {
        return normalizePinyin(a.pinyin).localeCompare(normalizePinyin(b.pinyin))
      }
      if (dictionarySort === 'level') {
        const levelA = Number(vocabularyCollection === 'course' ? a.courseStage : system === '2.0' ? a.level20 : a.level30)
        const levelB = Number(vocabularyCollection === 'course' ? b.courseStage : system === '2.0' ? b.level20 : b.level30)
        return levelA - levelB || a.hanzi.localeCompare(b.hanzi)
      }
      if (dictionarySort === 'frequency') {
        return (a.frequencyRank ?? Number.MAX_SAFE_INTEGER) - (b.frequencyRank ?? Number.MAX_SAFE_INTEGER) || a.hanzi.localeCompare(b.hanzi)
      }
      return a.hanzi.localeCompare(b.hanzi)
    })
  }, [currentWords, dictionaryLessonId, dictionaryLessonMembership, dictionaryPosFilter, dictionarySort, favoriteWordIds, favoritesOnly, knownOnly, knownWords, level, query, system, vocabularyCollection])
  useEffect(() => setDictionaryPage(0), [system, level, query, vocabularyCollection, favoritesOnly, knownOnly, dictionarySort, dictionaryLessonId, dictionaryPosFilter])

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

  const levelNames = system === '2.0'
    ? ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6']
    : ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6', 'HSK 7–9']

  const levelFilterOptions = vocabularyCollection === 'course'
    ? Array.from({ length: system === '2.0' ? 6 : 9 }, (_, index) => ({
      value: String(index + 1),
      label: `${t('vocab.courseStage')} ${index + 1} · ${currentWords.filter(word => word.courseStage === index + 1).length.toLocaleString(lang)}`,
    }))
    : (system === '2.0' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 7]).map((levelValue, index) => ({
      value: String(levelValue),
      label: `${levelNames[index]} · ${currentWords.filter(word => {
        const memberships = system === '2.0'
          ? word.level20Memberships ?? (word.level20 == null ? [] : [word.level20])
          : word.level30Memberships ?? (word.level30 == null ? [] : [word.level30])
        return memberships.some(value => String(value).replace('7-9', '7') === String(levelValue))
      }).length.toLocaleString(lang)}`,
    }))
  const dictionaryLessonOptions = expandedLessonData.lessons
    .filter(lesson => lesson.system === system && (
      level === 'all' || String(lesson.level) === level
    ))
    .map(lesson => ({
      value: lesson.id,
      label: `${lesson.title} · ${currentWords.filter(word => dictionaryLessonMembership.get(wordId(word))?.has(lesson.id)).length.toLocaleString(lang)}`,
    }))

  const dictionaryPosOptions = [...new Set(currentWords.flatMap(word => word.partOfSpeech ?? []))]
    .sort()
    .map(value => ({
      value,
      label: `${partOfSpeechLabel(value, lang)} · ${currentWords.filter(word => word.partOfSpeech?.includes(value)).length.toLocaleString(lang)}`,
    }))

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
    if (lang === 'ru') return word.exampleRu || word.exampleEn
    if (lang === 'en') return word.exampleEn
    return word.exampleUzVerified && word.exampleUz
      ? word.exampleUz
      : word.exampleEn || t('vocab.exampleUnavailable')
  }

  const translationStatusLabel = (status?: string) => {
    if (!status) return null
    if (status === 'source_verified') {
      return lang === 'ru' ? 'Подтверждено по источнику' : lang === 'uz' ? 'Manba bilan tasdiqlangan' : 'Source verified'
    }
    if (status === 'missing_translation') {
      return lang === 'ru' ? 'Перевод отсутствует' : lang === 'uz' ? 'Tarjima yo‘q' : 'Translation missing'
    }
    if (status === 'ai_assisted_unverified' || status === 'ai_draft_unverified') return t('vocab.aiDraft')
    return t('vocab.sourceUnverified')
  }



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
    const memberships = standard === '2.0'
      ? word.level20Memberships ?? (word.level20 == null ? [] : [word.level20])
      : word.level30Memberships ?? (word.level30 == null ? [] : [word.level30])
    if (memberships.length === 0) return null
    return memberships.map(value => `HSK ${String(value).replace('7-9', '7–9')}`).join(' · ')
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
  const examTotalSeconds = examFormat(examSystem, examLevel).minutes * 60
  const examElapsedSeconds = examStarted
    ? Math.max(0, examTotalSeconds - examSecondsLeft)
    : 0
  const examSectionStats = (['listening', 'reading', 'writing', 'translation', 'speaking'] as const)
    .map(section => {
      const items = examQuestionsState
        .map((question, index) => ({ question, index }))
        .filter(item => item.question.section === section)
      if (items.length === 0) return null
      const scored = items.filter(item => !item.question.manualReview)
      const correct = scored.filter(({ question, index }) => {
        const response = examAnswers[index] ?? ''
        return question.section === 'writing'
          ? normalizeWrittenAnswer(response) === normalizeWrittenAnswer(question.answer)
          : response === question.answer
      }).length
      const manual = items.filter(item => item.question.manualReview)
      const manualAnswered = manual.filter(({ index }) => Boolean(examAnswers[index]?.trim())).length
      return { section, total: items.length, scored: scored.length, correct, manual: manual.length, manualAnswered }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  const profileWords = databaseWords ?? (reviewWords?.length ? reviewWords : [])
  const profileKnownCount = profileWords.filter(word => knownWords.includes(wordId(word))).length
  const profileFavoriteCount = profileWords.filter(word => favoriteWordIds.includes(wordId(word))).length
  const profileExamAverage = examHistory.length
    ? Math.round(examHistory.reduce((sum, attempt) => sum + (attempt.total ? attempt.score / attempt.total * 100 : 0), 0) / examHistory.length)
    : 0
  const profileDueReviews = dueReviewIds(reviewSchedule).length

  useEffect(() => {
    if (!examStarted || !examFinished || examSavedRef.current) return
    examSavedRef.current = true
    setExamHistory(items => [{
      system: examSystem,
      level: examLevel,
      score: examCorrectCount,
      total: examScoredCount,
      date: new Date().toISOString(),
      manualAnswered: examManualCount,
      manualTotal: examManualTotal,
      durationSeconds: examElapsedSeconds,
    }, ...items].slice(0, 30))
  }, [examStarted, examFinished, examSystem, examLevel, examCorrectCount, examScoredCount, examManualCount, examManualTotal, examElapsedSeconds])


  const startExam = () => {
    const sourceWords = databaseWords?.length
      ? databaseWords
      : reviewWords?.length
        ? reviewWords
        : null
    if (!sourceWords) {
      setNotice({
        text: lang === 'ru' ? 'Сначала дождись загрузки полного словаря.' : lang === 'uz' ? 'Avval to‘liq lug‘at yuklanishini kuting.' : 'Wait for the full vocabulary to finish loading first.',
        kind: 'error',
      })
      return
    }
    const generated = examQuestions(examSystem, examLevel, sourceWords, lang)
    if (generated.length === 0) {
      setNotice({
        text: lang === 'ru' ? 'Не удалось сформировать экзамен для этого уровня. Проверь загрузку словаря и уроков.' : lang === 'uz' ? 'Bu daraja uchun imtihon tuzilmadi. Lug‘at va darslar yuklanganini tekshiring.' : 'Could not generate this exam. Check that the vocabulary and lessons have loaded.',
        kind: 'error',
      })
      return
    }
    examSavedRef.current = false
    setNotice(null)
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

  return <div className={`app ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`} data-theme={theme}>
    <aside className={`sidebar ${menu ? 'show' : ''}`} aria-label={t('nav.group')}>
      <div className="brand">
        <div className="brandmark" aria-hidden="true">汉</div>
        <div><b>HanziPath</b><small>汉字之路</small></div>
        <button className="sidebar-collapse" type="button" aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setSidebarCollapsed(value => !value)}>{sidebarCollapsed ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}</button>
        <button className="mobile-close" aria-label={t('common.closeMenu')} onClick={() => setMenu(false)}><X/></button>
      </div>

      <div className="side-label">{t('nav.group')}</div>

      {navKeys.map((key, i) => (
        <button
          key={key}
          className={`navitem ${section === i ? 'active' : ''}`}
          aria-label={t(key)}
          title={t(key)}
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
          aria-label={t('profile.settings')}
          title={t('profile.settings')}
          onClick={() => { setSection(7); setMenu(false) }}
        >
          <Settings/>
          <span>{t('profile.settings')}</span>
        </button>

        <div className="profile">
          <div className="avatar">H</div>
          <div className="profile-name">
            <b>{authUser?.email || t('profile.guest')}</b>
            <small>{authUser
              ? (progressSyncReadyFor === authUser.id
                ? (lang === 'ru' ? 'Прогресс синхронизируется' : lang === 'uz' ? 'Natijalar sinxronlanadi' : 'Progress sync enabled')
                : (lang === 'ru' ? 'Загрузка прогресса…' : lang === 'uz' ? 'Natijalar yuklanmoqda…' : 'Loading progress…'))
              : t('profile.settings')}</small>
          </div>
          <button className="profile-action" title={authUser ? 'Sign out' : t('profile.signIn')} aria-label={authUser ? 'Sign out' : t('profile.signIn')} onClick={() => authUser ? void signOut() : (setAuthMode('signin'), setAuthOpen(true))}>
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
          <label className="theme-select" title={lang === 'ru' ? 'Тема оформления' : lang === 'uz' ? 'Mavzu' : 'Appearance theme'}>
            <Palette size={16}/>
            <span className="sr-only">{lang === 'ru' ? 'Тема оформления' : lang === 'uz' ? 'Mavzu' : 'Appearance theme'}</span>
            <select aria-label={lang === 'ru' ? 'Тема оформления' : lang === 'uz' ? 'Mavzu' : 'Appearance theme'} value={theme} onChange={event => setTheme(event.target.value as 'light' | 'dark' | 'burgundy')}>
              <option value="light">{lang === 'ru' ? 'Светлая' : lang === 'uz' ? 'Yorug‘' : 'Light'}</option>
              <option value="dark">{lang === 'ru' ? 'Тёмная' : lang === 'uz' ? 'Qorong‘i' : 'Dark'}</option>
              <option value="burgundy">{lang === 'ru' ? 'Бордовая' : lang === 'uz' ? 'Bordo' : 'Burgundy'}</option>
            </select>
          </label>

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
            <span>{authUser ? (lang === 'ru' ? 'Выйти' : 'Sign out') : t('profile.signIn')}</span>
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
            <img className="hero-photo" src={heroImage} alt="" />
            <div className="hero-photo-shade"/>
            <div className="hero-seal">汉</div>
          </div>
        </section>


        <section className="shortcut-strip" aria-label={lang === 'ru' ? 'Быстрые разделы' : 'Quick study sections'}>
          {[
            {label: lang === 'ru' ? 'Уроки' : 'Lessons', icon: <BookOpen/>, section: 1},
            {label: lang === 'ru' ? 'Словарь' : 'Dictionary', icon: <Search/>, section: 2},
            {label: lang === 'ru' ? 'Грамматика' : 'Grammar', icon: <GraduationCap/>, section: 5},
            {label: lang === 'ru' ? 'Аудирование' : 'Listening', icon: <Headphones/>, section: 4},
            {label: lang === 'ru' ? 'Практика' : 'Practice', icon: <Target/>, section: 6},
            {label: lang === 'ru' ? 'Флешкарты' : 'Flashcards', icon: <Layers/>, section: 3},
            {label: lang === 'ru' ? 'Тесты' : 'Tests', icon: <CheckCircle2/>, section: 6},
            {label: lang === 'ru' ? 'Прогресс' : 'Progress', icon: <ChartNoAxesColumnIncreasing/>, section: 7},
          ].map(item => <button className="shortcut" key={item.label} onClick={() => setSection(item.section)}><span>{item.icon}</span><b>{item.label}</b></button>)}
        </section>

        <div className="dashboard-grid">
          <div className="dashboard-main-column">
            <section className="dashboard-panel continue-panel">
              <div className="section-heading">
                <div><span className="kicker">{lang === 'ru' ? 'ТВОЙ СЛЕДУЮЩИЙ ШАГ' : 'YOUR NEXT STEP'}</span><h2>{lang === 'ru' ? 'Продолжить обучение' : 'Continue learning'}</h2></div>
                <button className="text-link" onClick={() => setSection(1)}>{lang === 'ru' ? 'Все уроки' : 'All lessons'} <ChevronRight size={14}/></button>
              </div>
              <div className="continue-card">
                <div className="continue-illustration"><span className="continue-lantern">灯</span><span className="continue-book">书</span><i/></div>
                <div className="continue-copy">
                  <span className="course-chip">HSK {courseSystem} · {lang === 'ru' ? 'Уровень' : 'Level'} {courseLevel}</span>
                  <h3>{activeLesson?.title ?? (lang === 'ru' ? 'Первый урок' : 'First lesson')}</h3>
                  <p>{lang === 'ru' ? 'Продолжай изучать новые слова и китайские выражения.' : 'Keep learning new words and useful Chinese expressions.'}</p>
                  <div className="continue-progress"><i style={{width: (courseAllLessons.length ? Math.round(completedLessonIds.filter(id => courseAllLessons.some(lesson => lesson.id === id)).length / courseAllLessons.length * 100) : 0) + '%'}}/></div>
                  <div className="continue-meta"><small>{completedLessonIds.filter(id => courseAllLessons.some(lesson => lesson.id === id)).length} / {courseAllLessons.length} {lang === 'ru' ? 'уроков пройдено' : 'lessons completed'}</small><button className="continue-play" onClick={() => setSection(1)} aria-label={lang === 'ru' ? 'Открыть урок' : 'Open lesson'}><Play size={17} fill="currentColor"/></button></div>
                </div>
              </div>
            </section>

            <section className="dashboard-panel daily-goal-panel">
              <div className="section-heading">
                <div>
                  <span className="kicker">{lang === 'ru' ? 'ЕЖЕДНЕВНАЯ ЦЕЛЬ' : lang === 'uz' ? 'KUNLIK MAQSAD' : 'DAILY GOAL'}</span>
                  <h2>{lang === 'ru' ? 'Повторение слов' : lang === 'uz' ? 'So‘zlarni takrorlash' : 'Word review'}</h2>
                </div>
                <label className="daily-goal-select">
                  <span>{lang === 'ru' ? 'Цель в день' : lang === 'uz' ? 'Kunlik maqsad' : 'Daily target'}</span>
                  <select value={dailyGoalWords} onChange={event => setDailyGoalWords(Number(event.target.value))}>
                    {[5, 10, 15, 20, 30, 40, 50].map(value => <option key={value} value={value}>{value} {lang === 'ru' ? 'слов' : lang === 'uz' ? 'so‘z' : 'words'}</option>)}
                  </select>
                </label>
              </div>
              <div className="daily-goal-progress">
                <div><b>{Math.min(dailyReviewCount.date === localDateKey() ? dailyReviewCount.count : 0, dailyGoalWords)} / {dailyGoalWords}</b><span>{lang === 'ru' ? 'повторений сегодня' : lang === 'uz' ? 'bugungi takrorlashlar' : 'reviews today'}</span></div>
                <div className="daily-goal-track"><i style={{ width: Math.min(100, ((dailyReviewCount.date === localDateKey() ? dailyReviewCount.count : 0) / dailyGoalWords) * 100) + '%' }}/></div>
              </div>
            </section>

            <section className="dashboard-panel course-panel">
              <div className="section-heading">
                <div><span className="kicker">{lang === 'ru' ? 'ВЫБЕРИ СВОЙ МАРШРУТ' : 'CHOOSE YOUR PATH'}</span><h2>{lang === 'ru' ? 'Выберите курс' : 'Choose your course'}</h2></div>
                <div className="standard-switch"><button className={courseSystem === '2.0' ? 'selected' : ''} onClick={() => {setCourseSystem('2.0');setCourseLevel(1);setActiveLessonId(null)}}>HSK 2.0</button><button className={courseSystem === '3.0' ? 'selected' : ''} onClick={() => {setCourseSystem('3.0');setCourseLevel(1);setActiveLessonId(null)}}>HSK 3.0</button></div>
              </div>
              <div className="level-grid">
                {[1,2,3,4,5,6].map(value => {
                  const levelValue=value as CourseLevel;
                  const count=wordsForCourseLevel(lessonEntries,courseSystem,levelValue).length;
                  const lessons=expandedLessonData.lessons.filter(lesson=>lesson.system===courseSystem&&lesson.level===levelValue).length;
                  return <button key={value} className={'level-card level-card-' + value + (courseLevel===levelValue?' selected':'')} onClick={()=>{setCourseLevel(levelValue);setActiveLessonId(null);setSection(1)}}>
                    <span className="level-art">{['春','学','花','山','龙','云'][value-1]}</span><b>HSK {value}</b><small>{count.toLocaleString(lang)} {lang==='ru'?'слов':'words'}</small><em>{lessons} {lang==='ru'?'уроков':'lessons'}</em>
                  </button>
                })}
                {courseSystem==='3.0'&&<button className={'level-card level-advanced' + (courseLevel===7?' selected':'')} onClick={()=>{setCourseLevel(7);setActiveLessonId(null);setSection(1)}}><span className="level-art">龙</span><b>HSK 7–9</b><small>{wordsForCourseLevel(lessonEntries,'3.0',7).length.toLocaleString(lang)} {lang==='ru'?'слов':'words'}</small><em>{expandedLessonData.lessons.filter(lesson=>lesson.system==='3.0'&&lesson.level===7).length} {lang==='ru'?'уроков':'lessons'}</em></button>}
              </div>
            </section>

            <section className="dashboard-bottom-panels">
              <div className="dashboard-panel mini-panel"><span className="kicker">学习 · 每日积累</span><h3>{lang==='ru'?'Повторение слов':'Word review'}</h3><p>{lang==='ru'?'Закрепляй изученное с помощью карточек.':'Strengthen what you have learned with flashcards.'}</p><button className="mini-action" onClick={()=>setSection(3)}><Layers size={15}/>{lang==='ru'?'Открыть карточки':'Open flashcards'}<ChevronRight size={14}/></button></div>
              <div className="dashboard-panel mini-panel"><span className="kicker">听力 · 开口练习</span><h3>{lang==='ru'?'Практика аудирования':'Listening practice'}</h3><p>{lang==='ru'?'Слушай произношение и проверяй понимание.':'Listen to pronunciation and test comprehension.'}</p><button className="mini-action" onClick={()=>setSection(4)}><Headphones size={15}/>{lang==='ru'?'Начать практику':'Start practice'}<ChevronRight size={14}/></button></div>
            </section>
          </div>

          <aside className="dashboard-side-column">
            <section className="dashboard-panel today-panel">
              <div className="section-heading"><div><span className="kicker">{t('dashboard.due')}</span><h2>{t('dashboard.today')}</h2></div><CalendarCheck size={19}/></div>
              {(['dashboard.task1','dashboard.task2','dashboard.task3'] as TranslationKey[]).map((key,i)=><label className={'task ' + (done[i]?'checked':'')} key={key}><input type="checkbox" checked={done[i]} onChange={()=>{setDone(items=>items.map((value,index)=>index===i?!value:value));if(!done[i])recordActivity()}}/><span className="fakecheck">{done[i]?'✓':''}</span><span className="task-copy">{t(key)}<small>{[10,5,8][i]} {t('common.minutes')}</small></span></label>)}
              <div className="daily-foot"><span>{done.filter(Boolean).length}/3 {t('dashboard.completed')}</span><div className="progress"><i style={{width:(done.filter(Boolean).length/3*100)+'%'}}/></div></div>
            </section>
            <section className="dashboard-panel learning-stats">
              <div className="section-heading"><div><span className="kicker">{lang==='ru'?'ТВОЯ АКТИВНОСТЬ':'YOUR ACTIVITY'}</span><h2>{lang==='ru'?'Статистика обучения':'Learning statistics'}</h2></div><BarChart3 size={18}/></div>
              <div className="stats-summary"><strong>{getStreak(activityDays)}</strong><span>{lang==='ru'?'дней подряд':'day streak'}</span><b>{knownInCurrentWords}</b><span>{lang==='ru'?'слов изучено':'words learned'}</span></div>
              <div className="activity-chart" aria-label={lang==='ru'?'Активность за семь дней':'Seven day activity'}>
                {Array.from({length:7},(_,i)=>{const date=new Date();date.setDate(date.getDate()-(6-i));const key=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');const active=activityDays.includes(key);return <span key={key} className={active?'active':''} style={{height:active?'70%':(18+(i%3)*9)+'%'}}/>})}
              </div>
              <div className="chart-labels"><small>{lang==='ru'?'7 дней назад':'7 days ago'}</small><small>{lang==='ru'?'Сегодня':'Today'}</small></div>
            </section>
            <section className="dashboard-panel fast-actions">
              <div className="section-heading"><div><span className="kicker">{lang==='ru'?'БЫСТРЫЙ ДОСТУП':'QUICK ACTIONS'}</span><h2>{lang==='ru'?'Быстрые действия':'Quick actions'}</h2></div><Sparkles size={18}/></div>
              <button onClick={()=>setSection(1)}><Play size={15}/>{lang==='ru'?'Продолжить урок':'Continue lesson'}<ChevronRight size={14}/></button>
              <button onClick={()=>setSection(2)}><Search size={15}/>{lang==='ru'?'Найти слово':'Find a word'}<ChevronRight size={14}/></button>
              <button onClick={()=>setSection(3)}><Bookmark size={15}/>{lang==='ru'?'Повторить слова':'Review words'}<ChevronRight size={14}/></button>
            </section>
          </aside>
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
              setSelectedVolume(1)
              setActiveLessonId(null)
              setLessonListeningChoice(null)
              setClosingChoice(null)
              setShowAnswer(false)
              setCardIndex(0)
            }}>HSK {standard}</button>)}
          </div>

          <div className="course-levels" role="group" aria-label={t('course.level')}>
            {(courseSystem === '2.0' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 7, 8, 9]).map(course => {
              const count = expandedLessonData.lessons.filter(item => item.system === courseSystem && item.level === course).length
              const completed = expandedLessonData.lessons.filter(item => item.system === courseSystem && item.level === course && completedLessonIds.includes(item.id)).length
              return <button key={course} className={`course-level ${courseLevel === course ? 'selected' : ''}`} onClick={() => {
                setCourseLevel(course as CourseLevel)
                setSelectedVolume(1)
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
          <div className="course-volumes" role="group" aria-label={lang === 'ru' ? 'Часть учебника' : 'Book volume'}>
            {Array.from({ length: courseVolumeCount }, (_, index) => index + 1).map(volume => {
              const total = courseAllLessons.filter(item => item.volume === volume).length
              const doneCount = courseAllLessons.filter(item => item.volume === volume && completedLessonIds.includes(item.id)).length
              return <button key={volume} className={`course-volume ${selectedVolume === volume ? 'selected' : ''}`} onClick={() => { setSelectedVolume(volume); setActiveLessonId(null); setCardIndex(0); setShowAnswer(false) }}>
                <b>{lang === 'ru' ? 'Часть' : 'Part'} {volume}</b><span>{total} {t('course.lessonCount')}</span><small>{doneCount}/{total} {t('course.progress')}</small>
              </button>
            })}
          </div>



          {activeLessonId && activeLesson && <div className="lesson-detail">
            <button className="outline lesson-back" onClick={() => { setActiveLessonId(null); setLessonListeningChoice(null); setClosingChoice(null) }}>‹ {t('course.back')}</button>
            <div className="lesson-detail-heading">
              <div><span className="kicker">HSK {courseSystem} · {courseLevel} · {lang === 'ru' ? 'Часть' : 'Part'} {activeLesson.volume} · {t('course.lesson')} {activeLesson.volumeLesson}</span><h2>{activeLesson.title}</h2></div>
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
              {activeLesson.mergedLessons && activeLesson.mergedLessons.length > 1 && <div className="grammar-extra-examples">
                <h4>{lang === 'ru' ? 'Дополнительные грамматические темы' : lang === 'uz' ? 'Qo‘shimcha grammatika mavzulari' : 'Additional grammar topics'}</h4>
                {activeLesson.mergedLessons.slice(1).map(item => <article className="lesson-example" key={item.id}>
                  <b>{item.grammar.title}</b><code>{item.grammar.pattern}</code><p>{item.grammar.explanation}</p>
                  <strong>{item.grammar.example}</strong><span>{item.grammar.pinyin}</span><small>{item.grammar.meaning}</small>
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
                <button className="sound" onClick={() => speak(closingReading.hanzi)} aria-label={`${t('vocab.listen')}: ${closingReading.hanzi}`}><Volume2 size={18}/></button>
              </div>
              <p className="unassisted-text" lang="zh-CN">{closingReading.hanzi}</p>
              <p className="reading-question">{t('course.readingQuestion')}</p>
              <div className="answer-options">
                {closingReading.options[lang].map((option, index) => <button key={option} className={`answer-option ${closingChoice !== null && index === 0 ? 'correct' : ''} ${closingChoice === index && index !== 0 ? 'incorrect' : ''}`} disabled={closingChoice !== null} onClick={() => {
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
                  <p className="recap-hanzi" lang="zh-CN">{closingReading.hanzi}</p>
                  <span>{closingReading.meaning[lang]}</span>
                </div>
              </div>
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
              const newWordCount = expandedLessonData.assignments[lesson.id]?.length ?? 0
              return <article className={`lesson-card course-lesson-card ${completed ? 'completed' : ''}`} key={lesson.id}>
                <span className="lesson-number">{String(lesson.volumeLesson).padStart(2, '0')}</span>
                <div><h3>{lesson.title}</h3><p>{lesson.grammar.title} · {newWordsCountLabel(newWordCount, lang)}</p><code>{lesson.grammar.pattern}</code></div>
              <button className="course-open" onClick={() => {
                setActiveLessonId(lesson.id)
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
              {vocabularyCollection === 'course' ? t('vocab.courseCollection') : databaseWords ? t('common.database') : reviewWords?.length ? t('vocab.openDataset') : t('vocab.demo')}
            </span>
          </div>

          <div className="standard-switch vocabulary-switch" role="group" aria-label={t('vocab.collection')}>
            <button className={`outline ${vocabularyCollection === 'course' ? 'selected' : ''}`} aria-pressed={vocabularyCollection === 'course'} onClick={() => { setVocabularyCollection('course'); setLevel('all') }}>{t('vocab.courseCollection')}</button>
            <button className={`outline ${vocabularyCollection === 'hsk' ? 'selected' : ''}`} aria-pressed={vocabularyCollection === 'hsk'} onClick={() => { setVocabularyCollection('hsk'); setLevel('all') }}>{t('vocab.hskCollection')}</button>
          </div>

          <p className="notice-text">
            {vocabularyCollection === 'course'
              ? t('vocab.courseNotice')
              : databaseWords
                ? t('vocab.catalogReady')
                : reviewWords?.length
                  ? t('vocab.reviewNotice')
                  : reviewWords === null
                    ? t('vocab.loading')
                    : t('vocab.demoNotice')}
          </p>

          {(vocabularyCollection === 'course' || (Boolean(reviewWords?.length) && !databaseWords)) && <>
            <div className="dictionary-summary">
              <div><strong>{currentWords.length.toLocaleString(lang)}</strong><span>{vocabularyCollection === 'course' ? t('vocab.wordsInCourse') : system === '2.0' ? t('vocab.wordsInHsk20') : t('vocab.wordsInHsk30')}</span></div>
              <div><strong>{filtered.length.toLocaleString(lang)}</strong><span>{t('vocab.matchingWords')}</span></div>
              <div><strong>{currentFavoriteCount.toLocaleString(lang)}</strong><span>{t('vocab.savedFavorites')}</span></div>
              <div><strong>{pageSize}</strong><span>{t('vocab.resultsPerPage')}</span></div>
            </div>
            {Boolean(reviewWords?.length) && !databaseWords && vocabularyCollection === 'hsk' && <p className="source-credit">
              {t('vocab.attribution')}{' '}
              <a href="https://hearmandarin.com/datasets/" target="_blank" rel="noreferrer">HearMandarin</a>{' · '}
              <a href="https://huggingface.co/datasets/Maqsudjonpolatov/hsk-chinese-uzbek-russian" target="_blank" rel="noreferrer">Zitou</a>{' · '}
              <a href="https://hanzibook.com/ru/hsk-3-0" target="_blank" rel="noreferrer">HanziBook</a>{' · '}
              <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>
            </p>}
          </>}

          {catalogError && (
            <p className="notice-text">{t('vocab.catalogError')}</p>
          )}

          {vocabularyCollection === 'hsk' && (reviewWords?.length ?? 0) > 0 && (
            <p className="notice-text catalog-review-notice">
              {lang === 'ru'
                ? 'Список HSK и примеры собраны из открытых источников. Переводы RU/UZ частично подготовлены с помощью ИИ и требуют проверки; примеры не проверялись индивидуально.'
                : lang === 'uz'
                  ? 'HSK ro‘yxati va misollar ochiq manbalardan yig‘ilgan. RU/UZ tarjimalarining bir qismi AI yordamida tayyorlangan va tekshiruv talab qiladi; misollar alohida tekshirilmagan.'
                  : 'HSK vocabulary and examples are assembled from open sources. Some RU/UZ glosses are AI-assisted and still need review; example sentences have not been individually checked.'}
              {' · '}<a href="/data-attribution.html" target="_blank" rel="noreferrer">{lang === 'ru' ? 'Источники и лицензии' : lang === 'uz' ? 'Manbalar va litsenziyalar' : 'Sources and licenses'}</a>
            </p>
          )}

          <div className="filters dictionary-filters">
            <label className="searchbox">
              <Search size={18}/>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t('vocab.search')}
                aria-label={t('vocab.search')}
              />
              {query && <button className="dictionary-clear-search" type="button" onClick={() => setQuery('')} aria-label={lang === 'ru' ? 'Очистить поиск' : lang === 'uz' ? 'Qidiruvni tozalash' : 'Clear search'}><X size={15}/></button>}
            </label>

            <label className="sr-only" htmlFor="system-filter">{t('vocab.system')}</label>
            <select id="system-filter" value={system} onChange={e => { setSystem(e.target.value as System); setLevel('all'); setDictionaryLessonId(''); setDictionaryPosFilter('') }}>
              <option value="3.0">{t('vocab.hsk30')}</option>
              <option value="2.0">{t('vocab.hsk20')}</option>
            </select>

            <label className="sr-only" htmlFor="level-filter">{t('vocab.level')}</label>
            <select id="level-filter" value={level} onChange={e => { setLevel(e.target.value); setDictionaryLessonId(''); setDictionaryPosFilter('') }}>
              <option value="all">{t('vocab.allLevels')}</option>
              {levelFilterOptions.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>

            <label className="sr-only" htmlFor="dictionary-lesson">{lang === 'ru' ? 'Тема и урок' : lang === 'uz' ? 'Mavzu va dars' : 'Topic and lesson'}</label>
            <select id="dictionary-lesson" value={dictionaryLessonId} onChange={e => setDictionaryLessonId(e.target.value)}>
              <option value="">{lang === 'ru' ? 'Все темы и уроки' : lang === 'uz' ? 'Barcha mavzular va darslar' : 'All topics and lessons'}</option>
              {dictionaryLessonOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>

            <label className="sr-only" htmlFor="dictionary-sort">{lang === 'ru' ? 'Сортировка' : lang === 'uz' ? 'Saralash' : 'Sort order'}</label>
            <select id="dictionary-sort" value={dictionarySort} onChange={e => setDictionarySort(e.target.value as typeof dictionarySort)}>
              <option value="hanzi">{lang === 'ru' ? 'По иероглифам' : lang === 'uz' ? 'Ieroglif bo‘yicha' : 'By characters'}</option>
              <option value="pinyin">{lang === 'ru' ? 'По пиньиню' : lang === 'uz' ? 'Pinyin bo‘yicha' : 'By pinyin'}</option>
              <option value="level">{lang === 'ru' ? 'По уровню HSK' : lang === 'uz' ? 'HSK darajasi bo‘yicha' : 'By HSK level'}</option>
              <option value="frequency">{lang === 'ru' ? 'По частоте' : lang === 'uz' ? 'Chastota bo‘yicha' : 'By frequency'}</option>
            </select>

            <label className="sr-only" htmlFor="dictionary-pos">{lang === 'ru' ? 'Часть речи' : lang === 'uz' ? 'So‘z turkumi' : 'Part of speech'}</label>
            <select id="dictionary-pos" value={dictionaryPosFilter} onChange={e => setDictionaryPosFilter(e.target.value)}>
              <option value="">{lang === 'ru' ? 'Все категории' : lang === 'uz' ? 'Barcha turkumlar' : 'All categories'}</option>
              {dictionaryPosOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>

            <button className={`outline favorites-filter ${favoritesOnly ? 'selected' : ''}`} type="button" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(value => !value)}>
              <Star size={15} fill={favoritesOnly ? 'currentColor' : 'none'}/>
              {favoritesOnly ? t('vocab.showAllWords') : t('vocab.favorites')}
              <span>{currentFavoriteCount.toLocaleString(lang)}</span>
            </button>

            <button className={`outline known-filter ${knownOnly ? 'selected' : ''}`} type="button" aria-pressed={knownOnly} onClick={() => setKnownOnly(value => !value)}>
              <CheckCircle2 size={15}/>
              {knownOnly ? (lang === 'ru' ? 'Все слова' : lang === 'uz' ? 'Barcha so‘zlar' : 'All words') : (lang === 'ru' ? 'Изученные' : lang === 'uz' ? 'O‘rganilgan' : 'Learned')}
              <span>{currentWords.filter(word => knownWords.includes(wordId(word))).length.toLocaleString(lang)}</span>
            </button>
          </div>

          {catalogLoading && <p className="notice-text">{t('vocab.loading')}</p>}

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
                    {vocabularyCollection === 'course'
                      ? `${t('vocab.courseStageShort')} ${word.courseStage}`
                      : dictionaryLevelLabel(word, system) ?? ''}
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

                {word.partOfSpeech && word.partOfSpeech.length > 0 && <div className="word-category-tags">
                  {word.partOfSpeech.map(category => <span className="word-category-tag" key={category}>{partOfSpeechLabel(category, lang)}</span>)}
                </div>}

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

      {section === 3 && (
        <section className="panel learning-page">
          <div className="panel-head">
            <div><span className="kicker">{t('flashcards.kicker')}</span><h2>{t('flashcards.title')}</h2></div>
            <span className="demo-tag">HSK {cardsSystem} · {cardsLevel} · {selectedCardsLesson?.title ?? ''}</span>
          </div>
          <p className="notice-text">{t('flashcards.notice')}</p>
          <div className="standard-switch personal-flashcards-tabs" role="tablist" aria-label={lang === 'ru' ? 'Режим карточек' : lang === 'uz' ? 'Kartochka rejimi' : 'Flashcard mode'}>
            <button type="button" role="tab" aria-selected={cardsMode === 'lesson'} className={cardsMode === 'lesson' ? 'selected' : ''} onClick={() => setCardsMode('lesson')}>{lang === 'ru' ? 'Карточки уроков' : lang === 'uz' ? 'Dars kartochkalari' : 'Lesson cards'}</button>
            <button type="button" role="tab" aria-selected={cardsMode === 'personal'} className={cardsMode === 'personal' ? 'selected' : ''} onClick={() => setCardsMode('personal')}>Personal Flash Cards</button>
          </div>
          {cardsMode === 'personal' ? <PersonalFlashCards locale={lang}/> : <>
          <div className="filters study-filters">
            <label>{lang === 'ru' ? 'Стандарт' : lang === 'uz' ? 'Standart' : 'Standard'}
              <select value={cardsSystem} onChange={event => { setCardsSystem(event.target.value as CourseSystem); setCardsLevel(1); setCardsLessonId(''); setCardIndex(0); setShowAnswer(false) }}>
                <option value="2.0">HSK 2.0</option><option value="3.0">HSK 3.0</option>
              </select>
            </label>
            <label>{lang === 'ru' ? 'Уровень' : lang === 'uz' ? 'Daraja' : 'Level'}
              <select value={cardsLevel} onChange={event => { setCardsLevel(Number(event.target.value) as CourseLevel); setCardsLessonId(''); setCardIndex(0); setShowAnswer(false) }}>
                {(cardsSystem === '2.0' ? [1,2,3,4,5,6] : [1,2,3,4,5,6,7,8,9]).map(value => <option key={value} value={value}>{cardsSystem === '3.0' && value >= 7 ? 'HSK 3.0 · ' + value + ' (7–9)' : 'HSK ' + cardsSystem + ' · ' + value}</option>)}
              </select>
            </label>
            <label>{lang === 'ru' ? 'Урок' : lang === 'uz' ? 'Dars' : 'Lesson'}
              <select value={selectedCardsLesson?.id ?? ''} onChange={event => { setCardsLessonId(event.target.value); setCardIndex(0); setShowAnswer(false) }}>
                {cardsLessons.map(lesson => <option key={lesson.id} value={lesson.id}>{(lang === 'ru' ? 'Урок ' : 'Lesson ') + lesson.volumeLesson + ' · ' + lesson.title}</option>)}
              </select>
            </label>
          </div>
          {activeCard ? <>
            <p className="notice-text">{cardStudyWords.length} {lang === 'ru' ? 'слов в этом уроке' : lang === 'uz' ? 'ta so‘z ushbu darsda' : 'words in this lesson'} · {lang === 'ru' ? 'изучено' : lang === 'uz' ? 'o‘rganilgan' : 'learned'}: {cardStudyWords.filter(word => knownWords.includes(wordId(word))).length} · {lang === 'ru' ? 'к повторению' : lang === 'uz' ? 'takrorlash kerak' : 'due'}: {dueReviewIds(reviewSchedule).filter(id => cardStudyWords.some(word => wordId(word) === id)).length} · {lang === 'ru' ? 'сложность' : lang === 'uz' ? 'daraja' : 'difficulty'}: {currentAdaptiveDifficulty}/3</p>
            <article className="study-card">
              <span className="study-hanzi">{activeCard.hanzi}</span>
              {showAnswer && <div className="study-answer"><b>{activeCard.pinyin}</b><span>{vocabularyMeaning(activeCard)}</span>{activeCard.example && <small>{activeCard.example} · {activeCard.examplePinyin}</small>}</div>}
            </article>
            <div className="study-actions">
              {!showAnswer && <button className="primary" onClick={() => setShowAnswer(true)}>{t('flashcards.showAnswer')}</button>}
              {showAnswer && <>
                <button className="outline" onClick={() => rateFlashcard(activeCard, 'again')}>{lang === 'ru' ? 'Снова · 10 мин' : lang === 'uz' ? 'Yana · 10 daq' : 'Again · 10 min'}</button>
                <button className="outline" onClick={() => rateFlashcard(activeCard, 'hard')}>{lang === 'ru' ? 'Трудно' : lang === 'uz' ? 'Qiyin' : 'Hard'}</button>
                <button className="primary" onClick={() => rateFlashcard(activeCard, 'good')}>{lang === 'ru' ? 'Хорошо' : lang === 'uz' ? 'Yaxshi' : 'Good'}</button>
                <button className="primary easy-review" onClick={() => rateFlashcard(activeCard, 'easy')}>{lang === 'ru' ? 'Легко' : lang === 'uz' ? 'Oson' : 'Easy'}</button>
              </>}
            </div>
            <div className="study-footer">
              <button className="outline" aria-label={t('flashcards.previous')} onClick={() => { setShowAnswer(false); setCardIndex(i => (i + cardStudyWords.length - 1) % cardStudyWords.length) }}>‹</button>
              <span>{t('flashcards.counter')} {cardIndex % cardStudyWords.length + 1} / {cardStudyWords.length} · {t('flashcards.knownCount')}: {cardStudyWords.filter(word => knownWords.includes(wordId(word))).length}</span>
              <button className="outline" aria-label={t('flashcards.next')} onClick={() => { setShowAnswer(false); setCardIndex(i => (i + 1) % cardStudyWords.length) }}>›</button>
            </div>
          </> : <div className="empty">{t('course.noWords')}</div>}
          </>}
        </section>
      )}
      {section === 4 && (
        <section className="panel learning-page">
          <div className="panel-head"><div><span className="kicker">{t('listening.kicker')}</span><h2>{t('listening.title')}</h2></div><span className="demo-tag">HSK {listeningSystem} · {listeningLevel} · {selectedListeningLesson?.title ?? ''}</span></div>
          <p className="notice-text">{t('listening.notice')}</p>
          <div className="filters study-filters">
            <label>{lang === 'ru' ? 'Стандарт' : lang === 'uz' ? 'Standart' : 'Standard'}
              <select value={listeningSystem} onChange={event => { setListeningSystem(event.target.value as CourseSystem); setListeningLevel(1); setListeningLessonId(''); setListeningIndex(0); setListeningChoice(null) }}>
                <option value="2.0">HSK 2.0</option><option value="3.0">HSK 3.0</option>
              </select>
            </label>
            <label>{lang === 'ru' ? 'Уровень' : lang === 'uz' ? 'Daraja' : 'Level'}
              <select value={listeningLevel} onChange={event => { setListeningLevel(Number(event.target.value) as CourseLevel); setListeningLessonId(''); setListeningIndex(0); setListeningChoice(null) }}>
                {(listeningSystem === '2.0' ? [1,2,3,4,5,6] : [1,2,3,4,5,6,7,8,9]).map(value => <option key={value} value={value}>{listeningSystem === '3.0' && value >= 7 ? 'HSK 3.0 · ' + value + ' (7–9)' : 'HSK ' + listeningSystem + ' · ' + value}</option>)}
              </select>
            </label>
            <label>{lang === 'ru' ? 'Урок' : lang === 'uz' ? 'Dars' : 'Lesson'}
              <select value={selectedListeningLesson?.id ?? ''} onChange={event => { setListeningLessonId(event.target.value); setListeningIndex(0); setListeningChoice(null) }}>
                {listeningLessons.map(lesson => <option key={lesson.id} value={lesson.id}>{(lang === 'ru' ? 'Урок ' : 'Lesson ') + lesson.volumeLesson + ' · ' + lesson.title}</option>)}
              </select>
            </label>
          </div>
          {listeningWord ? <>
            <p className="notice-text">{listeningStudyWords.length} {lang === 'ru' ? 'слов в этом уроке' : lang === 'uz' ? 'ta so‘z ushbu darsda' : 'words in this lesson'} · {lang === 'ru' ? 'верных ответов' : lang === 'uz' ? 'to‘g‘ri javoblar' : 'correct answers'}: {listeningCompletedIds.filter(id => listeningStudyWords.some(word => wordId(word) === id)).length}</p>
            <div className="practice-prompt"><p>{t('listening.prompt')}</p><button className="primary" onClick={() => speak(listeningWord.hanzi)}><Volume2 size={18}/>{t('listening.play')}</button></div>
            <div className="answer-options">
              {listeningOptions.map(option => {
                const selected = listeningChoice === option.hanzi
                const correct = option.hanzi === listeningWord.hanzi
                return <button key={wordId(option)} className={'answer-option ' + (listeningChoice && correct ? 'correct' : '') + ' ' + (selected && !correct ? 'incorrect' : '')} disabled={Boolean(listeningChoice)} onClick={() => {
                  setListeningChoice(option.hanzi)
                  if (correct) {
                    setListeningCompletedIds(items => items.includes(wordId(listeningWord)) ? items : [...items, wordId(listeningWord)])
                    recordActivity()
                  }
                }}><span>{option.hanzi}</span><small>{option.pinyin}</small></button>
              })}
            </div>
            {listeningChoice && <p className={'feedback ' + (listeningChoice === listeningWord.hanzi ? 'success' : 'error')}>{t(listeningChoice === listeningWord.hanzi ? 'listening.correct' : 'listening.incorrect')}</p>}
            <button className="primary" onClick={() => { setListeningIndex(i => (i + 1) % listeningStudyWords.length); setListeningChoice(null) }}>{t('listening.next')}<ChevronRight size={16}/></button>
          </> : <div className="empty">{t('course.noWords')}</div>}
        </section>
      )}
      {section === 5 && (
        <section className="panel learning-page">
          <div className="panel-head"><div><span className="kicker">{t('grammar.kicker')}</span><h2>{t('grammar.title')}</h2></div><span className="demo-tag">HSK {grammarSystem}</span></div>
          <p className="notice-text">{t('grammar.notice')}</p>
          <div className="standard-switch" role="group" aria-label={t('vocab.system')}>
            {(['2.0', '3.0'] as const).map(standard => <button key={standard} className={'outline ' + (grammarSystem === standard ? 'selected' : '')} onClick={() => { setGrammarSystem(standard); setGrammarLevel(1); setExpandedGrammarId(null) }}>HSK {standard}</button>)}
          </div>
          <div className="course-levels" role="group" aria-label={t('course.level')}>
            {(grammarSystem === '2.0' ? [1,2,3,4,5,6] : [1,2,3,4,5,6,7,8,9]).map(course => <button key={course} className={'course-level ' + (grammarLevel === course ? 'selected' : '')} onClick={() => { setGrammarLevel(course as CourseLevel); setExpandedGrammarId(null) }}><b>HSK {grammarSystem} · {course}</b><span>{expandedLessonData.lessons.filter(item => item.system === grammarSystem && item.level === course).length} {t('course.lessonCount')}</span></button>)}
          </div>
          {grammarSystem === '3.0' && grammarLevel >= 7 && <p className="notice-text shared-band-note">{t('course.sharedBandNote')}</p>}
          <div className="lesson-list">
            {grammarTopicsForLevel.map(({ id, lesson, topic, index }) => {
              const expanded = expandedGrammarId === id
              return <article className={'lesson-card grammar-lesson-card ' + (expanded ? 'expanded' : '')} key={id}>
                <span className="lesson-number">{String(lesson.volumeLesson).padStart(2, '0')}{index ? '.' + (index + 1) : ''}</span>
                <div>
                  <h3>{topic.grammar.title}</h3><p>{(lang === 'ru' ? 'Урок ' : 'Lesson ') + lesson.volumeLesson + ' · ' + lesson.title}</p><code>{topic.grammar.pattern}</code>
                  {expanded && <div className="grammar-detail"><p>{topic.grammar.explanation}</p><div className="lesson-example"><b>{topic.grammar.example}</b><span>{topic.grammar.pinyin}</span><small>{topic.grammar.meaning}</small></div></div>}
                </div>
                <button className="sound" aria-label={t('vocab.listen')} onClick={() => speak(topic.grammar.example)}><Volume2 size={18}/></button>
                <button className="outline grammar-open" aria-expanded={expanded} onClick={() => setExpandedGrammarId(expanded ? null : id)}>{expanded ? (lang === 'ru' ? 'Свернуть' : lang === 'uz' ? 'Yopish' : 'Collapse') : (lang === 'ru' ? 'Открыть тему' : lang === 'uz' ? 'Mavzuni ochish' : 'Open topic')}</button>
              </article>
            })}
          </div>
        </section>
      )}
      {section === 6 && (
        <section className="panel learning-page exam-page">
          <div className="panel-head"><div><span className="kicker">{t('exam.kicker')}</span><h2>{t('exam.title')}</h2></div><span className="demo-tag">HSK {examSystem}</span></div>
          <p className="notice-text">{t('exam.intro')}</p>
          <p className="notice-text exam-provenance-note">
            {examSystem === '3.0' && examLevel >= 7
              ? (lang === 'ru' ? 'Формат соответствует пяти разделам HSK 7–9. Автоматически оцениваются только объективные задания; письмо, перевод и устная речь требуют самостоятельной или преподавательской проверки. Официальный экзамен использует отдельные баллы по пяти навыкам и модель IRT.'
                : lang === 'uz' ? 'Format HSK 7–9 ning besh bo‘limiga mos. Faqat test savollari avtomatik baholanadi; yozish, tarjima va nutq mustaqil yoki o‘qituvchi tomonidan tekshiriladi. Rasmiy imtihon besh ko‘nikma bo‘yicha alohida IRT ballarini beradi.'
                  : 'The format follows the five HSK 7–9 sections. Only objective questions are auto-graded; writing, translation and speaking need self- or teacher review. The official test reports five skill scores using IRT.')
              : (lang === 'ru' ? 'Это тренировочная симуляция по структуре экзамена, а не официальный вариант прошлых лет. Открытые письменные задания могут требовать ручной проверки.'
                : lang === 'uz' ? 'Bu imtihon tuzilishiga asoslangan mashq simulyatsiyasi, rasmiy oldingi imtihon varianti emas. Ochiq yozma topshiriqlar qo‘lda tekshirilishi mumkin.'
                  : 'This is a practice simulation aligned to the test structure, not an official past paper. Open-ended writing tasks may require manual review.')}
            {' · '}<a href="https://www.chinesetest.cn/HSK" target="_blank" rel="noreferrer">{lang === 'ru' ? 'Официальная структура HSK' : lang === 'uz' ? 'HSK rasmiy tuzilishi' : 'Official HSK structure'}</a>
          </p>
          {examHistory.length > 0 && <section className="exam-history">
            <div className="section-heading">
              <h3>{lang === 'ru' ? 'История экзаменов' : lang === 'uz' ? 'Imtihonlar tarixi' : 'Exam history'}</h3>
              <span>{examHistory.length} {lang === 'ru' ? 'попыток' : lang === 'uz' ? 'urinish' : 'attempts'}</span>
            </div>
            {examHistory.slice(0, 5).map((attempt, index) => <div className="exam-history-row" key={`${attempt.date}-${attempt.system}-${attempt.level}-${index}`}>
              <span>HSK {attempt.system} · {attempt.system === '3.0' && attempt.level === 7 ? '7–9' : attempt.level}</span>
              <b>{attempt.score}/{attempt.total} · {attempt.total ? Math.round(attempt.score / attempt.total * 100) : 0}%</b>
              <small>
                {new Date(attempt.date).toLocaleDateString(lang)}
                {attempt.durationSeconds != null && ` · ${formatExamTime(attempt.durationSeconds)}`}
                {attempt.manualTotal ? ` · ${attempt.manualAnswered ?? 0}/${attempt.manualTotal} ${lang === 'ru' ? 'ручных' : lang === 'uz' ? 'qo‘lda' : 'manual'}` : ''}
              </small>
            </div>)}
          </section>}

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
            <button className="primary exam-start" onClick={startExam} disabled={catalogLoading || (!reviewWords?.length && !databaseWords?.length)}>
              {catalogLoading ? (lang === 'ru' ? 'Загружаем словарь…' : lang === 'uz' ? 'Lug‘at yuklanmoqda…' : 'Loading vocabulary…') : t('exam.start')}
              <ChevronRight size={17}/>
            </button>
          </>}

          {examStarted && examFinished && <div className="exam-result">
            <div className="review-icon"><CheckCircle2/></div>
            <span className="kicker">{examSystem === '3.0' && examLevel >= 7 ? 'HSK 3.0 · 7–9' : `HSK ${examSystem} · ${examLevel}`} · {t('exam.result')}</span>
            <strong>{examCorrectCount} / {examScoredCount}</strong>
            {examSystem === '3.0' && examLevel >= 7
              ? <p className="notice-text">{lang === 'ru' ? 'Результат автоматической части. Это не официальный балл HSK 7–9.' : lang === 'uz' ? 'Avtomatik baholangan qism natijasi. Bu rasmiy HSK 7–9 bali emas.' : 'Auto-graded practice result. This is not an official HSK 7–9 score.'}</p>
              : <p>{examCorrectCount >= Math.ceil(examScoredCount * .6) ? t('exam.pass') : t('exam.notPass')} · {lang === 'ru' ? 'ориентир 60% по автоматически оцениваемым заданиям' : lang === 'uz' ? 'avtomatik baholanadigan savollarda 60% mezon' : '60% practice benchmark on auto-graded questions'}</p>}
            <p className="exam-time-used">{lang === 'ru' ? 'Время' : lang === 'uz' ? 'Sarflangan vaqt' : 'Time used'} · {formatExamTime(examElapsedSeconds)}</p>
            {examManualTotal > 0 && <p className="notice-text">{examManualCount} / {examManualTotal} · {t('exam.manualTasks')}</p>}
            <section className="exam-section-results" aria-label={lang === 'ru' ? 'Результаты по разделам' : lang === 'uz' ? 'Bo‘limlar bo‘yicha natijalar' : 'Section results'}>
              {examSectionStats.map(stat => <div className="exam-section-result" key={stat.section}>
                <span>{t(`exam.${stat.section}` as TranslationKey)}</span>
                <b>{stat.scored > 0 ? `${stat.correct}/${stat.scored}` : `${stat.manualAnswered}/${stat.manual}`}</b>
                {stat.manual > 0 && <small>{lang === 'ru' ? 'ручная проверка' : lang === 'uz' ? 'qo‘lda tekshirish' : 'manual review'}</small>}
              </div>)}
            </section>
            <section className="exam-answer-review">
              <h3>{lang === 'ru' ? 'Разбор ответов' : lang === 'uz' ? 'Javoblar tahlili' : 'Answer review'}</h3>
              {examQuestionsState.map((question, index) => {
                const response = examAnswers[index] ?? ''
                const correct = !question.manualReview && (
                  question.section === 'writing'
                    ? normalizeWrittenAnswer(response) === normalizeWrittenAnswer(question.answer)
                    : response === question.answer
                )
                return <article className={`exam-review-row ${question.manualReview ? 'manual' : correct ? 'correct' : 'incorrect'}`} key={`${question.section}-${question.part}-${index}`}>
                  <div className="exam-review-title">
                    <b>{index + 1}. {t(`exam.${question.section}` as TranslationKey)}</b>
                    <span>{question.manualReview
                      ? (lang === 'ru' ? 'Проверка вручную' : lang === 'uz' ? 'Qo‘lda tekshiriladi' : 'Manual review')
                      : correct
                        ? (lang === 'ru' ? 'Верно' : lang === 'uz' ? 'To‘g‘ri' : 'Correct')
                        : (lang === 'ru' ? 'Ошибка' : lang === 'uz' ? 'Xato' : 'Incorrect')}</span>
                  </div>
                  <p>{question.prompt}</p>
                  <small>{lang === 'ru' ? 'Твой ответ' : lang === 'uz' ? 'Sizning javobingiz' : 'Your answer'}: {response || '—'}</small>
                  {!question.manualReview && !correct && <small>{lang === 'ru' ? 'Правильный ответ' : lang === 'uz' ? 'To‘g‘ri javob' : 'Correct answer'}: {question.answer}</small>}
                  {question.explanation && <small className="exam-explanation">{question.explanation}</small>}
                </article>
              })}
            </section>
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
                  return <button key={`${option}-${index}`} className={`answer-option ${selected ? 'selected' : ''}`} disabled={answered} onClick={() => selectExamAnswer(option)}><span>{option}</span></button>
                })}
              </div>}
              {selectedExamQuestion.section === 'listening' && examAnswers[examIndex] && <p className="exam-reveal">{selectedExamQuestion.audio} · {selectedExamQuestion.pinyin}</p>}
            </div>
            <div className="study-footer"><span>{examCorrectCount} {t('exam.correct')}</span><button className="primary" onClick={moveExamForward}>{examIndex + 1 === examQuestionsState.length ? t('exam.finish') : t('exam.next')}<ChevronRight size={16}/></button></div>
          </div>}
        </section>
      )}

      {section === 7 && (
        <section className="panel settings-page profile-page">
          <div className="profile-page-heading">
            <div className="review-icon"><Settings/></div>
            <span className="kicker">HANZIPATH · 汉字之路</span>
            <h2>{t('profile.settings')}</h2>
            <p>{lang === 'ru' ? 'Твой прогресс, цели и настройки обучения.' : lang === 'uz' ? 'O‘qish jarayoni, maqsadlar va sozlamalaringiz.' : 'Your learning progress, goals and account settings.'}</p>
          </div>

          <section className="profile-account-card">
            <div className="profile-account-copy">
              <span className="kicker">{lang === 'ru' ? 'АККАУНТ' : lang === 'uz' ? 'HISOB' : 'ACCOUNT'}</span>
              <h3>{authUser?.email ?? (lang === 'ru' ? 'Гостевой режим' : lang === 'uz' ? 'Mehmon rejimi' : 'Guest mode')}</h3>
              <p>{authUser
                ? progressSyncReadyFor === authUser.id
                  ? (lang === 'ru' ? 'Облачная синхронизация активна' : lang === 'uz' ? 'Bulutli sinxronlash faol' : 'Cloud sync is active')
                  : (lang === 'ru' ? 'Синхронизируем прогресс…' : lang === 'uz' ? 'Jarayon sinxronlanmoqda…' : 'Syncing your progress…')
                : (lang === 'ru' ? 'Прогресс пока хранится на этом устройстве' : lang === 'uz' ? 'Jarayon hozircha shu qurilmada saqlanadi' : 'Progress is currently stored on this device')}</p>
            </div>
            {authUser
              ? <button className="outline profile-account-action" type="button" onClick={async () => {
                  if (!supabase) return
                  const { error } = await supabase.auth.signOut()
                  if (error) setNotice({ text: error.message, kind: 'error' })
                  else setNotice({ text: lang === 'ru' ? 'Вы вышли из аккаунта. Локальный прогресс сохранён.' : lang === 'uz' ? 'Hisobdan chiqdingiz. Mahalliy jarayon saqlandi.' : 'Signed out. Your local progress is preserved.', kind: 'success' })
                }}>
                  {lang === 'ru' ? 'Выйти' : lang === 'uz' ? 'Chiqish' : 'Sign out'}
                </button>
              : <div className="profile-account-actions">
                  <button className="primary" type="button" disabled={!supabase} onClick={() => { setAuthMode('signin'); setAuthOpen(true) }}>{lang === 'ru' ? 'Войти' : lang === 'uz' ? 'Kirish' : 'Sign in'}</button>
                  <button className="outline" type="button" disabled={!supabase} onClick={() => { setAuthMode('signup'); setAuthOpen(true) }}>{lang === 'ru' ? 'Создать аккаунт' : lang === 'uz' ? 'Hisob yaratish' : 'Create account'}</button>
                </div>}
          </section>

          <section className="profile-stats-grid" aria-label={lang === 'ru' ? 'Статистика обучения' : lang === 'uz' ? 'O‘qish statistikasi' : 'Learning statistics'}>
            <article className="profile-stat-card"><span>{lang === 'ru' ? 'Изучено слов' : lang === 'uz' ? 'O‘rganilgan so‘zlar' : 'Learned words'}</span><strong>{profileKnownCount.toLocaleString(lang)}</strong></article>
            <article className="profile-stat-card"><span>{lang === 'ru' ? 'Избранное' : lang === 'uz' ? 'Sevimlilar' : 'Favorites'}</span><strong>{profileFavoriteCount.toLocaleString(lang)}</strong></article>
            <article className="profile-stat-card"><span>{lang === 'ru' ? 'Завершено уроков' : lang === 'uz' ? 'Tugatilgan darslar' : 'Completed lessons'}</span><strong>{completedLessonIds.length.toLocaleString(lang)}</strong></article>
            <article className="profile-stat-card"><span>{lang === 'ru' ? 'Серия занятий' : lang === 'uz' ? 'Ketma-ket kunlar' : 'Current streak'}</span><strong>{getStreak(activityDays)} <small>{lang === 'ru' ? 'дн.' : lang === 'uz' ? 'kun' : 'days'}</small></strong></article>
            <article className="profile-stat-card"><span>{lang === 'ru' ? 'Дней с занятиями' : lang === 'uz' ? 'Faol kunlar' : 'Study days'}</span><strong>{activityDays.length.toLocaleString(lang)}</strong></article>
            <article className="profile-stat-card"><span>{lang === 'ru' ? 'Повторений сегодня' : lang === 'uz' ? 'Bugungi takrorlashlar' : 'Reviews today'}</span><strong>{dailyReviewCount.count.toLocaleString(lang)}</strong></article>
            <article className="profile-stat-card"><span>{lang === 'ru' ? 'Экзамены' : lang === 'uz' ? 'Imtihonlar' : 'Exam attempts'}</span><strong>{examHistory.length.toLocaleString(lang)}<small>{examHistory.length ? ` · ${profileExamAverage}%` : ''}</small></strong></article>
            <article className="profile-stat-card"><span>{lang === 'ru' ? 'Карточки к повторению' : lang === 'uz' ? 'Takrorlash kartalari' : 'Cards due'}</span><strong>{profileDueReviews.toLocaleString(lang)}</strong></article>
          </section>

          <section className="profile-goal-card">
            <div className="profile-section-heading">
              <div><span className="kicker">{lang === 'ru' ? 'КАЖДЫЙ ДЕНЬ' : lang === 'uz' ? 'HAR KUNI' : 'DAILY ROUTINE'}</span><h3>{lang === 'ru' ? 'Ежедневная цель' : lang === 'uz' ? 'Kunlik maqsad' : 'Daily goal'}</h3></div>
              <label className="profile-goal-select">
                <span className="sr-only">{lang === 'ru' ? 'Цель повторений в день' : lang === 'uz' ? 'Kunlik takrorlash maqsadi' : 'Daily review goal'}</span>
                <select value={dailyGoalWords} onChange={event => setDailyGoalWords(Number(event.target.value))}>
                  {[5, 10, 15, 20, 30, 50].map(value => <option key={value} value={value}>{value} {lang === 'ru' ? 'слов' : lang === 'uz' ? 'so‘z' : 'words'}</option>)}
                </select>
              </label>
            </div>
            <div className="profile-goal-progress"><i style={{ width: `${Math.min(100, dailyReviewCount.count / Math.max(1, dailyGoalWords) * 100)}%` }}/></div>
            <p>{dailyReviewCount.count.toLocaleString(lang)} / {dailyGoalWords.toLocaleString(lang)} · {lang === 'ru' ? 'повторений сегодня' : lang === 'uz' ? 'bugungi takrorlashlar' : 'reviews today'}</p>
            <small>{lang === 'ru' ? 'Цель относится к повторению карточек, а не только к новым словам.' : lang === 'uz' ? 'Maqsad faqat yangi so‘zlarga emas, kartochkalarni takrorlashga ham tegishli.' : 'This goal tracks flashcard reviews, not only newly learned words.'}</small>
          </section>

          <section className="profile-sync-card">
            <div className="profile-section-heading"><div><span className="kicker">{lang === 'ru' ? 'СОХРАНЕНИЕ' : lang === 'uz' ? 'SAQLASH' : 'BACKUP'}</span><h3>{lang === 'ru' ? 'Синхронизация прогресса' : lang === 'uz' ? 'Jarayonni sinxronlash' : 'Progress sync'}</h3></div>
              <span className={`profile-sync-status ${authUser && progressSyncReadyFor === authUser.id ? 'ready' : ''}`}>{authUser
                ? progressSyncReadyFor === authUser.id
                  ? (lang === 'ru' ? 'Синхронизировано' : lang === 'uz' ? 'Sinxronlangan' : 'Synced')
                  : (lang === 'ru' ? 'Синхронизация…' : lang === 'uz' ? 'Sinxronlanmoqda…' : 'Syncing…')
                : (lang === 'ru' ? 'Только устройство' : lang === 'uz' ? 'Faqat qurilma' : 'Device only')}</span>
            </div>
            <p>{lang === 'ru'
              ? 'После входа в один и тот же аккаунт на другом устройстве будут доступны изученные слова, избранное, интервалы повторения, ежедневная цель, серия занятий, завершённые уроки и история экзаменов.'
              : lang === 'uz'
                ? 'Boshqa qurilmada shu hisobga kirganingizda o‘rganilgan so‘zlar, sevimlilar, takrorlash oralig‘i, kunlik maqsad, ketma-ket kunlar, tugatilgan darslar va imtihonlar tarixi sinxronlanadi.'
                : 'Sign in with the same account on another device to sync learned words, favorites, review intervals, daily goal, streak, completed lessons and exam history.'}</p>
          </section>

          {examHistory.length > 0 && <section className="profile-exam-history">
            <div className="profile-section-heading"><div><span className="kicker">{lang === 'ru' ? 'ПРАКТИКА' : lang === 'uz' ? 'MASHQ' : 'PRACTICE'}</span><h3>{lang === 'ru' ? 'Последние экзамены' : lang === 'uz' ? 'So‘nggi imtihonlar' : 'Recent exams'}</h3></div><span>{profileExamAverage}% {lang === 'ru' ? 'средний результат' : lang === 'uz' ? 'o‘rtacha natija' : 'average auto-score'}</span></div>
            {examHistory.slice(0, 5).map((attempt, index) => <div className="exam-history-row" key={`profile-${attempt.date}-${index}`}>
              <span>HSK {attempt.system} · {attempt.system === '3.0' && attempt.level === 7 ? '7–9' : attempt.level}</span>
              <b>{attempt.score}/{attempt.total} · {attempt.total ? Math.round(attempt.score / attempt.total * 100) : 0}%</b>
              <small>{new Date(attempt.date).toLocaleDateString(lang)}{attempt.durationSeconds != null ? ` · ${formatExamTime(attempt.durationSeconds)}` : ''}</small>
            </div>)}
          </section>}

          <section className="profile-preferences">
            <div className="profile-section-heading"><div><span className="kicker">{lang === 'ru' ? 'НАСТРОЙКИ' : lang === 'uz' ? 'SOZLAMALAR' : 'PREFERENCES'}</span><h3>{lang === 'ru' ? 'Язык интерфейса' : lang === 'uz' ? 'Interfeys tili' : 'Interface language'}</h3></div></div>
            <label className="setting-row">
              <span>{t('language.label')}</span>
              <select value={lang} onChange={event => void changeLanguage(event.target.value as Locale)}>
                {(['ru', 'en', 'uz'] as const).map(locale => (
                  <option key={locale} value={locale}>{t(`language.${locale}` as TranslationKey)}</option>
                ))}
              </select>
            </label>
            <p>{supabase ? t('profile.languageSaved') : t('profile.languageLocal')}</p>
          </section>
        </section>
      )}

      {authOpen && <div className="auth-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) { setAuthOpen(false); setAuthFeedback(null) } }}>
        <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
          <button className="auth-close" type="button" aria-label="Close" onClick={() => { setAuthOpen(false); setAuthFeedback(null) }}>×</button>
          <span className="kicker">HANZIPATH · 汉字之路</span>
          <h2 id="auth-title">{authMode === 'signup' ? (lang === 'ru' ? 'Создать аккаунт' : 'Create account') : authMode === 'reset' ? (lang === 'ru' ? 'Сбросить пароль' : 'Reset password') : (lang === 'ru' ? 'Войти в аккаунт' : 'Sign in')}</h2>
          {authFeedback && <p className={`auth-feedback ${authFeedback.kind}`} role="status">{authFeedback.text}</p>}
          <form onSubmit={submitAuth}>
            <label>{lang === 'ru' ? 'Электронная почта' : 'Email'}<input type="email" autoComplete="email" required value={authEmail} onChange={event => setAuthEmail(event.target.value)} placeholder="name@example.com"/></label>
            {authMode !== 'reset' && <label>{lang === 'ru' ? 'Пароль (минимум 6 символов)' : 'Password (at least 8 characters)'}<input type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} minLength={6} required value={authPassword} onChange={event => setAuthPassword(event.target.value)} placeholder="••••••••"/></label>}
            <button className="primary auth-submit" disabled={authBusy} type="submit">{authBusy ? (lang === 'ru' ? 'Подождите…' : 'Please wait…') : authMode === 'signup' ? (lang === 'ru' ? 'Зарегистрироваться' : 'Create account') : authMode === 'reset' ? (lang === 'ru' ? 'Отправить ссылку' : 'Send reset link') : (lang === 'ru' ? 'Войти' : 'Sign in')}</button>
          </form>
          <div className="auth-switches">
            {authMode !== 'signin' && <button type="button" onClick={() => { setAuthMode('signin'); setAuthFeedback(null); setAuthPassword('') }}>{lang === 'ru' ? 'Уже есть аккаунт? Войти' : 'Already have an account? Sign in'}</button>}
            {authMode !== 'signup' && <button type="button" onClick={() => { setAuthMode('signup'); setAuthFeedback(null); setAuthPassword('') }}>{lang === 'ru' ? 'Создать аккаунт' : 'Create an account'}</button>}
            {authMode === 'signin' && <button type="button" onClick={() => { setAuthMode('reset'); setAuthFeedback(null); setAuthPassword('') }}>{lang === 'ru' ? 'Забыли пароль?' : 'Forgot password?'}</button>}
          </div>
          {!supabase && <p className="auth-error">{lang === 'ru' ? 'Подключение Supabase не настроено.' : 'Supabase is not configured.'}</p>}
        </section>
      </div>}

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
            {selectedDictionaryWord.partOfSpeech && selectedDictionaryWord.partOfSpeech.length > 0 && <span>{selectedDictionaryWord.partOfSpeech.map(value => partOfSpeechLabel(value, lang)).join(' · ')}</span>}
            {selectedDictionaryWord.membershipStatus && <small>{selectedDictionaryWord.membershipStatus === 'source_verified'
              ? (lang === 'ru' ? 'Уровень подтверждён источником' : lang === 'uz' ? 'Daraja manba bilan tasdiqlangan' : 'Level verified against source')
              : t('vocab.membershipUnverified')}</small>}
          </div>

          <button className={`outline dictionary-known-action ${knownWords.includes(wordId(selectedDictionaryWord)) ? 'selected' : ''}`} type="button" onClick={() => toggleKnownWord(selectedDictionaryWord)}>
            <CheckCircle2 size={16}/>
            {knownWords.includes(wordId(selectedDictionaryWord))
              ? (lang === 'ru' ? 'Убрать из изученных' : lang === 'uz' ? 'O‘rganilganlardan olib tashlash' : 'Mark as not learned')
              : (lang === 'ru' ? 'Отметить как изученное' : lang === 'uz' ? 'O‘rganilgan deb belgilash' : 'Mark as learned')}
          </button>

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
                <p>{(lang !== 'en' && !selectedDictionaryWord.exampleRu && !selectedDictionaryWord.exampleUzVerified && selectedDictionaryWord.exampleEn ? 'EN · ' : '')}{exampleMeaning(selectedDictionaryWord) || t('vocab.exampleUnavailable')}</p>
                {selectedDictionaryWord.exampleSource && <small>{selectedDictionaryWord.exampleSource} · {selectedDictionaryWord.exampleLicense || 'CC BY-SA 4.0'} · {lang === 'ru' ? 'пример из источника, без индивидуальной проверки' : lang === 'uz' ? 'manba namunasi, alohida tekshirilmagan' : 'source example, not individually reviewed'}</small>}
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
