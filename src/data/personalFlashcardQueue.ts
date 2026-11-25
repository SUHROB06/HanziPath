export type PersonalFlashcardQueueItem = { id: string }

/**
 * Build one study pass: unseen cards first, then cards explicitly marked for
 * another review. A card can appear only once in the queue at a time.
 */
export function buildPersonalFlashcardQueue<T extends PersonalFlashcardQueueItem>(
  visibleCards: T[],
  completedIds: string[],
  againQueue: string[],
): T[] {
  const completed = new Set(completedIds)
  const retryIds = [...new Set(againQueue)]
  const retrySet = new Set(retryIds)
  const byId = new Map(visibleCards.map(card => [card.id, card]))
  const unseen = visibleCards.filter(card => !completed.has(card.id) && !retrySet.has(card.id))
  const retries = retryIds.map(id => byId.get(id)).filter((card): card is T => Boolean(card) && !completed.has(card.id))
  return [...unseen, ...retries]
}
