import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, Pencil, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react'
import { supabase } from '../supabase'
import type { Locale } from '../i18n'

type CustomCard = {
  id: string
  deck_name: string
  hanzi: string
  pinyin: string
  translation: string
  example: string | null
  notes: string | null
  created_at: string
}

type Draft = {
  deck_name: string
  hanzi: string
  pinyin: string
  translation: string
  example: string
  notes: string
}

const emptyDraft = (): Draft => ({
  deck_name: 'My vocabulary',
  hanzi: '',
  pinyin: '',
  translation: '',
  example: '',
  notes: '',
})

const copy = {
  ru: {
    title: 'Personal Flash Cards', subtitle: 'Создавай собственные карточки и повторяй их в удобном темпе.',
    signIn: 'Войди в аккаунт HanziPath, чтобы сохранять личные карточки и синхронизировать их между устройствами.',
    loading: 'Загружаем твои карточки…', deck: 'Набор карточек', newDeck: 'Название набора',
    hanzi: 'Иероглиф или слово', pinyin: 'Pinyin', translation: 'Перевод',
    example: 'Пример предложения', notes: 'Заметки', add: 'Добавить карточку',
    save: 'Сохранить изменения', cancel: 'Отмена', edit: 'Изменить', remove: 'Удалить',
    all: 'Все наборы', noCards: 'В этом наборе пока нет карточек. Добавь первую!',
    front: 'Показать ответ', again: 'Повторить', known: 'Знаю', previous: 'Назад', next: 'Далее',
    count: 'карточек', error: 'Не удалось загрузить карточки. Попробуй ещё раз.',
    required: 'Заполни иероглиф, произношение и перевод.', saved: 'Карточка сохранена.',
    deleteConfirm: 'Удалить эту карточку?', emptyDeck: 'Мой набор',
  },
  en: {
    title: 'Personal Flash Cards', subtitle: 'Create your own cards and review them at your pace.',
    signIn: 'Sign in to HanziPath to save your personal cards and sync them across devices.',
    loading: 'Loading your cards…', deck: 'Deck', newDeck: 'Deck name',
    hanzi: 'Chinese word or characters', pinyin: 'Pinyin', translation: 'Translation',
    example: 'Example sentence', notes: 'Notes', add: 'Add card',
    save: 'Save changes', cancel: 'Cancel', edit: 'Edit', remove: 'Delete',
    all: 'All decks', noCards: 'No cards in this deck yet. Add your first one!',
    front: 'Show answer', again: 'Review again', known: 'I know it', previous: 'Previous', next: 'Next',
    count: 'cards', error: 'Could not load cards. Please try again.',
    required: 'Enter the Chinese word, pronunciation and translation.', saved: 'Card saved.',
    deleteConfirm: 'Delete this card?', emptyDeck: 'My deck',
  },
  uz: {
    title: 'Personal Flash Cards', subtitle: 'O‘z kartochkalaringizni yarating va qulay vaqtda takrorlang.',
    signIn: 'Shaxsiy kartochkalarni saqlash va qurilmalar orasida sinxronlash uchun HanziPath hisobiga kiring.',
    loading: 'Kartochkalaringiz yuklanmoqda…', deck: 'To‘plam', newDeck: 'To‘plam nomi',
    hanzi: 'Xitoycha so‘z yoki ieroglif', pinyin: 'Pinyin', translation: 'Tarjima',
    example: 'Gap namunasi', notes: 'Eslatmalar', add: 'Kartochka qo‘shish',
    save: 'O‘zgarishlarni saqlash', cancel: 'Bekor qilish', edit: 'Tahrirlash', remove: 'O‘chirish',
    all: 'Barcha to‘plamlar', noCards: 'Bu to‘plamda hali kartochkalar yo‘q. Birinchisini qo‘shing!',
    front: 'Javobni ko‘rsatish', again: 'Qayta takrorlash', known: 'Bilaman', previous: 'Orqaga', next: 'Keyingi',
    count: 'ta kartochka', error: 'Kartochkalarni yuklab bo‘lmadi. Qayta urinib ko‘ring.',
    required: 'Xitoycha so‘z, talaffuz va tarjimani kiriting.', saved: 'Kartochka saqlandi.',
    deleteConfirm: 'Bu kartochka o‘chirilsinmi?', emptyDeck: 'Mening to‘plamim',
  },
} satisfies Record<Locale, Record<string, string>>

export default function PersonalFlashCards({ locale }: { locale: Locale }) {
  const t = copy[locale]
  const [userId, setUserId] = useState<string | null>(null)
  const [cards, setCards] = useState<CustomCard[]>([])
  const [loading, setLoading] = useState(true)
  const [deck, setDeck] = useState('')
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!supabase) { setLoading(false); return }
    const client = supabase
    const loadCards = async (id: string) => {
      setLoading(true)
      const { data, error } = await client
        .from('user_custom_flashcards')
        .select('id,deck_name,hanzi,pinyin,translation,example,notes,created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (error) setNotice(t.error)
      else setCards((data ?? []) as CustomCard[])
      setLoading(false)
    }
    const { data: authListener } = client.auth.onAuthStateChange((_event, session) => {
      const id = session?.user?.id ?? null
      setUserId(id)
      if (id) void loadCards(id)
      else {
        setCards([])
        setDeck('')
        setLoading(false)
      }
    })
    void client.auth.getUser().then(({ data }) => {
      if (cancelled) return
      const id = data.user?.id ?? null
      setUserId(id)
      if (id) void loadCards(id)
      else setLoading(false)
    })
    return () => {
      cancelled = true
      authListener.subscription.unsubscribe()
    }
  }, [t.error])

  const decks = useMemo(() => [...new Set(cards.map(card => card.deck_name))].sort(), [cards])
  const visibleCards = useMemo(
    () => cards.filter(card => !deck || card.deck_name === deck),
    [cards, deck],
  )
  const activeCard = visibleCards.length ? visibleCards[Math.min(activeIndex, visibleCards.length - 1)] : null

  const resetDraft = (defaultDeck = deck) => {
    setDraft({ ...emptyDraft(), deck_name: defaultDeck || t.emptyDeck })
    setEditingId(null)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!userId || !supabase || busy) return
    if (!draft.hanzi.trim() || !draft.pinyin.trim() || !draft.translation.trim()) {
      setNotice(t.required)
      return
    }
    setBusy(true)
    setNotice('')
    const payload = {
      user_id: userId,
      deck_name: draft.deck_name.trim() || t.emptyDeck,
      hanzi: draft.hanzi.trim(),
      pinyin: draft.pinyin.trim(),
      translation: draft.translation.trim(),
      example: draft.example.trim() || null,
      notes: draft.notes.trim() || null,
    }
    const result = editingId
      ? await supabase.from('user_custom_flashcards').update(payload).eq('id', editingId).eq('user_id', userId).select('id,deck_name,hanzi,pinyin,translation,example,notes,created_at').single()
      : await supabase.from('user_custom_flashcards').insert(payload).select('id,deck_name,hanzi,pinyin,translation,example,notes,created_at').single()
    if (result.error) setNotice(result.error.message)
    else if (result.data) {
      setCards(current => editingId
        ? current.map(card => card.id === editingId ? result.data as CustomCard : card)
        : [result.data as CustomCard, ...current])
      setDeck(payload.deck_name)
      setActiveIndex(0)
      setNotice(t.saved)
      resetDraft(payload.deck_name)
    }
    setBusy(false)
  }

  const editCard = (card: CustomCard) => {
    setEditingId(card.id)
    setDraft({
      deck_name: card.deck_name,
      hanzi: card.hanzi,
      pinyin: card.pinyin,
      translation: card.translation,
      example: card.example ?? '',
      notes: card.notes ?? '',
    })
    setNotice('')
  }

  const deleteCard = async (card: CustomCard) => {
    if (!userId || !supabase || !window.confirm(t.deleteConfirm)) return
    const { error } = await supabase.from('user_custom_flashcards').delete().eq('id', card.id).eq('user_id', userId)
    if (error) setNotice(error.message)
    else {
      setCards(current => current.filter(item => item.id !== card.id))
      setActiveIndex(0)
      setShowAnswer(false)
      if (editingId === card.id) resetDraft()
    }
  }

  const move = (step: number) => {
    if (!visibleCards.length) return
    setActiveIndex(index => (index + step + visibleCards.length) % visibleCards.length)
    setShowAnswer(false)
  }

  if (loading) return <div className="personal-flashcards"><p className="notice-text">{t.loading}</p></div>
  if (!userId) return <div className="personal-flashcards"><p className="notice-text">{t.signIn}</p></div>

  return (
    <div className="personal-flashcards">
      <div className="personal-flashcards-heading">
        <div><span className="kicker">CREATE · COLLECT · REVIEW</span><h3>{t.title}</h3><p>{t.subtitle}</p></div>
        <span className="demo-tag">{cards.length} {t.count}</span>
      </div>
      {notice && <p className="notice-text" role="status">{notice}</p>}
      <div className="personal-flashcards-grid">
        <form className="personal-flashcards-form" onSubmit={submit}>
          <h4>{editingId ? t.edit : t.add}</h4>
          <label>{t.newDeck}<input value={draft.deck_name} onChange={event => setDraft(value => ({ ...value, deck_name: event.target.value }))} maxLength={80}/></label>
          <label>{t.hanzi}<input value={draft.hanzi} onChange={event => setDraft(value => ({ ...value, hanzi: event.target.value }))} required maxLength={120}/></label>
          <label>{t.pinyin}<input value={draft.pinyin} onChange={event => setDraft(value => ({ ...value, pinyin: event.target.value }))} required maxLength={160}/></label>
          <label>{t.translation}<input value={draft.translation} onChange={event => setDraft(value => ({ ...value, translation: event.target.value }))} required maxLength={240}/></label>
          <label>{t.example}<textarea value={draft.example} onChange={event => setDraft(value => ({ ...value, example: event.target.value }))} rows={2} maxLength={500}/></label>
          <label>{t.notes}<textarea value={draft.notes} onChange={event => setDraft(value => ({ ...value, notes: event.target.value }))} rows={2} maxLength={500}/></label>
          <div className="personal-flashcards-form-actions">
            <button className="primary" type="submit" disabled={busy}>{editingId ? <Save size={15}/> : <Plus size={15}/>} {editingId ? t.save : t.add}</button>
            {editingId && <button className="outline" type="button" onClick={() => resetDraft()}><X size={15}/>{t.cancel}</button>}
          </div>
        </form>
        <div className="personal-flashcards-study">
          <div className="filters">
            <label>{t.deck}<select value={deck} onChange={event => { setDeck(event.target.value); setActiveIndex(0); setShowAnswer(false) }}>
              <option value="">{t.all}</option>
              {decks.map(name => <option key={name} value={name}>{name}</option>)}
            </select></label>
          </div>
          {activeCard ? <>
            <article className="study-card personal-study-card">
              <span className="study-hanzi">{activeCard.hanzi}</span>
              {showAnswer && <div className="study-answer"><b>{activeCard.pinyin}</b><span>{activeCard.translation}</span>{activeCard.example && <small>{activeCard.example}</small>}{activeCard.notes && <small>{activeCard.notes}</small>}</div>}
            </article>
            <div className="study-actions">
              {!showAnswer ? <button className="primary" onClick={() => setShowAnswer(true)}>{t.front}</button> : <button className="primary" onClick={() => move(1)}><Check size={15}/>{t.known}</button>}
              <button className="outline" onClick={() => move(1)}><RotateCcw size={15}/>{t.again}</button>
            </div>
            <div className="study-footer">
              <button className="outline" onClick={() => move(-1)}>{t.previous}</button>
              <span>{activeIndex + 1} / {visibleCards.length}</span>
              <button className="outline" onClick={() => move(1)}>{t.next}</button>
            </div>
            <div className="personal-card-list">
              {visibleCards.map(card => <div className="personal-card-row" key={card.id}>
                <div><b>{card.hanzi}</b><span>{card.pinyin} · {card.translation}</span><small>{card.deck_name}</small></div>
                <button className="outline" type="button" aria-label={t.edit} onClick={() => editCard(card)}><Pencil size={14}/></button>
                <button className="outline" type="button" aria-label={t.remove} onClick={() => void deleteCard(card)}><Trash2 size={14}/></button>
              </div>)}
            </div>
          </> : <div className="empty">{t.noCards}</div>}
        </div>
      </div>
    </div>
  )
}
