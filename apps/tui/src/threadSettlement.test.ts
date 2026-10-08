import { describe, expect, it } from "vitest";
import {
  groupThreadSettlement,
  isThreadSettled,
  supportsThreadSettlement,
  threadSettlementCommand,
} from "./threadSettlement";
import { buildThreadContextMenuItems } from "./sidebarContextMenu";

describe("T3 thread settlement", () => {
  it("keeps settled threads separate and preserves the order inside each group", () => {
    const threads = [
      { id: "done", settledOverride: "settled" },
      { id: "a", settledOverride: null },
      { id: "b", settledOverride: "active" },
    ];
    expect(groupThreadSettlement(threads)).toEqual({
      active: threads.slice(1),
      settled: threads.slice(0, 1),
    });
    expect(isThreadSettled({ settledAt: "2026-10-08", settledOverride: "active" })).toBe(false);
  });
  it("does not send settlement commands to older servers", () => {
    expect(supportsThreadSettlement(undefined)).toBe(false);
    expect(supportsThreadSettlement({ threadSettlement: false })).toBe(false);
    expect(supportsThreadSettlement({ threadSettlement: true })).toBe(true);
    expect(buildThreadContextMenuItems()).not.toContainEqual({
      id: "settle",
      label: "Mark settled",
    });
    expect(buildThreadContextMenuItems({ supportsSettlement: true, settled: true })).toContainEqual(
      { id: "unsettle", label: "Reopen thread" },
    );
  });
  it("uses T3's canonical settle and user-reopen commands", () => {
    expect(threadSettlementCommand("thread", true, "command")).toEqual({
      type: "thread.settle",
      threadId: "thread",
      commandId: "command",
    });
    expect(threadSettlementCommand("thread", false, "command")).toEqual({
      type: "thread.unsettle",
      threadId: "thread",
      commandId: "command",
      reason: "user",
    });
  });
});
