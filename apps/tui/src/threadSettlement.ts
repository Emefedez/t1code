export type ThreadSettlementInfo = {
  settledOverride?: "settled" | "active" | null;
  autoSettleDisabledAt?: string | null;
};

export function isThreadSettled(thread: unknown): boolean {
  return (
    !!thread &&
    typeof thread === "object" &&
    (thread as ThreadSettlementInfo).settledOverride === "settled"
  );
}

export function supportsThreadSettlement(capabilities: unknown): boolean {
  return (
    !!capabilities &&
    typeof capabilities === "object" &&
    "threadSettlement" in capabilities &&
    capabilities.threadSettlement === true
  );
}

export function supportsThreadAutoSettleOptOut(capabilities: unknown): boolean {
  return (
    !!capabilities &&
    typeof capabilities === "object" &&
    "threadAutoSettleOptOut" in capabilities &&
    capabilities.threadAutoSettleOptOut === true
  );
}

export function groupThreadSettlement<T>(threads: readonly T[]): { active: T[]; settled: T[] } {
  const active: T[] = [];
  const settled: T[] = [];
  for (const thread of threads) (isThreadSettled(thread) ? settled : active).push(thread);
  return { active, settled };
}

export function threadSettlementCommand(threadId: string, settled: boolean, commandId: string) {
  return settled
    ? { type: "thread.settle" as const, commandId, threadId }
    : { type: "thread.unsettle" as const, commandId, threadId, reason: "user" as const };
}
