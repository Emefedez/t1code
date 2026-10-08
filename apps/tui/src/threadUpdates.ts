type ThreadUpdate = { id: string; updatedAt: string };

/** The first snapshot is a baseline; subsequent changes are unread until opened. */
export function collectUnreadThreadUpdates(
  previous: ReadonlyMap<string, string> | null,
  threads: readonly ThreadUpdate[],
  activeThreadId: string | undefined,
  unread: ReadonlySet<string>,
): ReadonlySet<string> {
  const liveIds = new Set(threads.map((thread) => thread.id));
  const next = new Set([...unread].filter((id) => liveIds.has(id) && id !== activeThreadId));
  if (previous) {
    for (const thread of threads) {
      if (thread.id !== activeThreadId && previous.get(thread.id) !== thread.updatedAt) {
        next.add(thread.id);
      }
    }
  }
  if (next.size === unread.size && [...next].every((id) => unread.has(id))) return unread;
  return next;
}
