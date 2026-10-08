import { describe, expect, it } from "vitest";
import { adaptT3Config, adaptT3Thread } from "./t3Transport";

describe("real T3 data compatibility", () => {
  it("preserves provider instances and server model capabilities, including unknown drivers", () => {
    const providers = [
      {
        instanceId: "codex",
        driver: "codex",
        models: [
          { slug: "gpt-6.1-sol", capabilities: { optionDescriptors: [{ id: "serviceTier" }] } },
        ],
      },
      { instanceId: "antigravity", driver: "antigravity", models: [{ slug: "gemini-3-pro" }] },
    ];
    const config = adaptT3Config({ providers });
    expect(config.providerInstances).toBe(providers);
    expect(config.providers[0].provider).toBe("codex");
    expect(config.providerInstances[0].models[0].capabilities.optionDescriptors[0].id).toBe(
      "serviceTier",
    );
    expect(config.providerInstances[1].instanceId).toBe("antigravity");
  });

  it("coalesces replayed messages by ID without duplicating native conversation rows", () => {
    const adapted = adaptT3Thread(
      { id: "thread" },
      {
        thread: {
          messages: [
            { id: "async-answer:question", text: "partial" },
            { id: "next", text: "next" },
            { id: "async-answer:question", text: "complete" },
          ],
        },
      },
    );
    expect(adapted.messages).toEqual([
      { id: "async-answer:question", text: "complete" },
      { id: "next", text: "next" },
    ]);
  });

  it("joins thread detail to the shell without losing selected model options or conversation history", () => {
    const selection = {
      instanceId: "custom-codex",
      model: "gpt-6-astra",
      options: [{ id: "reasoningEffort", value: "ultra" }],
    };
    const shell = { id: "thread-1", title: "A real thread", modelSelection: selection };
    const detail = {
      snapshotSequence: 40,
      thread: {
        ...shell,
        messages: [{ id: "message-1", text: "Existing history" }],
        proposedPlans: [{ id: "plan-1" }],
        activities: [],
        checkpoints: [],
        session: { providerInstanceId: "custom-codex" },
      },
    };
    const adapted = adaptT3Thread(shell, detail);
    expect(adapted.model).toBe("gpt-6-astra");
    expect(adapted.modelSelection).toBe(selection);
    expect(adapted.messages[0].text).toBe("Existing history");
    expect(adapted.proposedPlans[0].id).toBe("plan-1");
    expect(adapted.session.providerInstanceId).toBe("custom-codex");
    expect(adapted).not.toHaveProperty("thread");
  });
});
