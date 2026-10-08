import { describe, expect, it } from "vitest";
import { collectUnreadThreadUpdates } from "./threadUpdates";

const threads = [
  { id: "a", updatedAt: "1" },
  { id: "b", updatedAt: "2" },
];
describe("thread updates", () => {
  it("uses the first snapshot as a baseline", () => {
    expect([...collectUnreadThreadUpdates(null, threads, "a", new Set())]).toEqual([]);
  });
  it("marks changed and newly created background threads without changing the selection", () => {
    const previous = new Map([
      ["a", "0"],
      ["b", "1"],
    ]);
    expect([
      ...collectUnreadThreadUpdates(
        previous,
        [...threads, { id: "c", updatedAt: "1" }],
        "a",
        new Set(),
      ),
    ]).toEqual(["b", "c"]);
  });
  it("keeps an update unread until opened and prunes deleted threads", () => {
    const previous = new Map(threads.map((thread) => [thread.id, thread.updatedAt]));
    const unread = new Set(["b", "deleted"]);
    expect([...collectUnreadThreadUpdates(previous, threads, "a", unread)]).toEqual(["b"]);
    expect([...collectUnreadThreadUpdates(previous, threads, "b", unread)]).toEqual([]);
  });
  it("does not mark unchanged threads on reconnect", () => {
    const previous = new Map(threads.map((thread) => [thread.id, thread.updatedAt]));
    const unread = new Set<string>();
    expect(collectUnreadThreadUpdates(previous, threads, "a", unread)).toBe(unread);
  });
});
