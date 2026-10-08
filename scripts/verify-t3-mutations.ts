import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const { T3Transport } = await import(
  new URL("../apps/tui/src/t3Transport.ts", import.meta.url).href
);
const { origin, token } = JSON.parse(
  readFileSync("/home/m1-max/.config/t1code/t3-connection.json", "utf8"),
);
const id = crypto.randomUUID();
const selection = { instanceId: "codex", model: "gpt-6-astra" };
const client = new T3Transport(
  origin,
  token,
  () => id,
  () => selection,
);
const observer = new T3Transport(
  origin,
  token,
  () => id,
  () => selection,
);
let changes = 0;
let created = false;
try {
  const initial = await client.request("orchestration.getSnapshot");
  const project = initial.projects[0];
  await observer.request("server.getConfig");
  observer.subscribe("orchestration.domainEvent", () => changes++);
  await client.request("orchestration.dispatchCommand", {
    command: {
      type: "thread.create",
      commandId: crypto.randomUUID(),
      threadId: id,
      projectId: project.id,
      title: "T1 frontend integration check",
      model: selection.model,
      runtimeMode: "full-access",
      interactionMode: "default",
      branch: null,
      worktreePath: null,
      createdAt: new Date().toISOString(),
    },
  });
  created = true;
  let snapshot = await observer.request("orchestration.getSnapshot");
  assert.equal(
    snapshot.threads.find((t: Record<string, any>) => t.id === id).modelSelection.instanceId,
    "codex",
  );
  await client.request("orchestration.dispatchCommand", {
    command: {
      type: "thread.meta.update",
      commandId: crypto.randomUUID(),
      threadId: id,
      title: "T1 frontend integration check renamed",
    },
  });
  snapshot = await observer.request("orchestration.getSnapshot");
  assert.equal(
    snapshot.threads.find((t: Record<string, any>) => t.id === id).title,
    "T1 frontend integration check renamed",
  );
  const git = await client.request("git.status", { cwd: project.workspaceRoot });
  assert.equal(typeof git.branch, "string");
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert(changes > 0, "A second client must receive real T3 changes");
  console.log(
    "PASS: create, model selection, rename, cross-client events, and Git status on real T3",
  );
} finally {
  if (created)
    await client.request("orchestration.dispatchCommand", {
      command: { type: "thread.delete", commandId: crypto.randomUUID(), threadId: id },
    });
  client.dispose();
  observer.dispose();
}
