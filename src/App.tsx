import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Headphones, Layers, Target, ChartNoAxesColumnIncreasing, Languages, Search, Volume2, ChevronRight, Flame, Menu, X, GraduationCap, CheckCircle2, LockKeyhole, Settings } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './supabase'
import { GUEST_LOCALE_KEY, isLocale, localeLabels, translate, type Locale, type TranslationKey } from './i18n'

type System = '2.0' | '3.0'
type Word = { hanzi: string; pinyin: string; ru: string; en: string; level20: number; level30: number; example: string; examplePinyin: string; exampleRu: string }
type Notice = { text: string; kind: 'success' | 'error' | 'info' }

// The demo set is retained as-is. Uzbek vocabulary glosses are intentionally not fabricated.
const words: Word[] = [
  {hanzi:'你好',pinyin:'nǐ hǎo',ru:'привет',en:'hello',level20:1,level30:1,example:'你好！',examplePinyin:'nǐ hǎo!',exampleRu:'Привет!'},
  {hanzi:'谢谢',pinyin:'xièxie',ru:'спасибо',en:'thank you',level20:1,level30:1,example:'谢谢你。',examplePinyin:'xièxie nǐ.',exampleRu:'Спасибо тебе.'},
  {hanzi:'学生',pinyin:'xuésheng',ru:'студент; ученик',en:'student',level20:1,level30:1,example:'我是学生。',examplePinyin:'wǒ shì xuésheng.',exampleRu:'Я студент.'},
  {hanzi:'学校',pinyin:'xuéxiào',ru:'школа; учебное заведение',en:'school',level20:1,level30:2,example:'我在学校学习。',examplePinyin:'wǒ zài xuéxiào xuéxí.',exampleRu:'Я учусь в школе.'},
  {hanzi:'朋友',pinyin:'péngyou',ru:'друг',en:'friend',level20:2,level30:2,example:'他是我的朋友。',examplePinyin:'tā shì wǒ de péngyou.',exampleRu:'Он мой друг.'},
  {hanzi:'因为',pinyin:'yīnwèi',ru:'потому что',en:'because',level20:2,level30:3,example:'因为下雨，我不去。',examplePinyin:'yīnwèi xiàyǔ, wǒ bú qù.',exampleRu:'Из-за дождя я не пойду.'},
  {hanzi:'如果',pinyin:'rúguǒ',ru:'если',en:'if',level20:4,level30:4,example:'如果有时间，我去。',examplePinyin:'rúguǒ yǒu shíjiān, wǒ qù.',exampleRu:'Если будет время, я пойду.'},
  {hanzi:'提高',pinyin:'tígāo',ru:'повышать; улучшать',en:'to improve',level20:4,level30:5,example:'我想提高汉语水平。',examplePinyin:'wǒ xiǎng tígāo hànyǔ shuǐpíng.',exampleRu:'Я хочу повысить уровень китайского.'},
]

const navKeys: TranslationKey[] = ['nav.home', 'nav.vocabulary', 'nav.flashcards', 'nav.listening', 'nav.grammar', 'nav.tests']
const pageKeys: TranslationKey[] = ['page.flashcards', 'page.listening', 'page.grammar', 'page.tests', 'page.profile']
const navIcons = [<Target key="home"/>, <BookOpen key="vocabulary"/>, <Layers key="cards"/>, <Headphones key="listen"/>, <GraduationCap key="grammar"/>, <CheckCircle2 key="tests"/>]

function initialLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(GUEST_LOCALE_KEY)
    if (isLocale(stored)) return stored
  } catch { /* Storage can be disabled; use the default locale. */ }
  return 'ru'
}

export default function App() {
  const [lang, setLang] = useState<Locale>(initialLocale)
  const [system, setSystem] = useState<System>('3.0')
  const [section, setSection] = useState(0)
  const [level, setLevel] = useState('all')
  const [query, setQuery] = useState('')
  const [menu, setMenu] = useState(false)
  const [done, setDone] = useState([false, false, false])
  const [notice, setNotice] = useState<Notice | null>(null)
  const t = (key: TranslationKey) => translate(lang, key)

  useEffect(() => {
    document.documentElement.lang = lang === 'uz' ? 'uz-Latn' : lang
  }, [lang])

  // A signed-in user's profile preference takes precedence over the guest device setting.
  useEffect(() => {
    let cancelled = false
    const loadProfileLocale = async () => {
      if (!supabase) return
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) return
        const { data } = await supabase.from('user_preferences').select('language').eq('user_id', user.id).maybeSingle()
        if (!cancelled && data && isLocale(data.language)) {
          setLang(data.language)
          try { window.localStorage.setItem(GUEST_LOCALE_KEY, data.language) } catch { /* Profile remains authoritative. */ }
        }
      } catch { /* Keep the locally persisted preference if the profile is unavailable. */ }
    }
    void loadProfileLocale()
    return () => { cancelled = true }
  }, [])

  const changeLanguage = async (next: Locale) => {
    setLang(next)
    try { window.localStorage.setItem(GUEST_LOCALE_KEY, next) } catch { /* UI preference still changes for this session. */ }
    setNotice({ text: t('profile.languageLocal'), kind: 'success' })
    if (!supabase) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase.from('user_preferences').upsert({ user_id: user.id, language: next }, { onConflict: 'user_id' })
      if (error) throw error
      setNotice({ text: translate(next, 'profile.languageSaved'), kind: 'success' })
    } catch {
      setNotice({ text: translate(next, 'profile.languageSaveError'), kind: 'error' })
    }
  }

  const filtered = useMemo(() => words.filter(w =>
    (level === 'all' || String(system === '2.0' ? w.level20 : w.level30) === level) &&
    (`${w.hanzi} ${w.pinyin} ${w.ru} ${w.en}`).toLocaleLowerCase().includes(query.toLocaleLowerCase())
  ), [level, query, system])

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'zh-CN'
      window.speechSynthesis.speak(utterance)
    }
  }

  const levels = system === '2.0' ? ['150','300','600','1200','2500','5000'] : ['300','500','1000','2000','3600','5400','11000']
  const levelNames = system === '2.0' ? ['HSK 1','HSK 2','HSK 3','HSK 4','HSK 5','HSK 6'] : ['HSK 1','HSK 2','HSK 3','HSK 4','HSK 5','HSK 6','HSK 7–9']
  const activeSectionName = section < 6 ? t(navKeys[section]) : t('page.profile')
  const vocabularyMeaning = (word: Word) => lang === 'ru' ? word.ru : lang === 'en' ? word.en : t('vocab.translationUnavailable')
  const exampleMeaning = (word: Word) => lang === 'ru' ? word.exampleRu : t('vocab.exampleUnavailable')

  return <div className="app">
    <aside className={`sidebar ${menu ? 'show' : ''}`} aria-label={t('nav.group')}>
      <div className="brand"><div className="brandmark" aria-hidden="true">汉</div><div><b>HanziPath</b><small>汉字之路</small></div><button className="mobile-close" aria-label={t('common.closeMenu')} onClick={() => setMenu(false)}><X/></button></div>
      <div className="side-label">{t('nav.group')}</div>
      {navKeys.map((key, i) => <button key={key} className={`navitem ${section === i ? 'active' : ''}`} onClick={() => { setSection(i); setMenu(false) }}>{navIcons[i]}<span>{t(key)}</span>{i === 1 && <span className="navcount">{filtered.length}</span>}</button>)}
      <div className="side-bottom">
        <div className="streak"><Flame/><div><b>3 {lang === 'ru' ? 'дня' : lang === 'uz' ? 'kun' : 'days'}</b><small>{t('dashboard.streak')}</small></div></div>
        <button className={`navitem profile-link ${section === 6 ? 'active' : ''}`} onClick={() => { setSection(6); setMenu(false) }}><Settings/><span>{t('profile.settings')}</span></button>
        <div className="profile"><div className="avatar">H</div><div className="profile-name"><b>{t('profile.guest')}</b><small>{t('profile.settings')}</small></div><button className="profile-action" title={t('profile.signIn')} aria-label={t('profile.signIn')}><LockKeyhole size={17}/></button></div>
      </div>
    </aside>
    {menu && <button className="scrim" aria-label={t('common.closeMenu')} onClick={() => setMenu(false)}/>}
    <main className="main">
      <header className="topbar">
        <button className="hamb" aria-label={t('common.openMenu')} onClick={() => setMenu(true)}><Menu/></button>
        <div className="crumb">HanziPath <span>/</span> {activeSectionName}</div>
        <div className="top-actions">
          <label className="language-select"><Languages size={17}/><span className="sr-only">{t('language.label')}</span><select aria-label={t('language.label')} value={lang} onChange={e => void changeLanguage(e.target.value as Locale)}>{(['ru','en','uz'] as const).map(locale => <option key={locale} value={locale}>{localeLabels[locale]}</option>)}</select></label>
          <button className="signin"><LockKeyhole size={16}/><span>{t('profile.signIn')}</span></button>
        </div>
      </header>
      {notice && <div className={`notice ${notice.kind}`} role="status"><span>{notice.text}</span><button aria-label={t('common.closeMenu')} onClick={() => setNotice(null)}><X size={16}/></button></div>}

      {section === 0 && <>
        <section className="hero"><div className="hero-copy"><div className="eyebrow"><span/>{t('dashboard.eyebrow')}</div><h1>{t('dashboard.title')}<br/><em>汉字之路</em></h1><p>{t('dashboard.subtitle')}</p><button className="primary" onClick={() => setSection(1)}>{t('dashboard.continue')}<ChevronRight size={18}/></button></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit1"/><div className="orbit orbit2"/><div className="big-hanzi">汉</div><div className="float-card"><span>你好</span><small>nǐ hǎo · hello</small></div><div className="mini-dot"/></div></section>
        <div className="stats"><div className="stat"><div className="stat-icon blue"><BookOpen/></div><div><strong>0</strong><small>{t('dashboard.wordsLearned')}</small></div><span className="stat-note">/ 1200+</span></div><div className="stat"><div className="stat-icon orange"><Flame/></div><div><strong>3</strong><small>{t('dashboard.streak')}</small></div></div><div className="stat"><div className="stat-icon green"><ChartNoAxesColumnIncreasing/></div><div><strong>0%</strong><small>{t('dashboard.progress')}</small></div></div></div>
        <div className="content-grid"><section className="panel daily"><div className="panel-head"><div><span className="kicker">{t('dashboard.due')}</span><h2>{t('dashboard.today')}</h2></div><span className="date-chip">{t('dashboard.todayTag')}</span></div>{(['dashboard.task1','dashboard.task2','dashboard.task3'] as TranslationKey[]).map((key, i) => <label className={`task ${done[i] ? 'checked' : ''}`} key={key}><input type="checkbox" checked={done[i]} onChange={() => setDone(items => items.map((value, index) => index === i ? !value : value))}/><span className="fakecheck">{done[i] ? '✓' : ''}</span><span className="task-copy">{t(key)}<small>{i === 0 ? '10 min' : i === 1 ? '5 min' : '8 min'}</small></span></label>)}<div className="daily-foot"><span>{done.filter(Boolean).length}/3 {t('dashboard.completed')}</span><div className="progress"><i style={{width: `${done.filter(Boolean).length / 3 * 100}%`}}/></div></div></section><section className="panel review"><div className="review-icon"><Layers/></div><span className="kicker">{t('dashboard.reviewTitle')}</span><h2>{t('dashboard.review')}</h2><p>{t('dashboard.reviewText')}</p><button className="outline" onClick={() => setSection(2)}>{t('dashboard.openFlashcards')}<ChevronRight size={16}/></button></section></div>
      </>}

      {section === 1 && <section className="panel dictionary"><div className="panel-head"><div><span className="kicker">{t('vocab.kicker')}</span><h2>{t('vocab.title')}</h2></div><span className="demo-tag">{t('vocab.demo')}</span></div><p className="notice-text">{t('vocab.demoNotice')}</p><div className="filters"><label className="searchbox"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('vocab.search')}/></label><label className="sr-only" htmlFor="system-filter">{t('vocab.system')}</label><select id="system-filter" value={system} onChange={e => {setSystem(e.target.value as System);setLevel('all')}}><option value="3.0">{t('vocab.hsk30')}</option><option value="2.0">{t('vocab.hsk20')}</option></select><label className="sr-only" htmlFor="level-filter">{t('vocab.level')}</label><select id="level-filter" value={level} onChange={e => setLevel(e.target.value)}><option value="all">{t('vocab.allLevels')}</option>{levels.map((count, i) => <option value={String(i + 1)} key={count}>{levelNames[i]} · {count}</option>)}</select></div><div className="wordlist">{filtered.map((word, i) => <article className="word" key={`${word.hanzi}-${word.pinyin}-${i}`}><div className="word-main"><strong>{word.hanzi}</strong><div><b>{word.pinyin}</b><small>{vocabularyMeaning(word)}</small></div></div><span className="level-pill">HSK {system === '2.0' ? word.level20 : word.level30}</span><button className="sound" onClick={() => speak(word.hanzi)} title={t('vocab.listen')} aria-label={`${t('vocab.listen')}: ${word.hanzi}`}><Volume2 size={18}/></button><div className="example"><span>{word.example}</span><small>{word.examplePinyin} · {exampleMeaning(word)}</small></div></article>)}{filtered.length === 0 && <div className="empty">{t('vocab.noResults')}</div>}</div></section>}

      {section >= 2 && section <= 5 && <section className="panel coming-page"><div className="review-icon">{navIcons[section]}</div><span className="kicker">HANZIPATH</span><h2>{section < 6 ? t(pageKeys[section - 1]) : activeSectionName}</h2><p>{t('dashboard.coming')}</p><button className="primary" onClick={() => setSection(1)}>{t('nav.vocabulary')}<ChevronRight size={18}/></button></section>}
      {section === 6 && <section className="panel settings-page"><div className="review-icon"><Settings/></div><span className="kicker">HANZIPATH</span><h2>{t('profile.settings')}</h2><label className="setting-row"><span>{t('language.label')}</span><select value={lang} onChange={e => void changeLanguage(e.target.value as Locale)}>{(['ru','en','uz'] as const).map(locale => <option key={locale} value={locale}>{t(`language.${locale}` as TranslationKey)}</option>)}</select></label><p>{supabase ? t('profile.languageSaved') : t('profile.languageLocal')}</p></section>}
      <footer><span>© 2026 HanziPath · 汉字之路</span><span>{t('common.database')}: {isSupabaseConfigured ? <b className="ok">{t('common.connected')}</b> : <b className="warn">{t('common.notConnected')}</b>}</span></footer>
    </main>
  </div>
}
