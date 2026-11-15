import { useMemo, useState } from 'react'

type PracticeWord = { hanzi: string; pinyin: string; ru: string; en: string; uz?: string | null }
type Grammar = { title: string; pattern: string; example: string; pinyin: string; meaning: string }
type Props = { lessonId: string; grammar: Grammar; words: PracticeWord[]; locale: 'ru' | 'en' | 'uz' }

export default function LessonPractice({ lessonId, grammar, words, locale }: Props) {
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [checked, setChecked] = useState(false)
  const copy = {
    ru: { kicker: '08 · ПРАКТИКА', title: 'Проверь, как ты понял урок', hint: 'Ответь на три вопроса. После проверки увидишь результат и пояснения.', q1: 'Что означает грамматический пример?', q2: 'Как переводится это слово?', q3: 'Какая формула соответствует теме?', check: 'Проверить ответы', retry: 'Пройти ещё раз', score: 'Твой результат', correct: 'Верно', wrong: 'Пока неверно', choose: 'Выбери один ответ', noWords: 'Словарь этого урока пока не содержит слов для дополнительного вопроса.' },
    en: { kicker: '08 · PRACTICE', title: 'Check your understanding', hint: 'Answer three questions. Check your answers to see your score and explanations.', q1: 'What does the grammar example mean?', q2: 'What does this word mean?', q3: 'Which pattern matches this lesson?', check: 'Check answers', retry: 'Try again', score: 'Your score', correct: 'Correct', wrong: 'Not quite', choose: 'Choose one answer', noWords: 'This lesson has no vocabulary item for an extra question yet.' },
    uz: { kicker: '08 · MASHQ', title: 'Mavzuni tushunganingizni tekshiring', hint: 'Uchta savolga javob bering. Tekshirgandan so‘ng natija va izohlarni ko‘rasiz.', q1: 'Grammatik misol nimani anglatadi?', q2: 'Bu so‘z qanday tarjima qilinadi?', q3: 'Qaysi formula ushbu mavzuga mos?', check: 'Javoblarni tekshirish', retry: 'Qayta ishlash', score: 'Natijangiz', correct: 'To‘g‘ri', wrong: 'Hozircha noto‘g‘ri', choose: 'Bitta javobni tanlang', noWords: 'Qo‘shimcha savol uchun bu dars lug‘atida so‘z yo‘q.' },
  }[locale]
  const questions = useMemo(() => {
    const unique = (items: string[]) => [...new Set(items.filter(Boolean))]
    const meaningChoices = unique([grammar.meaning, ...words.map(word => locale === 'ru' ? word.ru : locale === 'uz' ? (word.uz || word.en) : word.en).filter(value => value !== grammar.meaning)]).slice(0, 4)
    const word = words[0]
    const wordMeaning = word ? (locale === 'ru' ? word.ru : locale === 'uz' ? (word.uz || word.en) : word.en) : ''
    const wordChoices = word ? unique([wordMeaning, ...words.slice(1).map(item => locale === 'ru' ? item.ru : locale === 'uz' ? (item.uz || item.en) : item.en)]).slice(0, 4) : []
    const patternChoices = unique([grammar.pattern, '主语 + 动词 + 宾语', '主语 + 在 + 地点 + 动词', '主语 + 不 + 动词']).slice(0, 4)
    const make = (prompt: string, choices: string[], answer: string) => {
      const shuffled = [...choices].sort((a, b) => (a + lessonId).localeCompare(b + lessonId))
      return { prompt, choices: shuffled, correct: shuffled.indexOf(answer), explanation: answer }
    }
    return [
      make(copy.q1, meaningChoices, grammar.meaning),
      ...(word ? [make(copy.q2 + ' · ' + word.hanzi + ' (' + word.pinyin + ')', wordChoices, wordMeaning)] : []),
      make(copy.q3, patternChoices, grammar.pattern),
    ]
  }, [lessonId, grammar, words, locale, copy.q1, copy.q2, copy.q3])
  const total = questions.length
  const score = questions.filter((question, index) => answers[index] === question.correct).length
  const allAnswered = Object.keys(answers).length === total
  return <section className="course-block lesson-practice">
    <span className="kicker">{copy.kicker}</span>
    <h3>{copy.title}</h3>
    <p>{copy.hint}</p>
    {questions.map((question, index) => <div className="practice-question" key={question.prompt}>
      <b>{index + 1}. {question.prompt}</b>
      <div className="answer-options">
        {question.choices.map((choice, option) => <button type="button" key={choice} disabled={checked} className={`answer-option ${checked && option === question.correct ? 'correct' : ''} ${checked && answers[index] === option && option !== question.correct ? 'incorrect' : ''} ${!checked && answers[index] === option ? 'selected' : ''}`} onClick={() => setAnswers(current => ({ ...current, [index]: option }))}>
          <span>{choice}</span>
        </button>)}
      </div>
      {checked && <p className={`feedback ${answers[index] === question.correct ? 'success' : 'error'}`}>{answers[index] === question.correct ? copy.correct : copy.wrong} — {question.explanation}</p>}
    </div>)}
    {checked ? <div className="practice-result"><b>{copy.score}: {score}/{total}</b><button className="outline" type="button" onClick={() => { setAnswers({}); setChecked(false) }}>{copy.retry}</button></div>
      : <button className="primary" type="button" disabled={!allAnswered} onClick={() => setChecked(true)}>{copy.check}</button>}
  </section>
}
